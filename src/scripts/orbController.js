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

import { createSmoothOrb } from "./shapes/smoothOrb.js";
import { createCubeOrb } from "./shapes/cubeOrb.js";
import { createChaosOrb } from "./shapes/chaosOrb.js";
import { createBlobOrb } from "./shapes/blobOrb.js";

// ---------- tuning ----------
// Physics values are "per frame at 60fps" and get scaled by the real frame
// time, so the orb moves at the same speed on 60Hz, 120Hz and slow devices.

const GRAVITY = -0.02;
const BOUNCE = 0.7;
const WALL_BOUNCE = 0.75;
const GROUND_FRICTION = 0.985;
const CUBE_FRICTION = 0.9;
const AIR_SPIN_DAMPING = 0.995;
const REST_SPEED = 0.04; // impacts slower than this stop instead of bouncing
const MAX_THROW = 0.55;

// ---------- state ----------

const shapeFactories = {
  smooth: createSmoothOrb,
  cube: createCubeOrb,
  chaotic: createChaosOrb,
  blob: createBlobOrb,
};
const shapeOrder = ["smooth", "cube", "chaotic", "blob"];
const shapeLabels = {
  smooth: "orb",
  cube: "cube",
  chaotic: "chaos",
  blob: "blob",
};

let activeOrb = null; // Group: position lives here
let visual = null; // Mesh: rotation / shape live here
let shapeIndex = 0;
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
let colorPickerController = null;
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

  shapeIndex = shapeOrder.indexOf(shape);
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

function cycleMaterial() {
  const current = presetKey ?? visual?.userData.defaultPreset ?? "glossy";
  const next = PRESET_ORDER[(PRESET_ORDER.indexOf(current) + 1) % PRESET_ORDER.length];
  presetKey = next;
  applyAppearance();
  showToast(PRESETS[next].label);
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
    velocity.y += GRAVITY * k;
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
      if (impact > REST_SPEED) {
        velocity.y = impact * BOUNCE;
        data.onImpact?.(normals.floor, impact);
      } else {
        velocity.y = 0;
      }
    }

    if (!grabbed) {
      const f = Math.pow(isCube ? CUBE_FRICTION : GROUND_FRICTION, k);
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

  if (grounded && !grabbed) {
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
  glowPool.material.opacity = (0.5 * nightFactor) / (1 + height * 0.9);

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
        const over = raycaster.intersectObject(activeOrb, true).length > 0;
        canvas.classList.toggle("is-grabbable", over);
      }
      return;
    }
    pointer.moved = Math.max(
      pointer.moved,
      Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY),
    );
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

    if (pointer.mode === "grab") {
      if (isTap) {
        openRadial();
      } else {
        // Throw with the speed it was moving when released.
        if (velocity.length() > MAX_THROW) velocity.setLength(MAX_THROW);
        velocity.y += 0.03;
      }
    } else if (pointer.mode === "flick" && e.type === "pointerup") {
      // Drag on empty space flings the orb that way; a tap makes it hop.
      const dx = (e.clientX - pointer.startX) * 0.008;
      const dz = (e.clientY - pointer.startY) * 0.008;
      velocity.set(dx, 0.2, dz);
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

  // Desktop shortcut: right-click opens the menu too.
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
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
      const rect = button.getBoundingClientRect();
      colorPickerController?.open(rect.left + rect.width / 2, rect.top);
    }

    if (action === "shape") {
      const next = shapeOrder[(shapeIndex + 1) % shapeOrder.length];
      setShape(next);
      showToast(shapeLabels[next]);
    }

    if (action === "material") cycleMaterial();

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

// ---------- misc ----------

export function setupColorPickerModal() {
  colorPickerController = setupColorPicker(updateOrbColor);
}

export function setupTrail() {
  trail = createTrail(scene);
}

export function showToast(text) {
  toastEl ??= document.querySelector(".orb-toast");
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add("orb-toast_visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("orb-toast_visible"), 1300);
}
