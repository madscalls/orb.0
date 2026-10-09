import * as THREE from "three";
import { scene, camera, bounds } from "../scene.js";
import {
  buildOrbMaterial,
  createGradientTexture,
  disposeMaterial,
} from "../materials.js";
import { physics } from "../settings.js";
import { orbStatus } from "../orbStatus.js";
import { sfx } from "../sound.js";
import { ITEMS, KEY_TO_ITEM } from "./registry.js";

/*
 * Things you can drop into the void with the keyboard.
 *
 * Each item (see registry.js) is built from simple shapes and returns:
 *   group, main[]        what to draw, and which parts take the custom color
 *   capsule {a,b,r}      invisible collision shape (local, from the origin)
 *   mass                 Infinity = the orb can't push it
 * plus any of these optional hooks:
 *   hover                floats at this height instead of falling
 *   passThrough          the orb goes through it (still gets onOrbOverlap)
 *   restitution          how bouncy the orb is off it (default 0.45)
 *   tick(dt, ctx, prop)              every frame
 *   physics(dt, ctx, prop, drag)     replaces the default movement entirely
 *   onOrbHit(ctx, prop, impact, n)   the orb bumped it
 *   onOrbOverlap(ctx, prop)          the orb is inside it (passThrough items)
 *   onLand(ctx, prop, impact)        it hit the floor
 *   onTap(ctx, prop)                 clicked/tapped without dragging
 *   spawnAt(ctx) -> Vector3          where it appears
 */

const GRAVITY = -0.02;
const FRICTION = 0.9;
const PROP_BOUNCE = 0.25;
const DEFAULT_RESTITUTION = 0.45;
const MAX_PROPS = 20;
const MAX_LAMPS = 3;

const props = [];
const lampLights = []; // fixed pool, so adding a lamp never recompiles shaders
let toast = () => {};
let getOrbPosition = () => new THREE.Vector3();
let currentOrb = null;

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
  part: null, // "body" | "anchor" | custom
  hitObject: null,
  plane: new THREE.Plane(),
  offset: new THREE.Vector3(),
  target: new THREE.Vector3(),
};

// Shared context handed to every item hook.
const ctx = {
  dt: 0,
  k: 0,
  elapsed: 0,
  nightFactor: 0,
  orb: null,
  status: orbStatus,
  sfx,
  toast: (t) => toast(t),
  spawn: (type, opts) => spawn(type, opts),
  remove: (prop) => {
    prop.dead = true;
  },
  props,
  bounds,
  scene,
  gravity: () => GRAVITY * physics.gravity,
  isDragged: (prop) => drag.prop === prop,
  defaultPhysics: (prop) => defaultPhysics(prop, ctx.dt, ctx.k),
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
    if (document.querySelector(".orb-modal:not(.orb-modal_hidden)")) return;
    const type = KEY_TO_ITEM[e.code];
    if (type) spawn(type);
  });

  document.querySelector("[data-trash]")?.addEventListener("click", (e) => {
    clearProps();
    e.currentTarget.blur();
  });
}

// ---------- spawning ----------

function randomSpot(nearFront = false) {
  const orb = getOrbPosition();
  // Hanging/floating things go nearer the front so they don't end up behind the top bar.
  const zMin = nearFront ? 0 : bounds.minZ * 0.6;
  const out = new THREE.Vector3();
  for (let i = 0; i < 20; i++) {
    out.set(
      THREE.MathUtils.lerp(bounds.minX * 0.75, bounds.maxX * 0.75, Math.random()),
      0,
      THREE.MathUtils.lerp(zMin, bounds.maxZ * 0.75, Math.random()),
    );
    if (Math.hypot(out.x - orb.x, out.z - orb.z) > 1.3) break;
  }
  return out;
}
ctx.randomSpot = randomSpot;
ctx.orbPosition = () => getOrbPosition();

function makeMaterial(prop) {
  const material = buildOrbMaterial(prop.appearance, prop.preset, prop.texture);
  material.emissiveIntensity = 0.05;
  return material;
}

/**
 * opts: { position, velocity, color, silent }
 */
export function spawn(type, opts = {}) {
  const item = ITEMS[type];
  if (!item) return null;
  if (props.length >= MAX_PROPS) {
    toast("that's a lot of stuff — try the trash can");
    return null;
  }

  let light = null;
  if (item.needsLight) {
    light = lampLights.find((l) => !l.userData.inUse) ?? null;
    if (!light) {
      toast(`${MAX_LAMPS} ${item.label}s max`);
      return null;
    }
    light.userData.inUse = true;
  }

  const palette = item.palette;
  const color = opts.color ?? palette[Math.floor(Math.random() * palette.length)];
  const placeholder = new THREE.MeshStandardMaterial();
  const built = item.create(placeholder, { light, ctx });

  const prop = {
    type,
    label: item.label,
    preset: "glossy",
    mass: 1,
    ...built,
    appearance: { color },
    texture: null,
    velocity: new THREE.Vector3(),
    grounded: false,
    born: ctx.elapsed,
    dead: false,
  };
  prop.light = light;
  prop.material = makeMaterial(prop);
  prop.main.forEach((m) => (m.material = prop.material));
  placeholder.dispose();

  // where it appears
  const spot =
    opts.position?.clone() ??
    prop.spawnAt?.(ctx, prop) ??
    (() => {
      const s = randomSpot(prop.hover != null || prop.nearFront);
      s.y = prop.hover != null ? prop.hover + 1 : 3.5;
      return s;
    })();
  prop.group.position.copy(spot);
  if (!prop.keepRotation) prop.group.rotation.y = (Math.random() - 0.5) * 0.8;
  if (opts.velocity) prop.velocity.copy(opts.velocity);

  prop.onSpawn?.(ctx, prop);
  scene.add(prop.group);
  prop.extras?.forEach((o) => scene.add(o));
  props.push(prop);
  if (!opts.silent) toast(item.label);
  return prop;
}

function removeProp(prop) {
  scene.remove(prop.group);
  prop.extras?.forEach((o) => scene.remove(o));
  const disposeTree = (root) =>
    root.traverse((o) => {
      if (o.isMesh || o.isLine || o.isPoints || o.isSprite) o.geometry?.dispose();
    });
  disposeTree(prop.group);
  prop.extras?.forEach(disposeTree);
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
  if (orbStatus.hat === prop) orbStatus.hat = null;
  if (drag.prop === prop) drag.prop = null;
}

export function clearProps() {
  if (!props.length) {
    toast("nothing to clear");
    return;
  }
  props.splice(0).forEach(removeProp);
  orbStatus.beam = 0;
  toast("cleared");
}

// ---------- color ----------

export function setPropColor(prop, value) {
  if (prop.dead) return;
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
  prop.onRecolor?.(prop);
}

export function propLabel(prop) {
  return prop.label;
}

// ---------- picking & dragging ----------

const pickTargets = [];

/** Closest prop part under the ray: { prop, part, distance, object } or null. */
export function pickProp(raycaster) {
  pickTargets.length = 0;
  for (const p of props) {
    if (p.dead || p.unpickable) continue;
    pickTargets.push(p.group);
    if (p.anchor) pickTargets.push(p.anchor);
  }
  if (!pickTargets.length) return null;
  const hit = raycaster.intersectObjects(pickTargets, true)[0];
  if (!hit) return null;
  for (const p of props) {
    if (p.anchor && hit.object === p.anchor) {
      return { prop: p, part: "anchor", distance: hit.distance, object: hit.object, point: hit.point };
    }
    let o = hit.object;
    while (o) {
      if (o === p.group) {
        return { prop: p, part: "body", distance: hit.distance, object: hit.object, point: hit.point };
      }
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
  drag.hitObject = pick.object;
  const obj = partObject(pick.prop, pick.part);
  camera.getWorldDirection(tmp).negate();
  const anchorPoint = pick.prop.dragPoint?.(pick) ?? obj.position;
  drag.plane.setFromNormalAndCoplanarPoint(tmp, anchorPoint);
  if (raycaster.ray.intersectPlane(drag.plane, tmp2)) {
    drag.offset.subVectors(anchorPoint, tmp2);
  } else {
    drag.offset.set(0, 0, 0);
  }
  drag.target.copy(anchorPoint);
  if (pick.part === "body") pick.prop.velocity.set(0, 0, 0);
  pick.prop.onGrab?.(ctx, pick.prop, pick);
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
  const part = drag.part;
  drag.prop = null;
  if (!prop) return null;
  prop.onRelease?.(ctx, prop);
  if (isTap) {
    if (prop.onTap) prop.onTap(ctx, prop);
    else prop.velocity.y = 0.12;
    return prop;
  }
  // Throw with the speed it was being dragged at (an anchor just stays put).
  if (part === "body" && prop.velocity.length() > 0.45) prop.velocity.setLength(0.45);
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

function defaultPhysics(prop, dt, k) {
  const dragged = drag.prop === prop;
  const body = prop.group;
  // origin height above the floor
  const half = prop.floorOffset ?? (prop.capsule.centered ? prop.capsule.r : 0);

  if (dragged) {
    tmp.copy(body.position);
    body.position.lerp(drag.target, 1 - Math.exp(-dt * 25));
    prop.velocity.subVectors(body.position, tmp).divideScalar(Math.max(k, 1e-4));
  } else if (prop.hover != null) {
    // Floaty: springs back to its hover height, drifts to a stop.
    const target = prop.hover + (prop.bob?.(ctx.elapsed, prop) ?? 0);
    prop.velocity.y += (target - body.position.y) * 0.01 * k;
    prop.velocity.multiplyScalar(Math.pow(0.95, k));
    body.position.addScaledVector(prop.velocity, k);
  } else {
    prop.velocity.y += GRAVITY * physics.gravity * k;
    body.position.addScaledVector(prop.velocity, k);
  }

  // floor
  prop.grounded = false;
  if (body.position.y < half) {
    body.position.y = half;
    prop.grounded = true;
    if (prop.velocity.y < 0) {
      const impact = -prop.velocity.y;
      prop.velocity.y = impact > 0.05 ? impact * (prop.landBounce ?? PROP_BOUNCE) : 0;
      if (impact > 0.05) {
        prop.nudge?.(tmp.set(Math.random() - 0.5, 0, Math.random() - 0.5), impact * 0.5);
        prop.onLand?.(ctx, prop, impact);
      }
    }
    if (!dragged) {
      const f = Math.pow(prop.friction ?? FRICTION, k);
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
}

/**
 * orb: { position, velocity, radius, mass, kinematic, onImpact }
 * Velocities are "per frame at 60fps", same as the orb.
 */
export function updateProps(dt, nightFactor, orb) {
  currentOrb = orb;
  const k = dt * 60;
  ctx.dt = dt;
  ctx.k = k;
  ctx.nightFactor = nightFactor;
  ctx.orb = orb;
  ctx.elapsed = orbStatus.now;

  // The UFO re-asserts its beam every frame; otherwise it fades.
  orbStatus.beam = Math.max(0, orbStatus.beam - dt * 3);

  if (!props.length) return;

  for (const prop of props) {
    if (prop.dead) continue;
    if (prop.physics) prop.physics(dt, ctx, prop, drag);
    else defaultPhysics(prop, dt, k);
    prop.tick?.(dt, ctx, prop);
    // Gentle glow at night so things don't vanish into the void.
    if (!prop.ownGlow) prop.material.emissiveIntensity = 0.05 + nightFactor * 0.12;
  }

  collideWithOrb(orb);
  collidePropsWithEachOther();

  // Clean up anything that removed itself this frame.
  for (let i = props.length - 1; i >= 0; i--) {
    if (props[i].dead) removeProp(props.splice(i, 1)[0]);
  }
}

function collideWithOrb(orb) {
  if (!orb) return;
  const invOrb = orb.kinematic ? 0 : 1 / orb.mass;

  for (const prop of props) {
    if (prop.dead || prop.noCollide) continue;
    capsuleSegment(prop);
    closestOnSegment(orb.position, segA, segB, closest);
    normal.subVectors(orb.position, closest);
    const dist = normal.length();
    const minDist = orb.radius + prop.capsule.r;
    if (dist >= minDist) continue;

    if (prop.passThrough) {
      prop.onOrbOverlap?.(ctx, prop);
      continue;
    }

    if (dist < 1e-5) normal.set(0, 1, 0);
    else normal.divideScalar(dist);

    const invProp = invMass(prop, drag.prop === prop || prop.kinematic);
    const invSum = invOrb + invProp;
    if (invSum === 0) continue;

    // Push apart (shared by how heavy each one is).
    const overlap = minDist - dist;
    orb.position.addScaledVector(normal, (overlap * invOrb) / invSum);
    if (!prop.physics || prop.allowPush) {
      prop.group.position.addScaledVector(normal, (-overlap * invProp) / invSum);
    }
    if (prop.group.position.y < 0 && !prop.capsule.centered) prop.group.position.y = 0;

    // Bounce off each other.
    const vn = tmp.subVectors(orb.velocity, prop.velocity).dot(normal);
    if (vn < 0) {
      const e = prop.restitution ?? DEFAULT_RESTITUTION;
      const j = (-(1 + e) * vn) / invSum;
      orb.velocity.addScaledVector(normal, j * invOrb);
      prop.velocity.addScaledVector(normal, -j * invProp);
      orb.onImpact?.(normal, -vn);
      prop.nudge?.(tmp2.copy(normal).negate(), -vn);
      prop.onOrbHit?.(ctx, prop, -vn, normal);
    }
  }
}

function collidePropsWithEachOther() {
  for (let i = 0; i < props.length; i++) {
    const a = props[i];
    if (a.dead || a.passThrough || a.noCollide || a.physics) continue;
    for (let j = i + 1; j < props.length; j++) {
      const b = props[j];
      if (b.dead || b.passThrough || b.noCollide || b.physics) continue;
      // Simple: compare as spheres around each capsule's middle.
      capsuleSegment(a);
      const ca = tmp.addVectors(segA, segB).multiplyScalar(0.5).clone();
      capsuleSegment(b);
      const cb = tmp2.addVectors(segA, segB).multiplyScalar(0.5);
      normal.subVectors(ca, cb);
      if (Math.abs(normal.y) > a.capsule.r + b.capsule.r) continue;
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
      a.onPropHit?.(ctx, a, b);
      b.onPropHit?.(ctx, b, a);
    }
  }
}

export function getProps() {
  return props;
}

export function getCurrentOrb() {
  return currentOrb;
}

// Dev-only helpers (used by automated checks; stripped from the live build).
export const debug = {
  tapAll: () => props.forEach((p) => p.onTap?.(ctx, p)),
  hitAll: (impact = 0.3) =>
    props.forEach((p) => p.onOrbHit?.(ctx, p, impact, new THREE.Vector3(0, 1, 0))),
  list: () => props.map((p) => p.type),
};
