import * as THREE from "three";

export function createSmoothOrb() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64));

  mesh.userData = {
    shape: "smooth",
    radius: 0.5,
    defaultPreset: "glossy",
    rollFactor: 1,
  };

  return mesh;
}
