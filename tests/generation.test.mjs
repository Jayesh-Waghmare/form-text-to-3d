import test from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalModel,
  getBackend,
  validatePrompt,
} from "../dist/generation.js";

const id = "a".repeat(32);
test("prompt validation rejects empty input and oversized prompts", () => {
  assert.throws(() => validatePrompt("   "));
  assert.throws(() => validatePrompt("a".repeat(801)));
  assert.equal(validatePrompt(" A chair "), "A chair");
});
test("health distinguishes this service from static hosting", async () => {
  assert.equal(
    await getBackend(async () => new Response("<html>", { status: 502 })),
    null,
  );
  assert.equal(
    await getBackend(async () => Response.json({ service: "another-app" })),
    null,
  );
  assert.equal(
    (
      await getBackend(async () =>
        Response.json({ service: "form-shap-e", ready: true }),
      )
    ).ready,
    true,
  );
});
test("generation submits the prompt and waits for a completed local model", async () => {
  let posted,
    count = 0;
  const fetcher = async (url, options) => {
    if (options?.method === "POST") {
      posted = JSON.parse(options.body);
      return Response.json({ id });
    }
    return Response.json(
      ++count === 1
        ? { status: "generating", message: "Generating…" }
        : { status: "complete", url: "/api/models/" + id + ".glb", faces: 100 },
    );
  };
  const result = await generateLocalModel(" A cupcake ", {
    fetcher,
    pollMs: 1,
  });
  assert.deepEqual(posted, { prompt: "A cupcake", quality: "draft" });
  assert.equal(result.faces, 100);
  assert.equal(result.url, "/api/models/" + id + ".glb");
});
test("remote or malformed model file paths are rejected", async () => {
  const fetcher = async (url, options) =>
    options?.method === "POST"
      ? Response.json({ id })
      : Response.json({
          status: "complete",
          url: "https://example.com/model.glb",
        });
  await assert.rejects(
    generateLocalModel("A cupcake", { fetcher }),
    /invalid file/,
  );
});
test("backend failures never become successful generation", async () => {
  const fetcher = async (url, options) =>
    options?.method === "POST"
      ? Response.json({ id })
      : Response.json({ status: "failed", message: "Model loading failed" });
  await assert.rejects(
    generateLocalModel("A cupcake", { fetcher }),
    /Model loading failed/,
  );
});
test("queue-full errors preserve the useful server message", async () => {
  await assert.rejects(
    generateLocalModel("A chair", {
      fetcher: async () =>
        Response.json(
          { detail: "The generation queue is full." },
          { status: 429 },
        ),
    }),
    /queue is full/,
  );
});
test("invalid job IDs are rejected before polling", async () => {
  await assert.rejects(
    generateLocalModel("A chair", {
      fetcher: async () => Response.json({ id: "../unsafe" }),
    }),
    /invalid job/,
  );
});
test("cancellation requests that the backend stop the active job", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const fetcher = async (url, options) => {
    if (options?.method === "POST") return Response.json({ id });
    if (options?.method === "DELETE") {
      cancelled = true;
      return Response.json({});
    }
    return Response.json({ status: "generating" });
  };
  await assert.rejects(
    generateLocalModel("A chair", {
      fetcher,
      signal: controller.signal,
      onStatus: () => controller.abort(),
      pollMs: 1,
    }),
  );
  assert.equal(cancelled, true);
});
