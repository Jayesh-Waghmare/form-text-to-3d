import { writeFile } from "node:fs/promises";
import { register } from "node:module";
register("./three-loader.mjs", import.meta.url);
const { GLTFLoader } = await import("../dist/vendor/loaders/GLTFLoader.js");
const base = "http://127.0.0.1:8000";
const prompt = process.argv[2] || "A birthday cupcake";
const response = await fetch(base + "/api/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, quality: "draft" }),
});
if (!response.ok) throw new Error(await response.text());
const { id } = await response.json();
let lastMessage;
for (let count = 0; count < 2400; count++) {
  const job = await (await fetch(base + "/api/jobs/" + id)).json();
  if (job.message !== lastMessage) {
    console.log(job.status, job.message);
    lastMessage = job.message;
  }
  if (job.status === "failed") throw new Error(job.message);
  if (job.status === "complete") {
    const bytes = await (await fetch(base + job.url)).arrayBuffer();
    if (new DataView(bytes).getUint32(0, true) !== 0x46546c67)
      throw new Error("Invalid GLB magic");
    const gltf = await new GLTFLoader().parseAsync(bytes, "");
    let meshes = 0,
      coloredMeshes = 0;
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      meshes++;
      if (!object.geometry.attributes.position.array.every(Number.isFinite))
        throw new Error("Non-finite geometry");
      if (object.geometry.attributes.color) coloredMeshes++;
    });
    if (!meshes) throw new Error("Three.js could not load any meshes");
    const filename =
      "outputs/verified-" +
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60) +
      ".glb";
    await writeFile(filename, new Uint8Array(bytes));
    console.log(
      JSON.stringify({
        id,
        prompt,
        filename,
        bytes: bytes.byteLength,
        meshes,
        coloredMeshes,
        vertices: job.vertices,
        faces: job.faces,
        seed: job.seed,
        url: job.url,
      }),
    );
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (count === 2399) throw new Error("Generation exceeded one hour.");
}
