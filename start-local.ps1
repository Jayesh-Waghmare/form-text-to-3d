$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$taskPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    python -m venv .venv
    & $taskPython -m pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
    & $taskPython -m pip install -r requirements.txt
}
Write-Host 'Open http://127.0.0.1:7860 . First generation downloads the Shap-E weights (about 1.8 GB).'
& $taskPython -m uvicorn backend:app --host 127.0.0.1 --port 7860 --workers 1
