---
title: Form Text to 3D
emoji: 🧊
colorFrom: green
colorTo: yellow
sdk: gradio
sdk_version: 6.16.0
python_version: 3.12.12
app_file: app.py
preload_from_hub:
  - openai/shap-e prior/diffusion_pytorch_model.fp16.safetensors,text_encoder/model.fp16.safetensors,shap_e_renderer/diffusion_pytorch_model.bin
---

# Form — Text to 3D (ZeroGPU edition)

Describe an object, generate a GLB using the pretrained OpenAI Shap-E model,
rotate and zoom it in Gradio's 3D viewer, and download the result.

## Publishing

This directory is the **root of a separate Hugging Face Gradio Space**. Select
**ZeroGPU** in the Space hardware settings. Upload these files together:
`README.md`, `app.py`, `model.py`, `requirements.txt`, and `sample.glb`.
The top-level project's `README.md` and `Dockerfile` belong to the separate
FastAPI edition and must not replace this Space README.

Free ZeroGPU hosting requires a verified personal Hugging Face account older
than 30 days and is subject to daily GPU quota and queue availability. The
official checkpoints are preloaded during the Space build. The default quick mode
reserves up to one GPU minute; detailed mode reserves up to five. Actual
hosted runtime and generation quality must be verified on the live Space.

Local development uses CPU automatically when CUDA is unavailable. Set
`HF_HOME` to another directory if you do not want to use the project's shared
model cache.

The sample avocado chair is procedural. Generated output uses Shap-E. This
code was developed with AI assistance and should be reviewed before submission.
