import * as THREE from "three";
import { scene, camera, bounds } from "../scene.js";
import {
  buildOrbMaterial,
  createGradientTexture,
  disposeMaterial,
} from "../materials.js";
import { physics } from "../settings.js";
import { createKitty } from "./kitty.js";
import { createLamp } from "./lamp.js";
import { createYoyo } from "./yoyo.js";
import { createOctopus } from "./octopus.js";

/*
 * Things you can drop into the void with the keyboard (K, L, Y).
 * They fall, slide, get bumped by the orb, can be dragged around, and
 * can be recolored (right-click one). The trash button clears them.
 */

const GRAVITY = -0.02;
const FRICTION = 0.9;
const PROP_BOUNCE = 0.25;
const ORB_RESTITUTION = 0.45;
const MAX_PROPS = 12;
const MAX_LAMPS = 3;

const PALETTES = {
  kitty: ["#f4a259", "#f2f2f2", "#3a3a44", "#c8a27a", "#9aa5b1"],
  lamp: ["#f6e7c1", "#9ec5d9", "#e8a0bf", "#b8d8a8", "#f2c14e"],
  yoyo: ["#e4405f", "#4158d0", "#1bc17a", "#f7b32b", "#7f77dd"],
  octopus: ["#e85d75", "#8e24aa", "#fb8c00", "#26a69a", "#ec407a"],
};

const LABELS = { kitty: "kitty", lamp: "lamp", yoyo: "yoyo", octopus: "octopus" };

const props = [];
const lampLights = []; // fixed pool, so adding a lamp never recompiles shaders
let toast = () => {};
let getOrbPosition = () => new THREE.Vector3();

// scratch
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const segA = new THREE.Vector3();
const segB = new THREE.Vector3();
const closest = new THREE.Vector3();
const normal = new THREE.Vector3();

// drag state
const drag = {
  prop: null,
  part: null, // "body" | "anchor"
  plane: new THREE.Plane(),
  offset: new THREE.Vector3(),
  target: new THREE.Vector3(),
  prev: new THREE.Vector3(),
};

export function setupProps(options) {
  toast = options.toast ?? toast;
  getOrbPosition = options.getOrbPosition ?? getOrbPosition;

  for (let i = 0; i < MAX_LAMPS; i++) {
    const light = new THREE.PointLight(0xffd9a0, 0, 7, 1.6);
    light.position.set(0, -50, 0);
    scene.add(light);
    lampLights.push(light);
  }

  window.addEventListener("keydown", (e) => {
    if (e.target?.closest?.("input, textarea, [contenteditable]")) return;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyK") spawn("kitty");
    if (e.code === "KeyL") spawn("lamp");
    if (e.code === "KeyY") spawn("yoyo");
    if (e.code === "KeyO") spawn("octopus");
  });

  document.querySelector("[data-trash]")?.addEventListener("click", (e) => {
    clearProps();
    e.currentTarget.blur();
  });
}

// ---------- spawning ----------

function randomSpot(nearFront = false) {
  const orb = getOrbPosition();
  // Hanging things go nearer the front so they don't end up behind the top bar.
  const zMin = nearFront ? 0 : bounds.minZ * 0.6;
  for (let i = 0; i < 20; i++) {
    tmp.set(
      THREE.MathUtils.lerp(bounds.minX * 0.75, bounds.maxX * 0.75, Math.random()),
      0,
      THREE.MathUtils.lerp(zMin, bounds.maxZ * 0.75, Math.random()),
    );
    if (Math.hypot(tmp.x - orb.x, tmp.z - orb.z) > 1.3) break;
  }
  return tmp;
}

function makeMaterial(prop) {
  const material = buildOrbMaterial(prop.appearance, prop.preset, prop.texture);
  material.emissiveIntensity = 0.05;
  return material;
}

export function spawn(type) {
  if (props.length >= MAX_PROPS) {
    toast("that's a lot of stuff — try the trash can");
    return;
  }

  let light = null;
  if (type === "lamp") {
    light = lampLights.find((l) => !l.userData.inUse) ?? null;
    if (!light) {
      toast(`${MAX_LAMPS} lamps max`);
      return;
    }
    light.userData.inUse = true;
  }

  const palette = PALETTES[type];
  const appearance = { color: palette[Math.floor(Math.random() * palette.length)] };
  const placeholder = new THREE.MeshStandardMaterial();

  const built =
    type === "kitty"
      ? createKitty(placeholder)
      : type === "lamp"
        ? createLamp(placeholder, light)
        : type === "octopus"
          ? createOctopus(placeholder)
          : createYoyo(placeholder);

  const prop = {
    type,
    ...built,
    appearance,
    texture: null,
    velocity: new THREE.Vector3(),
    grounded: false,
  };
  prop.material = makeMaterial(prop);
  prop.main.forEach((m) => (m.material = prop.material));
  placeholder.dispose();

  const spot = randomSpot(type === "yoyo");
  if (type === "yoyo") {
    prop.anchor.position.set(spot.x, 2.6, spot.z);
    prop.group.position.copy(prop.anchor.position);
    prop.group.position.y -= 0.3;
    scene.add(prop.anchor, prop.string);
  } else {
    prop.group.position.set(spot.x, 3.5, spot.z);
    prop.group.rotation.y = (Math.random() - 0.5) * 0.8;
  }
  scene.add(prop.group);
  props.push(prop);
  toast(LABELS[type]);
}

function removeProp(prop) {
  scene.remove(prop.group);
  if (prop.anchor) scene.remove(prop.anchor, prop.string);
  prop.group.traverse((o) => {
    if (o.isMesh || o.isLine) o.geometry?.dispose();
  });
  disposeMaterial(prop.material);
  prop.texture?.dispose();
  prop.dispose?.();
  if (prop.light) {
    // Keep the light in the scene (switched off) so the light count never
    // changes — changing it would make every material recompile.
    scene.add(prop.light);
    prop.light.intensity = 0;
    prop.light.position.set(0, -50, 0);
    prop.light.userData.inUse = false;
  }
}

export function clearProps() {
  if (!props.length) {
    toast("nothing to clear");
    return;
  }
  props.splice(0).forEach(removeProp);
  if (drag.prop) drag.prop = null;
  toast("cleared");
}

// ---------- color ----------

export function setPropColor(prop, value) {
  prop.texture?.dispose();
  prop.texture = null;
  if (Array.isArray(value)) {
    prop.appearance = { gradient: value };
    prop.texture = createGradientTexture(value);
  } else {
    prop.appearance = { color: value };
  }
  const old = prop.material;
  prop.material = makeMaterial(prop);
  prop.main.forEach((m) => (m.material = prop.material));
  disposeMaterial(old);
}

export function propLabel(prop) {
  return LABELS[prop.type];
}

// ---------- picking & dragging ----------

const pickTargets = [];

/** Closest prop part under the ray: { prop, part, distance } or null. */
export function pickProp(raycaster) {
  pickTargets.length = 0;
  for (const p of props) {
    pickTargets.push(p.group);
    if (p.anchor) pickTargets.push(p.anchor);
  }
  if (!pickTargets.length) return null;
  const hit = raycaster.intersectObjects(pickTargets, true)[0];
  if (!hit) return null;
  for (const p of props) {
    if (p.anchor && (hit.object === p.anchor)) return { prop: p, part: "anchor", distance: hit.distance };
    let o = hit.object;
    while (o) {
      if (o === p.group) return { prop: p, part: "body", distance: hit.distance };
      o = o.parent;
    }
  }
  return null;
}

function partObject(prop, part) {
  return part === "anchor" ? prop.anchor : prop.group;
}

export function beginPropDrag(pick, raycaster) {
  drag.prop = pick.prop;
  drag.part = pick.part;
  const obj = partObject(pick.prop, pick.part);
  camera.getWorldDirection(tmp).negate();
  drag.plane.setFromNormalAndCoplanarPoint(tmp, obj.position);
  if (raycaster.ray.intersectPlane(drag.plane, tmp2)) {
    drag.offset.subVectors(obj.position, tmp2);
  } else {
    drag.offset.set(0, 0, 0);
  }
  drag.target.copy(obj.position);
  drag.prev.copy(obj.position);
  if (pick.part === "body") pick.prop.velocity.set(0, 0, 0);
}

export function movePropDrag(raycaster) {
  if (!drag.prop) return;
  if (raycaster.ray.intersectPlane(drag.plane, tmp2)) {
    drag.target.addVectors(tmp2, drag.offset);
    drag.target.x = THREE.MathUtils.clamp(drag.target.x, bounds.minX, bounds.maxX);
    drag.target.z = THREE.MathUtils.clamp(drag.target.z, bounds.minZ, bounds.maxZ);
    drag.target.y = THREE.MathUtils.clamp(drag.target.y, drag.part === "anchor" ? 0.6 : 0, 4.2);
  }
}

/** Returns the prop if this was a tap (no real drag), else null. */
export function endPropDrag(isTap) {
  const prop = drag.prop;
  drag.prop = null;
  if (!prop) return null;
  if (isTap) {
    if (prop.type === "yoyo") prop.yo();
    else if (prop.type === "kitty") toast("meow");
    else if (prop.type === "octopus") {
      prop.nudge(null, 0.3);
      prop.velocity.y = 0.15;
    }
    else prop.velocity.y = 0.12;
    return prop;
  }
  // Throw with the speed it was being dragged at (the anchor just stays put).
  if (drag.part === "body" && prop.velocity.length() > 0.45) prop.velocity.setLength(0.45);
  return null;
}

export function isDraggingProp() {
  return drag.prop !== null;
}

// ---------- physics ----------

function capsuleSegment(prop) {
  const c = prop.capsule;
  if (c.centered) {
    segA.copy(prop.group.position);
    segB.copy(prop.group.position);
  } else {
    segA.copy(prop.group.position).y += c.a;
    segB.copy(prop.group.position).y += c.b;
  }
}

function closestOnSegment(p, a, b, out) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (len2 > 1e-8) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2;
    t = Math.min(1, Math.max(0, t));
  }
  return out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
}

function invMass(prop, isDragged) {
  if (isDragged || !Number.isFinite(prop.mass)) return 0;
  return 1 / prop.mass;
}

/**
 * orb: { position, velocity, radius, mass, kinematic, onImpact }
 * Velocities are "per frame at 60fps", same as the orb.
 */
export function updateProps(dt, nightFactor, orb) {
  if (!props.length) return;
  const k = dt * 60;
  const g = GRAVITY * physics.gravity * k;

  for (const prop of props) {
    const dragged = drag.prop === prop;
    const body = prop.group;
    const half = prop.capsule.centered ? prop.capsule.r : 0; // origin height above the floor

    if (prop.type === "yoyo") {
      // anchor
      if (dragged && drag.part === "anchor") {
        prop.anchor.position.lerp(drag.target, 1 - Math.exp(-dt * 25));
      }
      // body
      if (dragged && drag.part === "body") {
        tmp.copy(body.position);
        body.position.lerp(drag.target, 1 - Math.exp(-dt * 25));
        prop.velocity.subVectors(body.position, tmp).divideScalar(Math.max(k, 1e-4));
        // Pulling the yoyo past the string drags the ring along.
        tmp.subVectors(prop.anchor.position, body.position);
        if (tmp.length() > prop.length) {
          tmp.setLength(prop.length);
          prop.anchor.position.addVectors(body.position, tmp);
          prop.anchor.position.y = Math.max(prop.anchor.position.y, 0.6);
        }
      } else {
        prop.velocity.y += g;
        prop.velocity.multiplyScalar(Math.pow(0.995, k)); // air drag
        body.position.addScaledVector(prop.velocity, k);
        // String: can go slack, but never longer than its length.
        tmp.subVectors(body.position, prop.anchor.position);
        const dist = tmp.length();
        if (dist > prop.length) {
          tmp.divideScalar(dist);
          body.position.copy(prop.anchor.position).addScaledVector(tmp, prop.length);
          const radial = prop.velocity.dot(tmp);
          if (radial > 0) prop.velocity.addScaledVector(tmp, -radial);
        }
      }
      prop.anchor.rotation.y += dt * 0.6;
    } else if (dragged) {
      tmp.copy(body.position);
      body.position.lerp(drag.target, 1 - Math.exp(-dt * 25));
      prop.velocity.subVectors(body.position, tmp).divideScalar(Math.max(k, 1e-4));
    } else {
      prop.velocity.y += g;
      body.position.addScaledVector(prop.velocity, k);
    }

    // floor
    prop.grounded = false;
    if (body.position.y < half) {
      body.position.y = half;
      prop.grounded = true;
      if (prop.velocity.y < 0) {
        const impact = -prop.velocity.y;
        prop.velocity.y = impact > 0.05 ? impact * PROP_BOUNCE : 0;
        if (impact > 0.05) prop.nudge?.(tmp.set(Math.random() - 0.5, 0, Math.random() - 0.5), impact * 0.5);
      }
      if (!dragged) {
        const f = Math.pow(FRICTION, k);
        prop.velocity.x *= f;
        prop.velocity.z *= f;
      }
    }

    // walls
    const r = prop.capsule.r;
    for (const axis of ["x", "z"]) {
      const min = axis === "x" ? bounds.minX : bounds.minZ;
      const max = axis === "x" ? bounds.maxX : bounds.maxZ;
      if (body.position[axis] - r < min) {
        body.position[axis] = min + r;
        if (prop.velocity[axis] < 0) prop.velocity[axis] *= -0.4;
      } else if (body.position[axis] + r > max) {
        body.position[axis] = max - r;
        if (prop.velocity[axis] > 0) prop.velocity[axis] *= -0.4;
      }
    }

    prop.tick?.(dt, nightFactor);

    // Gentle glow at night so things don't vanish into the void.
    prop.material.emissiveIntensity = 0.05 + nightFactor * 0.12;
  }

  collideWithOrb(orb);
  collidePropsWithEachOther();
}

function collideWithOrb(orb) {
  if (!orb) return;
  const invOrb = orb.kinematic ? 0 : 1 / orb.mass;

  for (const prop of props) {
    capsuleSegment(prop);
    closestOnSegment(orb.position, segA, segB, closest);
    normal.subVectors(orb.position, closest);
    const dist = normal.length();
    const minDist = orb.radius + prop.capsule.r;
    if (dist >= minDist) continue;

    if (dist < 1e-5) normal.set(0, 1, 0);
    else normal.divideScalar(dist);

    const invProp = invMass(prop, drag.prop === prop);
    const invSum = invOrb + invProp;
    if (invSum === 0) continue;

    // Push apart (shared by how heavy each one is).
    const overlap = minDist - dist;
    orb.position.addScaledVector(normal, (overlap * invOrb) / invSum);
    if (prop.type !== "yoyo" || drag.prop !== prop) {
      prop.group.position.addScaledVector(normal, (-overlap * invProp) / invSum);
    }
    if (prop.group.position.y < 0 && !prop.capsule.centered) prop.group.position.y = 0;

    // Bounce off each other.
    const vn = tmp.subVectors(orb.velocity, prop.velocity).dot(normal);
    if (vn < 0) {
      const j = (-(1 + ORB_RESTITUTION) * vn) / invSum;
      orb.velocity.addScaledVector(normal, j * invOrb);
      prop.velocity.addScaledVector(normal, -j * invProp);
      orb.onImpact?.(normal, -vn);
      prop.nudge?.(normal.clone().negate(), -vn);
    }
  }
}

function collidePropsWithEachOther() {
  for (let i = 0; i < props.length; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const a = props[i];
      const b = props[j];
      // Simple: compare as spheres around each capsule's middle.
      capsuleSegment(a);
      const ca = tmp.addVectors(segA, segB).multiplyScalar(0.5).clone();
      capsuleSegment(b);
      const cb = tmp2.addVectors(segA, segB).multiplyScalar(0.5);
      normal.subVectors(ca, cb);
      normal.y = 0; // only push sideways, so stacks don't explode
      const dist = normal.length();
      const minDist = a.capsule.r + b.capsule.r;
      if (dist >= minDist || dist < 1e-5) continue;
      normal.divideScalar(dist);
      const ia = invMass(a, drag.prop === a);
      const ib = invMass(b, drag.prop === b);
      const sum = ia + ib;
      if (sum === 0) continue;
      const overlap = minDist - dist;
      a.group.position.addScaledVector(normal, (overlap * ia) / sum);
      b.group.position.addScaledVector(normal, (-overlap * ib) / sum);
    }
  }
}
