import * as THREE from "three";
import { scene, camera, renderer, orbGlow } from "./scene.js";
import { setupColorPicker } from "./colorPicker.js";

import { createSmoothOrb } from "./shapes/smoothOrb.js";
import { createCubeOrb } from "./shapes/cubeOrb.js";
import { createChaosOrb } from "./shapes/chaosOrb.js";
import { createBlobOrb } from "./shapes/blobOrb.js";

let activeOrb = null;
let orbColor = "#4158d0";

const velocity = new THREE.Vector3();
const spinVelocity = new THREE.Vector3();

const gravity = new THREE.Vector3(0, -0.02, 0);
const bounce = 0.7;
const friction = 0.98;
const cubeFriction = 0.78;
const wallBounce = 0.9;
const spinDamping = 0.94;

let isDragging = false;
let dragStart = null;

let cubeSettling = false;
let cubeTargetRotation = new THREE.Euler();

let colorPickerController = null;

const shapeOrder = ["smooth", "cube", "chaotic", "blob"];
let shapeIndex = 0;

function prepareOrb(orb) {
  orb.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material = child.material.clone();
      }
    }
  });
}

export function setActiveOrb(newOrb) {
  if (activeOrb) {
    scene.remove(activeOrb);
  }

  activeOrb = new THREE.Group();
  activeOrb.add(newOrb);
  activeOrb.position.set(0, 1, 0);

  activeOrb.userData.visual = newOrb;
  activeOrb.userData.shape = newOrb.userData.shape;

  prepareOrb(activeOrb);
  scene.add(activeOrb);

  velocity.set(0, 0, 0);
  spinVelocity.set(0, 0, 0);
  cubeSettling = false;
}

export async function setShape(shape) {
  if (shape === "smooth") setActiveOrb(createSmoothOrb(orbColor));
  if (shape === "cube") setActiveOrb(createCubeOrb(orbColor));
  if (shape === "chaotic") setActiveOrb(await createChaosOrb());
  if (shape === "blob") setActiveOrb(await createBlobOrb());
}

export function updateOrbColor(value) {
  if (!activeOrb) return;

  const isGradient = Array.isArray(value);

  if (!isGradient) {
    orbColor = value;
  }

  activeOrb.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    child.material = child.material.clone();

    if (isGradient) {
      const texture = createGradientTexture(value);

      child.material.map = texture;
      child.material.color.set(0xffffff);
    } else {
      child.material.map = null;
      child.material.color.set(orbColor);
    }

    if (child.material.emissive) {
      child.material.emissive.set(isGradient ? "#ffffff" : orbColor);
    }

    child.material.needsUpdate = true;
  });
}

export function updateOrbGlow(isNight) {
  if (!activeOrb) return;

  const glowStrength = isNight ? 0.35 : 0.05;

  activeOrb.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.emissive = new THREE.Color(orbColor);
      child.material.emissiveIntensity = glowStrength;
    }
  });

  orbGlow.intensity = isNight ? 3.2 : 0.8;
  orbGlow.distance = isNight ? 7 : 4;
}

function startCubeSettle() {
  if (!activeOrb || activeOrb.userData.shape !== "cube") return;

  const visual = activeOrb.userData.visual;
  if (!visual || cubeSettling) return;

  const snap = Math.PI / 2;

  cubeTargetRotation.set(
    Math.round(visual.rotation.x / snap) * snap,
    Math.round(visual.rotation.y / snap) * snap,
    Math.round(visual.rotation.z / snap) * snap,
  );

  cubeSettling = true;
  spinVelocity.set(0, 0, 0);
}

function updateCubeSettle() {
  if (!cubeSettling || !activeOrb) return;

  const visual = activeOrb.userData.visual;
  if (!visual) return;

  visual.rotation.x = THREE.MathUtils.lerp(
    visual.rotation.x,
    cubeTargetRotation.x,
    0.08,
  );

  visual.rotation.y = THREE.MathUtils.lerp(
    visual.rotation.y,
    cubeTargetRotation.y,
    0.08,
  );

  visual.rotation.z = THREE.MathUtils.lerp(
    visual.rotation.z,
    cubeTargetRotation.z,
    0.08,
  );

  const closeEnough =
    Math.abs(visual.rotation.x - cubeTargetRotation.x) < 0.01 &&
    Math.abs(visual.rotation.y - cubeTargetRotation.y) < 0.01 &&
    Math.abs(visual.rotation.z - cubeTargetRotation.z) < 0.01;

  if (closeEnough) {
    visual.rotation.copy(cubeTargetRotation);
    cubeSettling = false;
  }
}

export function setupOrbButtons() {
  document.querySelectorAll("[data-shape]").forEach((button) => {
    button.addEventListener("click", () => {
      setShape(button.dataset.shape);
    });
  });
}

export function setupDragThrow() {
  window.addEventListener("mousedown", (e) => {
    if (e.target.closest(".nav")) return;
    if (e.target.closest(".orb-modal")) return;
    if (e.target.closest(".orb-radial")) return;

    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };

    velocity.set(0, 0, 0);
    spinVelocity.set(0, 0, 0);
    cubeSettling = false;
  });

  window.addEventListener("mouseup", (e) => {
    if (e.target.closest(".nav")) return;
    if (e.target.closest(".orb-modal")) return;
    if (e.target.closest(".orb-radial")) return;

    if (isDragging && dragStart) {
      const dx = (e.clientX - dragStart.x) * 0.008;
      const dz = (e.clientY - dragStart.y) * 0.008;

      velocity.set(dx, 0.2, dz);
      spinVelocity.set(dz * 2.5, 0, -dx * 2.5);

      cubeSettling = false;
      isDragging = false;
    }
  });
}

export function setupRadialMenu() {
  const radial = document.querySelector(".orb-radial");

  renderer.domElement.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    if (!activeOrb || !radial) return;

    const orbScreenPosition = activeOrb.position.clone();
    orbScreenPosition.project(camera);

    const orbX = (orbScreenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const orbY = (-orbScreenPosition.y * 0.5 + 0.5) * window.innerHeight;

    radial.style.left = `${orbX - 60}px`;
    radial.style.top = `${orbY - 60}px`;
    radial.classList.remove("orb-radial_hidden");
  });

  radial?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "close") {
      radial.classList.add("orb-radial_hidden");
      return;
    }

    if (action === "color") {
      const buttonRect = button.getBoundingClientRect();
      const buttonX = buttonRect.left + buttonRect.width / 2;
      const buttonY = buttonRect.top;
      colorPickerController?.open(buttonX, buttonY);
    }

    if (action === "shape") {
      shapeIndex = (shapeIndex + 1) % shapeOrder.length;
      setShape(shapeOrder[shapeIndex]);
    }

    radial.classList.add("orb-radial_hidden");
  });

  window.addEventListener("click", (e) => {
    if (!radial) return;
    if (e.target.closest(".orb-radial")) return;

    radial.classList.add("orb-radial_hidden");
  });
}

export function setupColorPickerModal() {
  colorPickerController = setupColorPicker(updateOrbColor);
}

export function updateOrbPhysics() {
  if (!activeOrb) return;

  const isCube = activeOrb.userData.shape === "cube";

  velocity.add(gravity);
  activeOrb.position.add(velocity);

  const limit = 4.5;

  if (activeOrb.position.x > limit || activeOrb.position.x < -limit) {
    activeOrb.position.x = THREE.MathUtils.clamp(
      activeOrb.position.x,
      -limit,
      limit,
    );

    velocity.x *= -wallBounce;
    spinVelocity.z += -velocity.x * 0.08;
  }

  if (activeOrb.position.z > limit || activeOrb.position.z < -limit) {
    activeOrb.position.z = THREE.MathUtils.clamp(
      activeOrb.position.z,
      -limit,
      limit,
    );

    velocity.z *= -wallBounce;
    spinVelocity.x += velocity.z * 0.08;
  }

  if (activeOrb.position.y <= 0.5) {
    activeOrb.position.y = 0.5;
    velocity.y *= -bounce;

    velocity.x *= isCube ? cubeFriction : friction;
    velocity.z *= isCube ? cubeFriction : friction;

    if (isCube) {
      spinVelocity.x += Math.sign(velocity.z) * Math.abs(velocity.z) * 0.18;
      spinVelocity.z += -Math.sign(velocity.x) * Math.abs(velocity.x) * 0.18;
    } else {
      spinVelocity.x += velocity.z * 0.04;
      spinVelocity.z += -velocity.x * 0.04;
    }

    if (Math.abs(velocity.y) < 0.01) {
      velocity.y = 0;
    }

    if (isCube && velocity.length() < 0.035 && spinVelocity.length() < 0.035) {
      startCubeSettle();
    }
  }

  const visual = activeOrb.userData.visual;

  if (visual && !cubeSettling) {
    if (isCube) {
      visual.rotation.x +=
        Math.sign(spinVelocity.x) * Math.min(Math.abs(spinVelocity.x), 0.12);

      visual.rotation.y +=
        Math.sign(spinVelocity.y) * Math.min(Math.abs(spinVelocity.y), 0.04);

      visual.rotation.z +=
        Math.sign(spinVelocity.z) * Math.min(Math.abs(spinVelocity.z), 0.12);
    } else {
      visual.rotation.x += spinVelocity.x;
      visual.rotation.y += spinVelocity.y;
      visual.rotation.z += spinVelocity.z;
    }

    spinVelocity.multiplyScalar(spinDamping);
  }

  updateCubeSettle();

  orbGlow.position.copy(activeOrb.position);
  orbGlow.color.set(orbColor);
}

//gradient
function createGradientTexture(stops) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

  stops.forEach((stop) => {
    gradient.addColorStop(stop.stop, `#${stop.color}`);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return texture;
}
