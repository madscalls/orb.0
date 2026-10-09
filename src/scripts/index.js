import * as THREE from "three";
import {
  scene,
  renderer,
  mountRenderer,
  updateLighting,
  handleResize,
  render,
} from "./scene.js";
import { setupEnvironment } from "./materials.js";
import {
  setShape,
  setupPointerControls,
  setupColorPickerModal,
  setupRadialMenu,
  setupTrail,
  setupKeyboardControls,
  setupShapeButtons,
  setupPhysicsModal,
  getOrbBody,
  getOrbPosition,
  showToast,
  updateOrb,
} from "./orbController.js";
import { setupProps, updateProps } from "./props/propsController.js";
import { nightFactor } from "./scene.js";

mountRenderer(".orb");
setupEnvironment(renderer, scene);

let isNight = false;
const toggle = document.querySelector(".nav__switch");

function setNight(on) {
  isNight = on;
  document.body.classList.toggle("is-night", on);
}

toggle.addEventListener("change", () => setNight(toggle.checked));
setNight(toggle.checked);

setShape("smooth");
setupPointerControls();
setupColorPickerModal();
setupRadialMenu();
setupTrail();
setupKeyboardControls();
setupShapeButtons();
setupPhysicsModal();
setupProps({ toast: showToast, getOrbPosition });

// One-time hint for keyboard users.
if (window.matchMedia("(pointer: fine)").matches) {
  setTimeout(() => showToast("arrows drive · space jumps · K kitty · L lamp · Y yoyo · O octopus · right-click for menu", 5000), 1200);
}

const timer = new THREE.Timer();
timer.connect(document); // pauses cleanly when the tab is hidden

function animate(time) {
  timer.update(time);
  // Clamp so a slow frame doesn't teleport the orb.
  const rawDt = timer.getDelta();
  const dt = Math.min(rawDt, 1 / 30);
  const elapsed = timer.getElapsed();

  // The day/night fade runs on real time, even on a slow device.
  updateLighting(isNight, Math.min(rawDt, 0.25), elapsed);
  scene.environmentIntensity = THREE.MathUtils.lerp(0.6, 0.08, nightFactor);
  updateOrb(dt, elapsed, nightFactor);
  updateProps(dt, nightFactor, getOrbBody());

  render();
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", handleResize);
