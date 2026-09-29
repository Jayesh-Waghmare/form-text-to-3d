import { mkdir, writeFile } from "node:fs/promises";
const files = [
  "build/three.module.js",
  "build/three.core.js",
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/exporters/GLTFExporter.js",
  "examples/jsm/utils/BufferGeometryUtils.js",
];
for (const file of files) {
  const dest =
    "dist/vendor/" + file.replace("build/", "").replace("examples/jsm/", "");
  await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
  const response = await fetch(
    "https://cdn.jsdelivr.net/npm/three@0.180.0/" + file,
  );
  if (!response.ok) throw new Error(file + " HTTP " + response.status);
  await writeFile(dest, await response.text());
}
const license = await (
  await fetch("https://cdn.jsdelivr.net/npm/three@0.180.0/LICENSE")
).text();
await writeFile("dist/vendor/LICENSE", license);
console.log("Vendored Three.js 0.180.0 and required addons.");
