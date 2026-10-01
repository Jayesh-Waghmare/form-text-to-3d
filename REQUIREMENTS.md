# Requirement audit

| Requirement | Implementation and verification |
| --- | --- |
| Enter a text prompt | Browser and backend validate input. Empty, whitespace-only, and oversized prompts are rejected. |
| Generate with an existing AI model | Real pretrained Shap-E inference runs directly on CPU or CUDA. Two different prompts completed on the local CPU; no paid API or public GPU demo is used. |
| Display with a 3D library | Three.js GLTFLoader loaded both generated GLBs. Both objects rendered in the browser with their vertex colors. |
| Rotate and zoom | Drag rotation and wheel zoom were tested on the generated car. OrbitControls also supports touch interaction and pan. |
| Download a 3D format | The website saved the generated car as a GLB. The downloaded file's SHA-256 matches the server's original, and Three.js loaded the downloaded file independently. |
| Free hosting | The public [Gradio ZeroGPU Space](https://huggingface.co/spaces/jayeshw/form-text-to-3d) built and ran on the user's eligible Hugging Face account. A blue-teapot prompt completed on the hosted GPU. |
| Live URL and source repository | The [Space app](https://huggingface.co/spaces/jayeshw/form-text-to-3d) and the complete [GitHub source repository](https://github.com/Jayesh-Waghmare/form-text-to-3d) are public. The Space also has its own [source repository](https://huggingface.co/spaces/jayeshw/form-text-to-3d/tree/main). |

## Genuine generation results

Verified on 29 September 2026, using quick-preview mode (16 inference steps, 96³ surface grid).

| Prompt | Vertices | Faces | GLB bytes | Seed |
| --- | ---: | ---: | ---: | ---: |
| A birthday cupcake | 63,642 | 127,276 | 2,546,752 | 1694210932 |
| A small red toy car | 47,576 | 95,112 | 1,903,728 | 1882139088 |

Both files contain one colored mesh with finite vertex coordinates. Their geometry and colors are visibly different. These are Shap-E outputs, separate from the procedural avocado-chair sample.

The browser-saved car's SHA-256 is `7b99cbda4221c802ccee435a52d3e83e9683f648eece5c051ea6645fb88f0e4e`, matching the server output.

## Other checks

- Eight JavaScript tests and four Python API tests pass.
- All three official model checkpoints passed their published SHA-256 hashes.
- Sample GLB exports and loads back with all nine meshes.
- Completed results reopen from their result URLs while the server retains the job.
- Desktop (1280 px) and mobile (390 px) layouts fit without horizontal overflow. Prompt shortcuts, quality selection, whitespace validation, wireframe controls, and invalid result-link handling were checked in the browser.
- The browser reported no console errors when reopening the generated cupcake.
- Windows startup now stops on failed environment creation, dependency installation, or server startup. Test dependencies are listed separately in `requirements-dev.txt`.
- JavaScript syntax checks pass.
- CPU previews took roughly 10–15 minutes each after weights were available; observed peak process working memory was about 3.8 GB. Detailed mode was not timed.
- On the public ZeroGPU Space, `A small blue teapot` generated a colored mesh. Drag rotation and wheel zoom changed its view. The downloaded GLB was independently parsed by Three.js: 1,465,908 bytes, 36,624 vertices, 73,228 faces, one colored mesh, SHA-256 `06f3f81463be9994718f61c83551b36e0b40bf92cfc885ea922e0a120664c58a`.
- Two later requests from the direct Space host returned Gradio's generic `Error` without a container traceback. The exact scheduler reason was not exposed. The quick allocation was reduced from 120 to 60 seconds to improve queue priority and reduce the quota required for each request; this follow-up adjustment needs a fresh generation check after quota is available.

## Remaining publishing work

Free GPU quotas and queue availability can affect future runs. Retest the 60-second quick mode after the ZeroGPU quota window resets. Docker image build was not verified locally because the Docker daemon was unavailable.
