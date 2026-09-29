import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { sampleChair } from "./sample.js";
import {
  generateLocalModel,
  getBackend,
  validatePrompt,
} from "./generation.js";

const $ = (id) => document.getElementById(id);
const host = $("canvas-host");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#252a27");
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor("#252a27");
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1;
controls.maxDistance = 12;
controls.autoRotateSpeed = 1;
controls.maxPolarAngle = Math.PI * 0.92;
const ambient = new THREE.HemisphereLight("#e5efd8", "#2a3328", 2.5);
scene.add(ambient);
const key = new THREE.DirectionalLight("#fff1db", 4);
key.position.set(3, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
scene.add(key);
const fill = new THREE.DirectionalLight("#a7d1ad", 1.8);
fill.position.set(-3, 2, -4);
scene.add(fill);
const grid = new THREE.GridHelper(20, 40, "#5a6553", "#394339");
grid.position.y = -0.006;
scene.add(grid);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.ShadowMaterial({ opacity: 0.25 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
let model,
  busy = false,
  controller;
let wireframe = false;

function dispose(object) {
  object.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      for (const m of [].concat(o.material)) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    }
  });
}
function resetCamera() {
  camera.position.set(3.8, 2.8, 4.6);
  controls.target.set(0, 1, 0);
  controls.update();
}
function setModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  if (box.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0)
    throw new Error("The generated file contains no visible geometry.");
  const scale = 2.3 / Math.max(size.x, size.y, size.z);
  object.scale.multiplyScalar(scale);
  const updated = new THREE.Box3().setFromObject(object),
    center = updated.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= updated.min.y;
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      for (const m of [].concat(o.material)) m.wireframe = wireframe;
    }
  });
  if (model) {
    scene.remove(model);
    dispose(model);
  }
  model = object;
  scene.add(model);
  resetCamera();
}

setModel(sampleChair());
new ResizeObserver(() => {
  const { width, height } = host.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(host);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
$("reset").onclick = resetCamera;
$("rotate").onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  $("rotate").setAttribute("aria-pressed", String(controls.autoRotate));
};
$("wireframe").onclick = () => {
  wireframe = !wireframe;
  $("wireframe").setAttribute("aria-pressed", String(wireframe));
  model.traverse((o) => {
    if (o.isMesh)
      for (const m of [].concat(o.material)) m.wireframe = wireframe;
  });
};
function feedback(text, type = "") {
  $("feedback").textContent = text;
  $("feedback").className = "feedback " + type;
}
function updateEngine(health) {
  if (health) {
    $("engine-note").textContent = health.ready
      ? "Shap-E is loaded and ready."
      : "Shap-E loads on your first generation.";
    $("engine-detail").textContent =
      health.device === "cuda"
        ? "Generation runs on this server’s GPU."
        : "Generation runs on this server’s CPU. It can take several minutes.";
  } else {
    $("engine-note").textContent = "Model server is offline.";
    $("engine-detail").textContent =
      "Start the Python backend to generate a model.";
  }
}
getBackend().then(updateEngine);
$("prompt").addEventListener("input", () => {
  $("count").textContent = `${$("prompt").value.length} / 800`;
});
document.querySelectorAll("[data-prompt]").forEach(
  (button) =>
    (button.onclick = () => {
      $("prompt").value = button.dataset.prompt;
      $("prompt").dispatchEvent(new Event("input"));
      $("prompt").focus();
    }),
);
function setBusy(value) {
  busy = value;
  $("generate").disabled = value;
  $("prompt").disabled = value;
  $("quality").disabled = value;
  $("cancel").hidden = !value;
  $("loading").hidden = !value;
  $("download").setAttribute("aria-disabled", String(value));
  document
    .querySelectorAll("[data-prompt]")
    .forEach((b) => (b.disabled = value));
}

async function displayResult(result, signal) {
  if (
    !/^[a-f0-9]{32}$/.test(result.id) ||
    result.url !== `/api/models/${result.id}.glb`
  )
    throw new Error("The model server returned an invalid file.");
  const response = await fetch(result.url, { signal });
  if (!response.ok)
    throw new Error("The model could not be downloaded. Please retry.");
  const bytes = await response.arrayBuffer();
  if (
    bytes.byteLength < 12 ||
    new DataView(bytes).getUint32(0, true) !== 0x46546c67
  )
    throw new Error("The server returned an invalid GLB file.");
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  if (signal?.aborted) {
    dispose(gltf.scene);
    signal.throwIfAborted();
  }
  setModel(gltf.scene);
  $("download").href = result.url;
  $("download").download = "form-model.glb";
  $("model-label").textContent = "GENERATED / " + result.prompt;
  $("view-status").textContent = "AI-generated · Shap-E";
  $("download").querySelector("span").textContent = "Download GLB";
  feedback(
    "Your model is ready. Rotate it to explore, or download the GLB to keep it.",
    "success",
  );
  $("engine-note").textContent = "Shap-E is loaded and ready.";
}

async function generate(prompt) {
  if (busy) throw new Error("A generation is already in progress.");
  try {
    prompt = validatePrompt(prompt);
  } catch (error) {
    feedback(error.message, "error");
    throw error;
  }
  controller = new AbortController();
  setBusy(true);
  $("loading-title").textContent = "Joining the generation queue…";
  $("elapsed").textContent = "0:00";
  feedback(
    "Preparing generation. Keep this page open while your model is built.",
  );
  const started = Date.now();
  let timedOut = false;
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    $("elapsed").textContent =
      Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }, 1000);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 3600000);
  try {
    const health = await getBackend();
    updateEngine(health);
    if (!health)
      throw new Error(
        "The model server is offline. Start the Python backend and try again.",
      );
    controller.signal.throwIfAborted();
    $("loading-detail").textContent =
      "The first run downloads the weights. Later runs reuse them.";
    const result = await generateLocalModel(prompt, {
      quality: $("quality").value,
      signal: controller.signal,
      onStatus: (text) => ($("loading-title").textContent = text),
    });
    await displayResult(result, controller.signal);
    try {
      sessionStorage.setItem("form-prompt-" + result.id, prompt);
    } catch {}
    history.replaceState(null, "", "?model=" + result.id);
    return { status: "complete", prompt, format: "glb" };
  } catch (error) {
    const message = timedOut
      ? "Generation exceeded one hour. Check the server log before retrying."
      : controller.signal.aborted
        ? "Generation cancelled. Your previous model is still available."
        : error.message ||
          "Could not connect to the generation service. Please retry later.";
    feedback(message, controller.signal.aborted && !timedOut ? "" : "error");
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
    clearInterval(timer);
    setBusy(false);
    controller = null;
  }
}
$("prompt-form").onsubmit = (e) => {
  e.preventDefault();
  generate($("prompt").value).catch(() => {});
};
$("cancel").onclick = () => controller?.abort();
$("download").onclick = (event) => {
  if (busy) event.preventDefault();
};
const savedId = new URLSearchParams(location.search).get("model");
if (savedId) {
  (async () => {
    controller = new AbortController();
    setBusy(true);
    $("loading-title").textContent = "Opening your saved model…";
    try {
      if (!/^[a-f0-9]{32}$/.test(savedId))
        throw new Error("This model link is invalid.");
      const response = await fetch("/api/jobs/" + savedId, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "This saved model has expired or the server has restarted. Generate a new model.",
        );
      const job = await response.json();
      if (job.status !== "complete")
        throw new Error("This model is not ready yet.");
      let prompt = "Saved result";
      try {
        prompt = sessionStorage.getItem("form-prompt-" + savedId) || prompt;
      } catch {}
      await displayResult({ ...job, id: savedId, prompt }, controller.signal);
    } catch (error) {
      feedback(
        controller.signal.aborted ? "Opening cancelled." : error.message,
        "error",
      );
    } finally {
      controller = null;
      setBusy(false);
    }
  })();
}
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(
    document.modelContext.registerTool(
      {
        name: "generate_3d_model",
        description:
          "Generate a Shap-E 3D model from a prompt and display it in the viewer.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", minLength: 1, maxLength: 800 },
          },
          required: ["prompt"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const prompt = validatePrompt(input?.prompt);
          $("prompt").value = prompt;
          $("prompt").dispatchEvent(new Event("input"));
          return generate(prompt);
        },
      },
      { signal: lifecycle.signal },
    ),
  ).catch(console.error);
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
