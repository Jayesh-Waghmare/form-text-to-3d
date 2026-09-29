from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
destination = root.parent / "form-source.zip"
items = ["backend.py", "requirements.txt", "Dockerfile", ".dockerignore", ".gitignore",
         "start-local.ps1", "start-local.sh", "vercel.json", "package.json", "README.md",
         "REQUIREMENTS.md", "dist", "scripts", "tests"]
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for item in items:
        path = root / item
        candidates = path.rglob("*") if path.is_dir() else [path]
        for file in candidates:
            if file.is_file() and "__pycache__" not in file.parts and file.suffix != ".pyc":
                archive.write(file, file.relative_to(root).as_posix())
    print(f"Packaged {len(archive.infolist())} source files: {destination}")
