import * as THREE from "three";

export function createSmoothOrb(color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.15,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64), material);

  mesh.userData.shape = "smooth";

  return mesh;
}
