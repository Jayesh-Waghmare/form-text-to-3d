"""Load the published Shap-E checkpoints and export a colored GLB mesh."""

from pathlib import Path
from uuid import uuid4
import os

import numpy as np
import torch
import trimesh
from diffusers import HeunDiscreteScheduler, PriorTransformer, ShapEPipeline
from diffusers.pipelines.shap_e.renderer import ShapERenderer
from diffusers.utils import export_to_ply
from transformers import CLIPTextModelWithProjection, CLIPTokenizer


ROOT = Path(__file__).resolve().parent
OUTPUTS = ROOT / "outputs"
OUTPUTS.mkdir(exist_ok=True)
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")


def validate_prompt(prompt: str) -> str:
    if not isinstance(prompt, str):
        raise ValueError("Enter a description of one object.")
    prompt = prompt.strip()
    if not prompt:
        raise ValueError("Enter a description of one object.")
    if len(prompt) > 800:
        raise ValueError("Keep the description under 800 characters.")
    return prompt


class ShapEGenerator:
    def __init__(self):
        torch.set_num_threads(max(1, min(8, os.cpu_count() or 2)))
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        repo = "openai/shap-e"

        # The renderer has no fp16 checkpoint. Load the components separately
        # to keep the official prior and text encoder variants compatible.
        self.pipeline = ShapEPipeline(
            prior=PriorTransformer.from_pretrained(
                repo, subfolder="prior", variant="fp16",
                use_safetensors=True, torch_dtype=dtype),
            text_encoder=CLIPTextModelWithProjection.from_pretrained(
                repo, subfolder="text_encoder", variant="fp16",
                use_safetensors=True, torch_dtype=dtype),
            tokenizer=CLIPTokenizer.from_pretrained(repo, subfolder="tokenizer"),
            scheduler=HeunDiscreteScheduler.from_pretrained(repo, subfolder="scheduler"),
            shap_e_renderer=ShapERenderer.from_pretrained(
                repo, subfolder="shap_e_renderer", use_safetensors=False,
                torch_dtype=dtype),
        ).to(self.device)
        self.pipeline.set_progress_bar_config(disable=True)

    def generate(self, prompt: str, quality: str = "Quick preview") -> Path:
        prompt = validate_prompt(prompt)
        if quality not in {"Quick preview", "Detailed model"}:
            raise ValueError("Select a valid quality setting.")

        steps = 16 if quality == "Quick preview" else 64
        grid_size = 96 if quality == "Quick preview" else 128
        seed = int.from_bytes(os.urandom(4), "big") % (2**31)
        with torch.inference_mode():
            latent = self.pipeline(
                prompt,
                num_inference_steps=steps,
                guidance_scale=15.0,
                generator=torch.Generator(device=self.device).manual_seed(seed),
                output_type="latent",
            ).images[0]
            mesh_data = self.pipeline.shap_e_renderer.decode_to_mesh(
                latent[None, :], self.device, grid_size=grid_size)

        output = OUTPUTS / f"model-{uuid4().hex}.glb"
        intermediate = output.with_suffix(".ply")
        try:
            export_to_ply(mesh_data, str(intermediate))
            mesh = trimesh.load(str(intermediate), force="mesh")
            mesh.apply_transform(trimesh.transformations.rotation_matrix(
                -np.pi / 2, [1, 0, 0]))
            if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
                raise ValueError("The model produced an empty mesh. Try a simpler prompt.")
            mesh.export(output, file_type="glb")
        finally:
            intermediate.unlink(missing_ok=True)
        return output
