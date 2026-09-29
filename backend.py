"""Serve the web app and run the pretrained Shap-E model without a paid API."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import Literal
import logging
import os
import secrets
import time

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

ROOT = Path(__file__).resolve().parent
OUTPUTS = ROOT / "outputs"
OUTPUTS.mkdir(exist_ok=True)
os.environ.setdefault("HF_HOME", str(ROOT / ".model-cache"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
app = FastAPI(title="Form text-to-3D", docs_url=None, redoc_url=None)
executor = ThreadPoolExecutor(max_workers=1)
lock = Lock()
jobs = {}
pipeline = None
device = "cpu"


class PromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=800)
    quality: Literal["draft", "standard"] = "draft"

    @field_validator("prompt")
    @classmethod
    def trim_prompt(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Describe an object before generating.")
        return value


def update(job_id, **values):
    with lock:
        jobs[job_id].update(values)


def run_generation(job_id, prompt, quality):
    global pipeline, device
    try:
        if jobs[job_id].get("cancelled"):
            update(job_id, status="cancelled", message="Generation cancelled.")
            return
        update(job_id, status="loading", message="Preparing the Shap-E runtime…")
        import torch
        import numpy as np
        import trimesh
        from diffusers import ShapEPipeline, PriorTransformer, HeunDiscreteScheduler
        from diffusers.pipelines.shap_e.renderer import ShapERenderer
        from transformers import CLIPTextModelWithProjection, CLIPTokenizer
        from diffusers.utils import export_to_ply

        torch.set_num_threads(max(1, min(8, os.cpu_count() or 2)))
        if pipeline is None:
            update(job_id, status="loading", message="Loading Shap-E. The first run downloads the model weights.")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32
            # The renderer has no fp16 variant. Load each published component
            # explicitly so the smaller prior/text checkpoints remain usable.
            repo = "openai/shap-e"
            pipeline = ShapEPipeline(
                prior=PriorTransformer.from_pretrained(repo, subfolder="prior", variant="fp16",
                                                       use_safetensors=True, torch_dtype=dtype),
                text_encoder=CLIPTextModelWithProjection.from_pretrained(
                    repo, subfolder="text_encoder", variant="fp16", use_safetensors=True, torch_dtype=dtype),
                tokenizer=CLIPTokenizer.from_pretrained(repo, subfolder="tokenizer"),
                scheduler=HeunDiscreteScheduler.from_pretrained(repo, subfolder="scheduler"),
                shap_e_renderer=ShapERenderer.from_pretrained(
                    repo, subfolder="shap_e_renderer", use_safetensors=False, torch_dtype=dtype),
            ).to(device)
            pipeline.set_progress_bar_config(disable=True)

        if jobs[job_id].get("cancelled"):
            update(job_id, status="cancelled", message="Generation cancelled.")
            return

        # The pipeline's progress iterator is also our cancellation checkpoint.
        original_progress = pipeline.progress_bar
        def progress(iterable=None, total=None):
            if iterable is None:
                return original_progress(iterable=iterable, total=total)
            count = len(iterable)
            def steps():
                for index, step in enumerate(iterable):
                    if jobs[job_id].get("cancelled"):
                        raise InterruptedError("Generation cancelled.")
                    update(job_id, status="generating", progress=round(index / count * 85),
                           message=f"Generating the mesh · step {index + 1} of {count}")
                    yield step
            return steps()
        pipeline.progress_bar = progress
        seed = secrets.randbelow(2**31)
        try:
            with torch.inference_mode():
                latent = pipeline(prompt, num_inference_steps=16 if quality == "draft" else 64,
                                  guidance_scale=15.0, generator=torch.Generator(device=device).manual_seed(seed),
                                  output_type="latent").images[0]
                if jobs[job_id].get("cancelled"):
                    raise InterruptedError("Generation cancelled.")
                update(job_id, status="decoding", progress=86, message="Decoding the 3D surface and colors…")
                result = pipeline.shap_e_renderer.decode_to_mesh(
                    latent[None, :], device, grid_size=96 if quality == "draft" else 128)
        finally:
            pipeline.progress_bar = original_progress

        if jobs[job_id].get("cancelled"):
            raise InterruptedError("Generation cancelled.")
        update(job_id, status="exporting", progress=90, message="Exporting your GLB model…")
        ply = OUTPUTS / f"{job_id}.ply"
        export_to_ply(result, str(ply))
        try:
            mesh = trimesh.load(str(ply), force="mesh")
            mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
            if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
                raise ValueError("The model produced an empty mesh. Try a simpler prompt.")
            mesh.export(OUTPUTS / f"{job_id}.glb", file_type="glb")
        finally:
            ply.unlink(missing_ok=True)
        update(job_id, status="complete", progress=100, message="Your model is ready.",
               url=f"/api/models/{job_id}.glb", seed=seed,
               vertices=len(mesh.vertices), faces=len(mesh.faces))
    except InterruptedError:
        update(job_id, status="cancelled", message="Generation cancelled.")
    except Exception:
        logging.exception("Shap-E generation failed")
        update(job_id, status="failed", message="Shap-E could not finish this model. Check the server log and try again.")


@app.get("/api/health")
def health():
    return {"service": "form-shap-e", "ready": pipeline is not None, "device": device}


@app.post("/api/jobs", status_code=202)
def create_job(request: PromptRequest):
    with lock:
        expired = [key for key, job in jobs.items() if job["created"] < time.time() - 10800
                   and job["status"] in {"complete", "failed", "cancelled"}]
        for key in expired:
            jobs.pop(key)
            (OUTPUTS / f"{key}.glb").unlink(missing_ok=True)
        if sum(job["status"] not in {"complete", "failed", "cancelled"} for job in jobs.values()) >= 3:
            raise HTTPException(429, "The generation queue is full. Please wait for a model to finish.")
        job_id = secrets.token_hex(16)
        jobs[job_id] = {"id": job_id, "status": "queued", "progress": 0,
                        "message": "Waiting for the model…", "created": time.time(), "cancelled": False}
    executor.submit(run_generation, job_id, request.prompt, request.quality)
    return {"id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    with lock:
        if job_id not in jobs:
            raise HTTPException(404, "This model job has expired or does not exist.")
        return dict(jobs[job_id])


@app.delete("/api/jobs/{job_id}", status_code=202)
def cancel_job(job_id: str):
    with lock:
        if job_id not in jobs:
            raise HTTPException(404, "Job not found.")
        if jobs[job_id]["status"] not in {"complete", "failed", "cancelled"}:
            jobs[job_id]["cancelled"] = True
    return {"status": "cancellation_requested"}


@app.get("/api/models/{filename}")
def download_model(filename: str):
    job_id = filename.removesuffix(".glb")
    with lock:
        job = jobs.get(job_id)
        if not filename.endswith(".glb") or not job or job["status"] != "complete":
            raise HTTPException(404, "Model not found.")
    return FileResponse(OUTPUTS / filename, media_type="model/gltf-binary", filename="form-model.glb")


app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="web")
