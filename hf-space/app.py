"""Gradio entry point for a free Hugging Face ZeroGPU Space."""

from pathlib import Path
import os

# Local preview shares the verified model cache with the FastAPI version.
if not os.environ.get("SPACE_ID"):
    os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parents[1] / ".model-cache"))

import gradio as gr
import spaces

from model import ShapEGenerator, validate_prompt  # noqa: E402


ROOT = Path(__file__).resolve().parent
SAMPLE = ROOT / "sample.glb"
generator = ShapEGenerator()


def allocation_duration(prompt: str, quality: str) -> int:
    # Reserve one short allocation for the default preview. The longer mode
    # costs more of a visitor's daily ZeroGPU quota.
    return 60 if quality == "Quick preview" else 300


@spaces.GPU(duration=allocation_duration)
def generate_model(prompt: str, quality: str):
    try:
        clean_prompt = validate_prompt(prompt)
        path = generator.generate(clean_prompt, quality)
    except ValueError as error:
        raise gr.Error(str(error)) from error
    return (
        str(path),
        gr.DownloadButton(value=str(path), label="Download generated GLB"),
        f"**AI-generated model ready.** {clean_prompt}",
    )


CSS = """
body { background: var(--body-background-fill); }
.gradio-container { max-width: 1160px !important; }
#intro h1 { font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.055em; line-height: 1.05; }
#intro p { color: var(--body-text-color-subdued); max-width: 60ch; }
#generate-button { background: #ef6b45; color: #fff; border: none; font-weight: 700; }
#model-viewer { min-height: 520px; }
"""

with gr.Blocks(title="Form — Text to 3D") as demo:
    gr.Markdown(
        "# Turn a sentence into a 3D object\n"
        "Describe a single object. Shap-E generates a colored mesh you can inspect and keep.",
        elem_id="intro",
    )
    with gr.Row():
        with gr.Column(scale=1, min_width=300):
            prompt = gr.Textbox(
                label="Your object",
                placeholder="A birthday cupcake with a candle",
                lines=4,
                max_length=800,
            )
            quality = gr.Dropdown(
                ["Quick preview", "Detailed model"],
                value="Quick preview",
                label="Quality",
                info="Detailed mode uses more of your daily GPU quota.",
            )
            generate_button = gr.Button("Generate model", variant="primary", elem_id="generate-button")
            gr.Examples(
                examples=["A birthday cupcake", "A small red toy car", "An avocado chair"],
                inputs=prompt,
            )
            gr.Markdown(
                "**How long will it take?** The first launch loads the pretrained weights. "
                "GPU access is shared and has a daily quota. If a request fails, sign in to "
                "Hugging Face and try again after your quota resets."
            )
        with gr.Column(scale=2, min_width=340):
            model = gr.Model3D(
                value=str(SAMPLE),
                label="3D preview — drag to rotate, scroll or pinch to zoom",
                interactive=False,
                height=500,
                clear_color=(0.11, 0.14, 0.13, 1),
                elem_id="model-viewer",
            )
            download = gr.DownloadButton(value=str(SAMPLE), label="Download sample GLB")
            status = gr.Markdown("**Sample model:** avocado chair. Generate a prompt to replace it.")

    generate_button.click(
        fn=generate_model,
        inputs=[prompt, quality],
        outputs=[model, download, status],
        api_name="generate_3d_model",
        concurrency_limit=1,
        scroll_to_output=True,
    )
    gr.Markdown("Pretrained [OpenAI Shap-E](https://github.com/openai/shap-e) · GLB export")

demo.queue(default_concurrency_limit=1, max_size=8)

if __name__ == "__main__":
    demo.launch(css=CSS, theme=gr.themes.Soft(), show_error=True)
