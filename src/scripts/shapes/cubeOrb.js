import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function createCubeOrb() {
  // Slightly rounded edges catch the light much better than a hard box.
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 4, 0.06));

  mesh.userData = {
    shape: "cube",
    radius: 0.45,
    halfSize: new THREE.Vector3(0.45, 0.45, 0.45),
    boxy: true,
    defaultPreset: "glossy",
    rollFactor: 0.55,
  };

  return mesh;
}
