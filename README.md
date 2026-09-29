---
title: Form Text to 3D
emoji: 🧊
colorFrom: green
colorTo: orange
sdk: docker
app_port: 7860
---

# Form — Text to 3D

Describe an object, generate a mesh with pretrained OpenAI Shap-E, inspect it in Three.js, and download a GLB.

The complete app uses a Python/FastAPI backend that runs Shap-E directly on CPU or CUDA. No Meshy key or model training is needed.

**Verification:** See [REQUIREMENTS.md](REQUIREMENTS.md) for the completed checks and remaining publishing steps. The sample is labelled separately from AI-generated output.

## Run the complete app

Use Python 3.12 or 3.13. Open a terminal in this directory:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn backend:app --host 127.0.0.1 --port 7860 --workers 1
```

Open **http://127.0.0.1:7860**. Enter `A birthday cupcake` and click **Generate model**. First generation downloads roughly 1.8 GB into `.model-cache`; later runs reuse the weights. CPU inference is slow: budget around 10–15 minutes for a preview on the tested machine, and longer on a small hosted CPU. The cupcake run reached roughly 3.7 GB of process working memory. Use a host with sufficient RAM; detailed mode needs more time and memory. CUDA is used automatically when available.

If the Python downloader stalls on Windows, stop the backend and run `.venv\Scripts\python.exe scripts/download-weights.py`, then restart it. This optional helper uses Windows curl to download the three official checkpoints in parallel ranges and validates their published SHA-256 hashes. Downloads can resume after interruption.

Helpers: `start-local.ps1` for Windows and `sh start-local.sh` for macOS/Linux. If the environment already exists, rerun the dependency-install command after updating the project. For CUDA, install an appropriate CUDA PyTorch wheel instead of the CPU wheel.

## Implementation

- Prompt validation in the browser and backend.
- Quick preview uses 16 inference steps and a 96³ surface grid. Detailed mode uses 64 steps and a 128³ grid. The API accepts `quality: "draft"` or `"standard"`.
- A queue of at most three jobs, processing one at a time.
- Model-loading, inference, export, completion, cancellation, and failure states.
- Drag/touch rotation, wheel/pinch zoom, pan, reset, auto rotation, and wireframe.
- Downloads preserve the original generated GLB, including vertex colors.
- Completed result URLs reopen the model after a refresh while its job remains on the server. Download it before its three-hour expiry or a server restart.
- Completed jobs expire after three hours when new jobs are submitted. Job metadata is lost on restart.

The sample avocado chair is procedural and clearly labelled. Its GLB was exported and loaded back successfully with all nine meshes intact.

Cancellation stops between inference steps. Loading and mesh decoding cannot stop immediately. Shap-E works best on simple objects; it is not precision CAD, guaranteed print-ready output, or reliable text-on-object generation. Long prompts are truncated by the model's text encoder.

## Files

| File | Purpose |
| --- | --- |
| `backend.py` | FastAPI, queue, Shap-E inference, GLB export |
| `requirements.txt`, `Dockerfile` | Backend dependencies and container |
| `dist/index.html`, `dist/style.css` | Interface and responsive styles |
| `dist/app.js`, `dist/generation.js` | Viewer and generation requests |
| `dist/sample.js`, `dist/sample.glb` | Sample geometry and validated export |
| `dist/vendor/` | Pinned Three.js 0.180.0 with MIT license |
| `tests/`, `scripts/` | Checks and verification helpers |

No frontend build step is needed. The viewer library is served locally. Google Fonts is optional; system fonts are the fallback.

## Checks

```powershell
node --test tests/generation.test.mjs
.venv\Scripts\python.exe -m unittest discover -s tests -p test_backend.py
node scripts/build-sample.mjs
node scripts/verify-glb.mjs PATH_TO_DOWNLOADED_MODEL.glb
```

Eight JavaScript tests and four Python API tests pass. Inference is mocked in the queue tests; they do not prove model quality. The sample export check performs a genuine GLB round trip.

For a real check, start the backend on port **8000**, then run `node scripts/verify-local.mjs` in another terminal. It submits a cupcake prompt, checks the resulting GLB header, loads it with Three.js GLTFLoader, and saves it in `outputs`. Pass another prompt as an argument to test a different object.

## Publish your repository

Create an empty GitHub repository. The prepared local checkout already has a `main` branch and an initial commit; skip the first three commands below in that checkout. If starting from the source ZIP, run all commands. Replace the remote URL:

```sh
git init -b main
git add .
git commit -m "Add text-to-3D application"
git remote add origin https://github.com/YOUR_USERNAME/form-text-to-3d.git
git push -u origin main
```

The gitignore excludes environments, model weights, generated outputs, and local secrets. Do not upload those folders through the browser either.

## Deploy the complete app

Create a **Docker Space** on Hugging Face and upload `Dockerfile`, `requirements.txt`, `backend.py`, this `README.md`, and the entire `dist` folder. The YAML above configures port 7860. Use one worker; multiple workers have separate job queues and model copies.

Alternatively, on a suitable Docker host:

```sh
docker build -t form-3d .
docker run --rm -p 7860:7860 form-3d
```

Docker build and deployment have not been run here. Test genuine generation on the deployed app before sharing its URL.

**Check hosting eligibility.** Hugging Face lists CPU Basic with no hourly charge, but creating a Docker Space requires a paid plan. Its free-personal-account exception permits up to two **Gradio ZeroGPU** Spaces; this Docker app would need a Gradio/ZeroGPU adaptation to use that exception. Do not assume a new account can create a free Docker Space. [Current hardware and eligibility](https://huggingface.co/docs/hub/spaces-overview#hardware-resources).

## Static frontend option

Vercel can host `dist`: choose **Other**, no build command, output directory `dist`. The supplied `vercel.json` configures this. You must separately host the Python backend and proxy `/api/*` to it. Static hosting alone cannot run Shap-E. The app reports an offline backend instead of silently using a shared public GPU service.

Prompts go to your own backend. Only the pretrained model files are downloaded from Hugging Face. The backend is a small evaluation app with local files and an in-memory queue.

## References and authorship

- [Shap-E](https://github.com/openai/shap-e)
- [Diffusers mesh generation](https://huggingface.co/docs/diffusers/api/pipelines/shap_e#generate-mesh)
- [Three.js](https://threejs.org)
- [Docker Spaces](https://huggingface.co/docs/hub/spaces-sdks-docker)

This code was developed with AI assistance. Review and understand it before submission; it cannot honestly be described as entirely human-written.
