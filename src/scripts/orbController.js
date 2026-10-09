import * as THREE from "three";
import {
  scene,
  camera,
  renderer,
  orbGlow,
  glowPool,
  bounds,
} from "./scene.js";
import { setupColorPicker } from "./colorPicker.js";
import {
  PRESET_ORDER,
  PRESETS,
  buildOrbMaterial,
  createGradientTexture,
  gradientAverage,
  disposeMaterial,
} from "./materials.js";
import { createTrail } from "./trail.js";
import { physics, setupSettingsModal } from "./settings.js";
import { orbStatus, isSlipping, isAsleep } from "./orbStatus.js";
import {
  pickProp,
  beginPropDrag,
  movePropDrag,
  endPropDrag,
  setPropColor,
  propLabel,
} from "./props/propsController.js";
import { createGlowTrail } from "./glowTrail.js";

import { createSmoothOrb } from "./shapes/smoothOrb.js";
import { createCubeOrb } from "./shapes/cubeOrb.js";
import { createChaosOrb } from "./shapes/chaosOrb.js";
import { createBlobOrb } from "./shapes/blobOrb.js";

// ---------- tuning ----------
// Physics values are "per frame at 60fps" and get scaled by the real frame
// time, so the orb moves at the same speed on 60Hz, 120Hz and slow devices.

const GRAVITY = -0.02;
const WALL_BOUNCE = 0.75;
const GROUND_FRICTION = 0.985;
const CUBE_FRICTION = 0.9;
const AIR_SPIN_DAMPING = 0.995;
const REST_SPEED = 0.04; // impacts slower than this stop instead of bouncing
const MAX_THROW = 0.55;

// Driving with the arrow keys / WASD.
const DRIVE_ACCEL = 0.009; // push per frame on the ground
const AIR_CONTROL = 0.35; // fraction of that push while airborne
const DRIVE_FRICTION = 0.955; // grip while a key is held (same for every shape)
const MAX_DRIVE_SPEED = 0.2;
// A heavier orb comes out of a throw slower.
const throwScale = () => 1 / Math.sqrt(physics.weight);
const JUMP_SPEED = 0.34;

// ---------- state ----------

const shapeFactories = {
  smooth: createSmoothOrb,
  cube: createCubeOrb,
  chaotic: createChaosOrb,
  blob: createBlobOrb,
};
const shapeLabels = {
  smooth: "orb",
  cube: "cube",
  chaotic: "chaos",
  blob: "blob",
};

let activeOrb = null; // Group: position lives here
let visual = null; // Mesh: rotation / shape live here
let loadToken = 0;

let appearance = { color: "#4158d0" };
let gradientTexture = null;
let presetKey = null; // null = the shape's own default finish
const glowColor = new THREE.Color("#4158d0");

const velocity = new THREE.Vector3();
const spin = new THREE.Vector3(); // angular velocity (world axis * rad/frame)
let grounded = false;
let settling = false;

let trail = null;
let glowTrail = null;
const keys = new Set();
let jumpQueued = false;
let colorPickerController = null;
let colorTarget = null; // null = the orb, otherwise a prop
let settingsModal = null;
let radial = null;
let radialOpenedAt = 0;
let toastEl = null;
let toastTimer = null;

// pointer
const pointer = {
  id: null,
  mode: null, // "grab" | "flick"
  startX: 0,
  startY: 0,
  startTime: 0,
  moved: 0,
};
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const grabPlane = new THREE.Plane();
const grabOffset = new THREE.Vector3();
const grabTarget = new THREE.Vector3();
const hitPoint = new THREE.Vector3();

// scratch objects (no per-frame allocations)
const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const snapQ = new THREE.Quaternion();
const prevPos = new THREE.Vector3();
const extents = new THREE.Vector3();
const normals = {
  floor: new THREE.Vector3(0, 1, 0),
  px: new THREE.Vector3(-1, 0, 0),
  nx: new THREE.Vector3(1, 0, 0),
  pz: new THREE.Vector3(0, 0, -1),
  nz: new THREE.Vector3(0, 0, 1),
};

// ---------- shapes ----------

export async function setShape(shape) {
  const token = ++loadToken;
  let mesh;
  try {
    mesh = await shapeFactories[shape]();
  } catch (err) {
    console.error(`Could not load the ${shape} shape`, err);
    showToast(`couldn't load ${shapeLabels[shape]}`);
    return;
  }
  // A newer shape was picked while this one was loading.
  if (token !== loadToken) return;

  const keepPosition = activeOrb ? activeOrb.position.clone() : null;

  if (activeOrb) {
    scene.remove(activeOrb);
    disposeMaterial(visual.material);
  }

  activeOrb = new THREE.Group();
  activeOrb.add(mesh);
  visual = mesh;
  visual.castShadow = true;
  visual.receiveShadow = true;

  // Drop the new shape in where the old one was.
  if (keepPosition) activeOrb.position.set(keepPosition.x, 1.6, keepPosition.z);
  else activeOrb.position.set(0, 1.2, 0);

  scene.add(activeOrb);
  glowTrail?.reset(activeOrb.position);

  document.querySelectorAll("[data-shape]").forEach((button) => {
    const active = button.dataset.shape === shape;
    button.classList.toggle("nav__shape_active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  velocity.set(0, 0, 0);
  spin.set(0, 0, 0);
  settling = false;

  applyAppearance();
}

function applyAppearance() {
  if (!visual) return;
  const key = presetKey ?? visual.userData.defaultPreset;
  const material = buildOrbMaterial(appearance, key, gradientTexture);
  visual.userData.patchMaterial?.(material);
  disposeMaterial(visual.material);
  visual.material = material;
}

export function updateOrbColor(value) {
  if (gradientTexture) {
    gradientTexture.dispose();
    gradientTexture = null;
  }

  if (Array.isArray(value)) {
    appearance = { gradient: value };
    gradientTexture = createGradientTexture(value);
    gradientAverage(value, glowColor);
  } else {
    appearance = { color: value };
    glowColor.set(value);
  }

  applyAppearance();
}

function currentFinish() {
  return presetKey ?? visual?.userData.defaultPreset ?? "glossy";
}

function setFinish(key) {
  presetKey = key;
  applyAppearance();
}

// ---------- extents (how far the shape reaches along each world axis) ----------

function updateExtents() {
  const data = visual.userData;
  if (data.halfExtent) {
    extents.set(data.halfExtent(0), data.halfExtent(1), data.halfExtent(2));
  } else if (data.boxy) {
    // Rotated box: project each half-size onto the world axes.
    const e = tmpM.makeRotationFromQuaternion(visual.quaternion).elements;
    const h = data.halfSize;
    extents.set(
      Math.abs(e[0]) * h.x + Math.abs(e[4]) * h.y + Math.abs(e[8]) * h.z,
      Math.abs(e[1]) * h.x + Math.abs(e[5]) * h.y + Math.abs(e[9]) * h.z,
      Math.abs(e[2]) * h.x + Math.abs(e[6]) * h.y + Math.abs(e[10]) * h.z,
    );
  } else {
    extents.setScalar(data.radius);
  }
}

// ---------- cube settle: snap to the nearest flat face ----------

function snapAxis(v, exclude) {
  const abs = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
  if (exclude !== undefined) abs[exclude] = -1;
  const i = abs.indexOf(Math.max(...abs));
  const out = new THREE.Vector3();
  out.setComponent(i, Math.sign(v.getComponent(i)) || 1);
  return { v: out, i };
}

function nearestFaceQuaternion(q, out) {
  tmpM.makeRotationFromQuaternion(q);
  const bx = new THREE.Vector3().setFromMatrixColumn(tmpM, 0);
  const by = new THREE.Vector3().setFromMatrixColumn(tmpM, 1);
  const sx = snapAxis(bx);
  const sy = snapAxis(by, sx.i);
  const sz = new THREE.Vector3().crossVectors(sx.v, sy.v);
  tmpM.makeBasis(sx.v, sy.v, sz);
  return out.setFromRotationMatrix(tmpM);
}

// ---------- physics ----------

export function updateOrb(dt, elapsed, nightFactor) {
  if (!activeOrb) return;

  const k = dt * 60; // frames-worth of time this tick
  const data = visual.userData;
  const isCube = data.shape === "cube";
  const pos = activeOrb.position;
  const grabbed = pointer.mode === "grab";

  prevPos.copy(pos);
  updateExtents();
  orbStatus.now = elapsed;
  const slipping = isSlipping();
  const asleep = isAsleep();

  if (grabbed) {
    // Follow the pointer smoothly; velocity comes from how fast it moved.
    tmpV.copy(grabTarget);
    tmpV.y = Math.max(tmpV.y, extents.y);
    pos.lerp(tmpV, 1 - Math.exp(-dt * 28));
    tmpV2.subVectors(pos, prevPos).divideScalar(Math.max(k, 0.0001));
    velocity.lerp(tmpV2, 0.5);
    spin.multiplyScalar(Math.pow(0.9, k));
    settling = false;
  } else {
    if (!asleep) applyDriving(k, slipping);
    // A UFO beam cancels gravity (and then some) while it holds the orb.
    velocity.y += GRAVITY * physics.gravity * (1 - orbStatus.beam) * k;
    if (asleep) {
      // Dozing: slows right down wherever it is.
      const damp = Math.pow(0.85, k);
      velocity.x *= damp;
      velocity.z *= damp;
    }
    pos.addScaledVector(velocity, k);
  }

  // Walls (sized to what's visible on screen).
  grounded = false;
  collideWall("x", bounds.minX, bounds.maxX, normals.nx, normals.px, grabbed);
  collideWall("z", bounds.minZ, bounds.maxZ, normals.nz, normals.pz, grabbed);

  // Floor.
  if (pos.y - extents.y <= 0) {
    pos.y = extents.y;
    grounded = true;

    if (!grabbed && velocity.y < 0) {
      const impact = -velocity.y;
      if (impact > REST_SPEED * Math.sqrt(physics.gravity)) {
        velocity.y = impact * physics.bounce;
        data.onImpact?.(normals.floor, impact);
      } else {
        velocity.y = 0;
      }
    }

    if (!grabbed && jumpQueued && !asleep) {
      // Heavier orbs jump lower; lower gravity jumps the same height-ish.
      velocity.y = (JUMP_SPEED * Math.sqrt(physics.gravity)) / Math.sqrt(physics.weight);
      data.onImpact?.(normals.floor, 0.12); // little squish on take-off
    }

    if (!grabbed) {
      const baseFriction = slipping
        ? 0.999 // no grip at all
        : isDriving()
          ? DRIVE_FRICTION
          : isCube
            ? CUBE_FRICTION
            : GROUND_FRICTION;
      const f = Math.pow(baseFriction, k);
      velocity.x *= f;
      velocity.z *= f;
      if (Math.hypot(velocity.x, velocity.z) < 0.0008) {
        velocity.x = 0;
        velocity.z = 0;
      }
    }
  }

  // ---- rotation ----
  const planarSpeed = Math.hypot(velocity.x, velocity.z);

  if (slipping && grounded && !grabbed) {
    // Skidding: the spin goes haywire instead of matching the motion.
    spin.x += (Math.random() - 0.5) * 0.04 * k;
    spin.z += (Math.random() - 0.5) * 0.04 * k;
    spin.y += 0.02 * k;
  } else if (grounded && !grabbed) {
    // Roll without slipping: spin axis = up × velocity, rate = speed / radius.
    tmpV.set(velocity.z, 0, -velocity.x).divideScalar(data.radius);
    tmpV.multiplyScalar(data.rollFactor);
    spin.lerp(tmpV, 1 - Math.pow(0.5, k));

    if (isCube && planarSpeed < 0.02 && Math.abs(velocity.y) < 0.01) {
      settling = true;
    }
  } else {
    spin.multiplyScalar(Math.pow(AIR_SPIN_DAMPING, k));
  }

  if (settling && isCube) {
    spin.set(0, 0, 0);
    nearestFaceQuaternion(visual.quaternion, snapQ);
    visual.quaternion.slerp(snapQ, 1 - Math.exp(-dt * 10));
    if (visual.quaternion.angleTo(snapQ) < 0.002) visual.quaternion.copy(snapQ);
    if (planarSpeed > 0.03 || grabbed) settling = false;
  } else {
    const angle = spin.length() * k;
    if (angle > 1e-6) {
      tmpV.copy(spin).normalize();
      tmpQ.setFromAxisAngle(tmpV, angle);
      visual.quaternion.premultiply(tmpQ);
    }
  }

  jumpQueued = false;

  data.tick?.(dt, elapsed, velocity, grabbed);

  // ---- glow ----
  const material = visual.material;
  material.emissiveIntensity = THREE.MathUtils.lerp(0.04, 0.75, nightFactor);

  orbGlow.position.copy(pos);
  orbGlow.color.copy(glowColor);
  orbGlow.intensity = THREE.MathUtils.lerp(0.6, 4, nightFactor);
  orbGlow.distance = THREE.MathUtils.lerp(4, 9, nightFactor);

  // Pool of light under the orb, fading as it rises.
  const height = Math.max(0, pos.y - extents.y);
  glowPool.position.x = pos.x;
  glowPool.position.z = pos.z;
  glowPool.scale.setScalar(1 + height * 0.35);
  glowPool.material.color.copy(glowColor);
  glowPool.material.opacity = (0.3 * nightFactor) / (1 + height * 0.9);

  glowTrail?.update(
    elapsed,
    pos,
    height,
    data.radius,
    glowColor,
    nightFactor,
    renderer.domElement.height,
  );
  trail?.update(dt, pos, glowColor, nightFactor);
}

function collideWall(axis, min, max, normalAtMin, normalAtMax, grabbed) {
  const pos = activeOrb.position;
  const e = extents[axis];
  if (pos[axis] - e < min) {
    pos[axis] = min + e;
    if (!grabbed && velocity[axis] < 0) {
      const impact = -velocity[axis];
      velocity[axis] = impact * WALL_BOUNCE;
      visual.userData.onImpact?.(normalAtMin, impact);
    }
  } else if (pos[axis] + e > max) {
    pos[axis] = max - e;
    if (!grabbed && velocity[axis] > 0) {
      const impact = velocity[axis];
      velocity[axis] = -impact * WALL_BOUNCE;
      visual.userData.onImpact?.(normalAtMax, impact);
    }
  }
}

// ---------- input: driving with the keyboard ----------

const DRIVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

function isDriving() {
  for (const code of keys) if (DRIVE_KEYS[code]) return true;
  return false;
}

function applyDriving(k, slipping = false) {
  let x = 0;
  let z = 0;
  for (const code of keys) {
    const dir = DRIVE_KEYS[code];
    if (dir) {
      x += dir[0];
      z += dir[1];
    }
  }
  if (x === 0 && z === 0) return;

  // Camera looks straight down -z, so screen "up" is -z.
  const len = Math.hypot(x, z);
  const push =
    ((DRIVE_ACCEL * physics.speed) / Math.sqrt(physics.weight)) *
    (grounded ? 1 : AIR_CONTROL) *
    (slipping ? 0.15 : 1) *
    k;
  velocity.x += (x / len) * push;
  velocity.z += (z / len) * push;

  const maxSpeed = MAX_DRIVE_SPEED * physics.speed;
  const planar = Math.hypot(velocity.x, velocity.z);
  if (planar > maxSpeed) {
    velocity.x *= maxSpeed / planar;
    velocity.z *= maxSpeed / planar;
  }
  settling = false;
}

function isTyping(target) {
  return target?.closest?.("input, textarea, [contenteditable]");
}

export function setupKeyboardControls() {
  window.addEventListener("keydown", (e) => {
    if (isTyping(e.target)) return;
    if (DRIVE_KEYS[e.code]) {
      keys.add(e.code);
      e.preventDefault();
    }
    if (e.code === "Space") {
      if (!e.repeat && grounded) jumpQueued = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  // Don't keep driving if the window loses focus mid-press.
  window.addEventListener("blur", () => keys.clear());
}

// ---------- input: grab & throw (mouse + touch via pointer events) ----------

function setNdc(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

export function setupPointerControls() {
  const canvas = renderer.domElement;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || pointer.id !== null || !activeOrb) return;

    if (isRadialOpen()) {
      closeRadial();
      return;
    }

    pointer.id = e.pointerId;
    pointer.startX = e.clientX;
    pointer.startY = e.clientY;
    pointer.startTime = e.timeStamp;
    pointer.moved = 0;
    canvas.setPointerCapture(e.pointerId);

    setNdc(e);
    // Slightly generous hit area so it's easy to grab on a phone.
    const hit = raycaster.intersectObject(activeOrb, true)[0];
    const nearMiss = !hit && raycaster.ray.distanceToPoint(activeOrb.position) < 0.75;

    // A kitty / lamp / yoyo in front of the orb gets grabbed instead.
    const propHit = pickProp(raycaster);
    if (propHit && (!hit || propHit.distance < hit.distance)) {
      pointer.mode = "prop";
      beginPropDrag(propHit, raycaster);
      canvas.classList.add("is-grabbing");
      return;
    }

    if (hit || nearMiss) {
      pointer.mode = "grab";
      camera.getWorldDirection(tmpV);
      grabPlane.setFromNormalAndCoplanarPoint(tmpV.negate(), activeOrb.position);
      raycaster.ray.intersectPlane(grabPlane, hitPoint);
      grabOffset.subVectors(activeOrb.position, hitPoint);
      grabTarget.copy(activeOrb.position);
      velocity.set(0, 0, 0);
      canvas.classList.add("is-grabbing");
    } else {
      pointer.mode = "flick";
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointer.id) {
      // Hover cursor feedback (desktop only).
      if (pointer.id === null && activeOrb && e.pointerType === "mouse") {
        setNdc(e);
        const over =
          raycaster.intersectObject(activeOrb, true).length > 0 || pickProp(raycaster) !== null;
        canvas.classList.toggle("is-grabbable", over);
      }
      return;
    }
    pointer.moved = Math.max(
      pointer.moved,
      Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY),
    );
    if (pointer.mode === "prop") {
      setNdc(e);
      movePropDrag(raycaster);
    }
    if (pointer.mode === "grab") {
      setNdc(e);
      if (raycaster.ray.intersectPlane(grabPlane, hitPoint)) {
        grabTarget.addVectors(hitPoint, grabOffset);
        grabTarget.x = THREE.MathUtils.clamp(grabTarget.x, bounds.minX, bounds.maxX);
        grabTarget.z = THREE.MathUtils.clamp(grabTarget.z, bounds.minZ, bounds.maxZ);
        grabTarget.y = Math.min(grabTarget.y, 4);
      }
    }
  });

  const end = (e) => {
    if (e.pointerId !== pointer.id) return;
    const duration = e.timeStamp - pointer.startTime;
    const isTap = pointer.moved < 8 && duration < 350;

    if (pointer.mode === "prop") {
      endPropDrag(isTap);
    } else if (pointer.mode === "grab") {
      if (isTap) {
        // A quick tap on the orb gives it a little hop.
        velocity.set(0, 0.16, 0);
        visual.userData.onImpact?.(normals.floor, 0.08);
      } else {
        // Throw with the speed it was moving when released.
        velocity.multiplyScalar(throwScale());
        if (velocity.length() > MAX_THROW) velocity.setLength(MAX_THROW);
        velocity.y += 0.03;
      }
    } else if (pointer.mode === "flick" && e.type === "pointerup") {
      // Drag on empty space flings the orb that way; a tap makes it hop.
      const dx = (e.clientX - pointer.startX) * 0.008;
      const dz = (e.clientY - pointer.startY) * 0.008;
      velocity.set(dx, 0.2, dz).multiplyScalar(throwScale());
      if (velocity.length() > MAX_THROW) velocity.setLength(MAX_THROW);
      spin.set(dz * 0.25, 0, -dx * 0.25);
      settling = false;
    }

    pointer.id = null;
    pointer.mode = null;
    renderer.domElement.classList.remove("is-grabbing");
  };

  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // Right-click (or long-press on most phones) opens the menu, so a normal
  // click/tap is always just for playing with the orb.
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    // Right-click a kitty / lamp / yoyo to recolor it.
    setNdc(e);
    const propHit = pickProp(raycaster);
    const orbHit = raycaster.intersectObject(activeOrb, true)[0];
    if (propHit && (!orbHit || propHit.distance < orbHit.distance)) {
      closeRadial();
      colorTarget = propHit.prop;
      colorPickerController?.open(propLabel(propHit.prop));
      return;
    }
    openRadial();
  });
}

// ---------- radial menu ----------

function isRadialOpen() {
  return radial && !radial.classList.contains("orb-radial_hidden");
}

function closeRadial() {
  radial?.classList.add("orb-radial_hidden");
}

function openRadial() {
  if (!activeOrb || !radial) return;
  tmpV.copy(activeOrb.position).project(camera);
  const size = 150;
  const x = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
  const left = THREE.MathUtils.clamp(x - size / 2, 8, window.innerWidth - size - 8);
  const top = THREE.MathUtils.clamp(y - size / 2, 64, window.innerHeight - size - 8);
  radial.style.left = `${left}px`;
  radial.style.top = `${top}px`;
  radial.classList.remove("orb-radial_hidden");
  radialOpenedAt = performance.now();
}

export function setupRadialMenu() {
  radial = document.querySelector(".orb-radial");
  if (!radial) return;

  radial.addEventListener("click", (e) => {
    // The tap that opened the menu also fires a click on whatever button is
    // now under the finger — ignore it.
    if (performance.now() - radialOpenedAt < 400) return;
    const button = e.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "color") {
      colorTarget = null;
      colorPickerController?.open(shapeLabels[visual?.userData.shape] ?? "orb");
    }

    if (action === "material") settingsModal?.open();

    if (action === "sparkle" && trail) {
      const on = trail.toggle();
      button.classList.toggle("is-active", on);
      showToast(on ? "sparkle trail on" : "sparkle trail off");
    }

    closeRadial();
  });

  // Close when tapping anywhere else (pointerdown, so the tap that
  // opened it doesn't immediately close it again).
  window.addEventListener("pointerdown", (e) => {
    if (!isRadialOpen()) return;
    if (e.target.closest(".orb-radial")) return;
    if (e.target === renderer.domElement) return; // canvas handler closes it
    closeRadial();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRadial();
  });
}

// ---------- shape buttons (top bar) ----------

export function setupShapeButtons() {
  document.querySelectorAll("[data-shape]").forEach((button) => {
    button.addEventListener("click", () => {
      setShape(button.dataset.shape);
      // Drop focus so Space (jump) doesn't re-press the button.
      button.blur();
    });
  });
}

// ---------- misc ----------

export function setupColorPickerModal() {
  // One picker, two jobs: the orb or whichever prop was right-clicked.
  colorPickerController = setupColorPicker((value) => {
    if (colorTarget) setPropColor(colorTarget, value);
    else updateOrbColor(value);
  });
}

export function setupPhysicsModal() {
  settingsModal = setupSettingsModal({
    finishes: PRESET_ORDER.map((key) => ({ key, label: PRESETS[key].label })),
    getFinish: currentFinish,
    onFinish: setFinish,
  });
}

// What the props need to know to collide with the orb.
const orbBody = {
  position: null,
  velocity,
  radius: 0.5,
  mass: 1,
  kinematic: false,
  onImpact: null,
};

export function getOrbBody() {
  if (!activeOrb) return null;
  orbBody.position = activeOrb.position;
  orbBody.radius = visual.userData.radius;
  orbBody.mass = physics.weight;
  orbBody.kinematic = pointer.mode === "grab";
  orbBody.onImpact = visual.userData.onImpact;
  return orbBody;
}

export function getOrbPosition() {
  return activeOrb ? activeOrb.position : new THREE.Vector3();
}

export function setupTrail() {
  trail = createTrail(scene);
  glowTrail = createGlowTrail(scene);
}

export function showToast(text, duration = 1300) {
  toastEl ??= document.querySelector(".orb-toast");
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add("orb-toast_visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("orb-toast_visible"), duration);
}
