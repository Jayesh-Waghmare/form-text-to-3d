export function validatePrompt(value) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Describe an object before generating.");
  if (value.trim().length > 800)
    throw new Error("Keep your prompt under 800 characters.");
  return value.trim();
}

export async function getBackend(fetcher = fetch) {
  try {
    const response = await fetcher("/api/health", {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const health = await response.json();
      if (health.service === "form-shap-e") return health;
    }
  } catch {}
  return null;
}

export async function generateLocalModel(
  prompt,
  {
    signal,
    onStatus = () => {},
    fetcher = fetch,
    quality = "draft",
    pollMs = 1500,
  } = {},
) {
  prompt = validatePrompt(prompt);
  const response = await fetcher("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, quality }),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "The model server could not accept this prompt.",
    );
  }
  const { id } = await response.json();
  if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id))
    throw new Error("The model server returned an invalid job.");
  const cancel = () => {
    fetcher("/api/jobs/" + id, { method: "DELETE", keepalive: true }).catch(
      () => {},
    );
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const status = await fetcher("/api/jobs/" + id, { signal });
      if (!status.ok)
        throw new Error("The model server lost this job. Please try again.");
      const job = await status.json();
      onStatus(job.message || "Generating your model…");
      signal?.throwIfAborted();
      if (job.status === "complete") {
        if (job.url !== "/api/models/" + id + ".glb")
          throw new Error("The model server returned an invalid file.");
        return {
          id,
          url: job.url,
          prompt,
          seed: job.seed,
          vertices: job.vertices,
          faces: job.faces,
        };
      }
      if (job.status === "failed" || job.status === "cancelled")
        throw new Error(job.message || "Generation failed.");
      await new Promise((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", abort);
          resolve();
        }, pollMs);
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
