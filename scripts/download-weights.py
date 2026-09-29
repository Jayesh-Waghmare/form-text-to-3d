"""Optional Windows download helper when the Hub's Python transfer stalls.

Downloads the official checkpoints in bounded parallel ranges using curl,
checks their published SHA-256 hashes, and fills the normal Hugging Face cache.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import hashlib
import re
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
cache = root / '.model-cache' / 'hub' / 'models--openai--shap-e'
parts = root / '.model-cache' / 'download-parts'
parts.mkdir(parents=True, exist_ok=True)
files = ['prior/diffusion_pytorch_model.fp16.safetensors',
         'text_encoder/model.fp16.safetensors',
         'shap_e_renderer/diffusion_pytorch_model.bin']

def run(*args):
    return subprocess.run(['curl.exe', '--fail', '--silent', '--show-error', *args],
                          check=True, capture_output=True, text=True).stdout

for filename in files:
    url = 'https://huggingface.co/openai/shap-e/resolve/main/' + filename
    headers = run('--head', '--max-time', '60', url)
    size = int(re.search(r'(?im)^x-linked-size:\s*(\d+)', headers)[1])
    digest = re.search(r'(?im)^x-linked-etag:\s*"([a-f0-9]{64})"', headers)[1]
    revision = re.search(r'(?im)^x-repo-commit:\s*([a-f0-9]{40})', headers)[1]
    destination = cache / 'snapshots' / revision / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size == size:
        with destination.open('rb') as source:
            verified = hashlib.file_digest(source, 'sha256').hexdigest() == digest
        if verified:
            print(filename, 'already verified', flush=True)
            continue
    chunk_size = 8 * 1024 * 1024
    ranges = [(i, start, min(start + chunk_size, size) - 1)
              for i, start in enumerate(range(0, size, chunk_size))]
    def download(entry):
        index, start, end = entry
        part = parts / f'{digest}-{index}.part'
        if not part.exists() or part.stat().st_size != end - start + 1:
            run('--location', '--retry', '3', '--max-time', '240',
                '--range', f'{start}-{end}', '--output', str(part), url)
        if part.stat().st_size != end - start + 1:
            raise ValueError('Incomplete checkpoint range')
        return part
    print(filename, f'{size / 1e6:.0f} MB', flush=True)
    completed = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        for future in as_completed([pool.submit(download, entry) for entry in ranges]):
            future.result()
            completed += 1
            print(f'  {completed}/{len(ranges)} chunks', flush=True)
    temporary = destination.with_suffix(destination.suffix + '.partial')
    with temporary.open('wb') as output:
        for index, _, _ in ranges:
            with (parts / f'{digest}-{index}.part').open('rb') as source:
                shutil.copyfileobj(source, output)
    with temporary.open('rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != digest:
            raise ValueError('Checkpoint SHA-256 mismatch')
    temporary.replace(destination)
    for index, _, _ in ranges:
        (parts / f'{digest}-{index}.part').unlink()
    (cache / 'refs').mkdir(parents=True, exist_ok=True)
    (cache / 'refs' / 'main').write_text(revision)
    print(filename, 'SHA-256 verified', flush=True)
