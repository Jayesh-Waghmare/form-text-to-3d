import { register } from "node:module";
import { writeFile } from "node:fs/promises";
register("./three-loader.mjs", import.meta.url);
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((bytes) => {
      this.result =
        "data:" +
        blob.type +
        ";base64," +
        Buffer.from(bytes).toString("base64");
      this.onloadend?.();
    });
  }
};
const { sampleChair } = await import("../dist/sample.js");
const { GLTFExporter } =
  await import("../dist/vendor/exporters/GLTFExporter.js");
const { GLTFLoader } = await import("../dist/vendor/loaders/GLTFLoader.js");
const bytes = await new GLTFExporter().parseAsync(sampleChair(), {
  binary: true,
});
const loaded = await new GLTFLoader().parseAsync(bytes, "");
let meshes = 0;
loaded.scene.traverse((object) => {
  if (object.isMesh) meshes++;
});
if (meshes !== 9) throw new Error("Sample GLB round-trip lost geometry.");
await writeFile("dist/sample.glb", new Uint8Array(bytes));
console.log(JSON.stringify({ format: "glb", bytes: bytes.byteLength, meshes }));
