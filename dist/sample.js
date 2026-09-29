import * as THREE from "./vendor/three.module.js";

export function sampleChair() {
  const group = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({
    color: "#8fa968",
    roughness: 0.75,
  });
  const cream = new THREE.MeshStandardMaterial({
    color: "#d7ddb1",
    roughness: 0.8,
  });
  const brown = new THREE.MeshStandardMaterial({
    color: "#87583a",
    roughness: 0.9,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: "#a28c69",
    roughness: 0.85,
  });
  function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    group.add(m);
    return m;
  }
  mesh(
    new THREE.SphereGeometry(1, 48, 32),
    green,
    0,
    1.68,
    -0.27,
    0.75,
    1,
    0.22,
  );
  mesh(
    new THREE.SphereGeometry(1, 48, 32),
    cream,
    0,
    1.7,
    -0.08,
    0.62,
    0.85,
    0.1,
  );
  mesh(
    new THREE.SphereGeometry(0.28, 32, 24),
    brown,
    0,
    1.42,
    0.015,
    1,
    1,
    0.38,
  );
  mesh(
    new THREE.SphereGeometry(1, 48, 24),
    green,
    0,
    0.85,
    0.13,
    0.79,
    0.19,
    0.7,
  );
  mesh(
    new THREE.SphereGeometry(1, 48, 24),
    cream,
    0,
    0.96,
    0.13,
    0.67,
    0.09,
    0.58,
  );
  for (const x of [-0.48, 0.48])
    for (const z of [-0.28, 0.48]) {
      const leg = mesh(
        new THREE.CylinderGeometry(0.055, 0.042, 0.78, 16),
        wood,
        x,
        0.4,
        z,
      );
      leg.rotation.z = x > 0 ? -0.12 : 0.12;
      leg.rotation.x = z > 0 ? 0.12 : -0.12;
    }
  return group;
}
