# Requirement audit

| Requirement | Implementation and verification |
| --- | --- |
| Enter a text prompt | Browser and backend validate input. Empty, whitespace-only, and oversized prompts are rejected. |
| Generate with an existing AI model | Real pretrained Shap-E inference runs directly on CPU or CUDA. Two different prompts completed on the local CPU; no paid API or public GPU demo is used. |
| Display with a 3D library | Three.js GLTFLoader loaded both generated GLBs. Both objects rendered in the browser with their vertex colors. |
| Rotate and zoom | Drag rotation and wheel zoom were tested on the generated car. OrbitControls also supports touch interaction and pan. |
| Download a 3D format | The website saved the generated car as a GLB. The downloaded file's SHA-256 matches the server's original, and Three.js loaded the downloaded file independently. |
| Free hosting | Full-app Docker configuration is prepared. Deployment is excluded at the user's request. Check the chosen host's current free-tier eligibility and memory allowance; static hosting alone cannot run this model. |
| Live URL and source repository | Local Git repository and source ZIP are prepared. Public repository, live deployment, and both public URLs are left to the user. |

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
- JavaScript syntax checks pass.
- CPU previews took roughly 10–15 minutes each after weights were available; observed peak process working memory was about 3.8 GB. Detailed mode was not timed.

## Remaining publishing work

Push the source repository, deploy the complete backend and frontend, test generation and download on the public deployment, and share both actual URLs. Docker image build has not been verified locally because the Docker daemon was unavailable. No public deployment is claimed.
