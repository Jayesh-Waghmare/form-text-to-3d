$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$taskPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
    & $taskPython -m pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
    if ($LASTEXITCODE -ne 0) { throw 'Could not install CPU PyTorch. Rerun the install command in README.md.' }
    & $taskPython -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Could not install dependencies. Rerun the install command in README.md.' }
}
Write-Host 'Open http://127.0.0.1:7860 . First generation downloads the Shap-E weights (about 1.8 GB).'
& $taskPython -m uvicorn backend:app --host 127.0.0.1 --port 7860 --workers 1
if ($LASTEXITCODE -ne 0) { throw 'The model server exited with an error. Check the message above.' }
