#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
  .venv/bin/python -m pip install -r requirements.txt
fi
printf 'Open http://127.0.0.1:7860 . First generation downloads approximately 1.8 GB of weights.\n'
exec .venv/bin/python -m uvicorn backend:app --host 127.0.0.1 --port 7860 --workers 1
