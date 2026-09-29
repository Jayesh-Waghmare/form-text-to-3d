FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home --uid 1000 appuser
COPY --chown=appuser:appuser backend.py ./
COPY --chown=appuser:appuser dist ./dist
RUN mkdir /app/outputs /app/.model-cache && chown appuser:appuser /app/outputs /app/.model-cache
USER appuser
ENV HF_HOME=/app/.model-cache HF_HUB_DISABLE_TELEMETRY=1 HF_HUB_DISABLE_XET=1
EXPOSE 7860
CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
