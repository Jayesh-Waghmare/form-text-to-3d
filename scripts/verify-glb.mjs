import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { register } from "node:module";

register("./three-loader.mjs", import.meta.url);
const { GLTFLoader } = await import("../dist/vendor/loaders/GLTFLoader.js");
const filename = process.argv[2];
if (!filename) throw new Error("Pass a GLB filename to verify.");
const file = await readFile(filename);
const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.length);
const header = new DataView(bytes);
if (
  file.length < 12 ||
  header.getUint32(0, true) !== 0x46546c67 ||
  header.getUint32(4, true) !== 2
)
  throw new Error("Not a GLB 2.0 file.");
const gltf = await new GLTFLoader().parseAsync(bytes, "");
let meshes = 0,
  vertices = 0,
  faces = 0,
  coloredMeshes = 0;
gltf.scene.traverse((object) => {
  if (!object.isMesh) return;
  const positions = object.geometry.attributes.position;
  if (!positions.array.every(Number.isFinite))
    throw new Error("Non-finite vertices.");
  meshes++;
  vertices += positions.count;
  faces += (object.geometry.index?.count || positions.count) / 3;
  if (object.geometry.attributes.color) coloredMeshes++;
});
if (!meshes || !vertices || !faces) throw new Error("No renderable geometry.");
console.log(
  JSON.stringify({
    filename,
    bytes: file.length,
    meshes,
    vertices,
    faces,
    coloredMeshes,
    sha256: createHash("sha256").update(file).digest("hex"),
  }),
);
