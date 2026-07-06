import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export function createBlobOrb() {
  return new Promise((resolve, reject) => {
    loader.load(
      "/models/orb.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(0.6);
        model.userData.shape = "blob";
        resolve(model);
      },
      undefined,
      reject,
    );
  });
}
