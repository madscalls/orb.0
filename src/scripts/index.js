import {
  scene,
  camera,
  renderer,
  mountRenderer,
  updateLighting,
  handleResize,
} from "./scene.js";

import {
  setShape,
  setupOrbButtons,
  setupDragThrow,
  setupColorPickerModal,
  setupRadialMenu,
  updateOrbPhysics,
  updateOrbGlow,
} from "./orbController.js";

mountRenderer(".orb");

let isNight = false;

const toggle = document.querySelector(".nav__switch");

toggle.addEventListener("change", () => {
  isNight = toggle.checked;
});

setShape("smooth");
setupOrbButtons();
setupDragThrow();
setupColorPickerModal();
setupRadialMenu();

function animate() {
  requestAnimationFrame(animate);

  updateOrbPhysics();
  updateLighting(isNight);
  updateOrbGlow(isNight);

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", handleResize);
