import * as THREE from "three";

export function createCubeOrb(color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.12,
  });

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), material);

  mesh.userData.shape = "cube";

  return mesh;
}
