import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export function createChaosOrb() {
  return new Promise((resolve, reject) => {
    loader.load(
      "/models/bumpyOrb.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(0.6);
        model.userData.shape = "chaotic";
        resolve(model);
      },
      undefined,
      reject,
    );
  });
}
