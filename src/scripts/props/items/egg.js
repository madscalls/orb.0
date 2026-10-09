import * as THREE from "three";
import { materialBag, part } from "./util.js";

// E — an egg. Drop it or hit it too hard and it cracks… into a chick.

function eggProfile(from = 0, to = 1, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI * (from + (to - from) * (i / steps));
    const r = 0.15 * Math.sin(t) * (1 + 0.12 * Math.cos(t));
    const y = 0.21 * (1 - Math.cos(t));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return pts;
}

export function createEgg(main) {
  const group = new THREE.Group();
  const mainParts = [];
  part(group, new THREE.LatheGeometry(eggProfile(), 32), main, 0, 0, 0, mainParts);

  let cracked = false;
  function crack(ctx, prop) {
    if (cracked) return;
    cracked = true;
    ctx.sfx.crack();
    const at = prop.group.position.clone();
    ctx.spawn("shells", { position: at, color: prop.appearance.color, silent: true });
    ctx.spawn("chick", { position: at.clone().setY(0.05), velocity: new THREE.Vector3(0, 0.18, 0), silent: true });
    ctx.toast("it's a chick!");
    ctx.remove(prop);
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0.15, b: 0.28, r: 0.15 },
    mass: 0.4,
    preset: "glossy",
    // Set down gently so it doesn't hatch the moment it arrives.
    spawnAt(ctx) {
      const s = ctx.randomSpot();
      s.y = 0.6;
      return s;
    },
    onLand(ctx, prop, impact) {
      if (impact > 0.26 * Math.sqrt(Math.max(1, ctx.gravity() / -0.02))) crack(ctx, prop);
    },
    onOrbHit(ctx, prop, impact) {
      if (impact > 0.14) crack(ctx, prop);
    },
    onTap(ctx, prop) {
      prop.velocity.y = 0.1;
      ctx.toast("careful…");
    },
  };
}

// The two halves left behind. They don't collide, and fade away after a bit.
export function createShells(main) {
  const group = new THREE.Group();
  const bag = materialBag();
  const shellMat = bag.std(0xf6eedd, { side: THREE.DoubleSide, roughness: 0.4 });
  const bottom = part(group, new THREE.LatheGeometry(eggProfile(0, 0.55), 24), shellMat, 0.12, 0, 0);
  const top = part(group, new THREE.LatheGeometry(eggProfile(0.55, 1), 24), shellMat, -0.15, 0.32, 0.05);
  top.rotation.z = Math.PI * 0.85; // flipped over like a little cup
  const life = { t: 0 };

  return {
    group,
    main: [],
    capsule: { a: 0, b: 0.1, r: 0.2 },
    mass: 0.2,
    noCollide: true,
    unpickable: true,
    keepRotation: true,
    onSpawn(_ctx, prop) {
      // match the egg's color
      shellMat.color.set(prop.appearance.color);
    },
    tick(dt, ctx, prop) {
      life.t += dt;
      if (life.t > 8) {
        const s = Math.max(0, 1 - (life.t - 8) / 1.5);
        group.scale.setScalar(s);
        if (s === 0) ctx.remove(prop);
      }
    },
    dispose: bag.dispose,
  };
}
