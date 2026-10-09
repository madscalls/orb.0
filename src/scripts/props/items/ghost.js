import * as THREE from "three";
import { materialBag, part, makeTranslucent } from "./util.js";

// G — ghost. Floats around, drifts, glows at night. The orb goes right through it.
export function createGhost(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const face = bag.std(0x15151c, { roughness: 0.3 });

  // head dome + a wavy sheet hanging down
  part(group, new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0.3, 0, mainParts, false);
  const sheetGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.36, 32, 6, true);
  const pos = sheetGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.17) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, y + Math.sin(a * 6) * 0.05);
    }
  }
  sheetGeo.computeVertexNormals();
  const sheet = part(group, sheetGeo, main, 0, 0.12, 0, mainParts, false);

  for (const side of [-1, 1]) {
    const e = part(group, new THREE.SphereGeometry(0.045, 14, 10), face, side * 0.1, 0.38, 0.26, null, false);
    e.scale.set(0.8, 1.3, 0.5);
  }
  const mouthPart = part(group, new THREE.SphereGeometry(0.04, 14, 10), face, 0, 0.26, 0.28, null, false);
  mouthPart.scale.set(0.9, 1.2, 0.5);

  const seed = Math.random() * 100;
  let booAt = -10;

  return {
    group,
    main: mainParts,
    capsule: { a: 0.1, b: 0.4, r: 0.3 },
    mass: 0.5,
    hover: 1.5,
    bob: (t) => Math.sin(t * 1.6 + seed) * 0.15,
    passThrough: true,
    nearFront: true,
    ownGlow: true,
    preset: "matte",
    onSpawn(_ctx, prop) {
      makeTranslucent(prop, 0.78);
    },
    onRecolor(prop) {
      makeTranslucent(prop, 0.78);
    },
    tick(dt, ctx, prop) {
      // lazy wandering drift
      if (!ctx.isDragged(prop)) {
        const t = ctx.elapsed * 0.3 + seed;
        prop.velocity.x += Math.sin(t) * 0.0006 * ctx.k;
        prop.velocity.z += Math.cos(t * 0.7) * 0.0006 * ctx.k;
      }
      group.rotation.z = Math.sin(ctx.elapsed * 1.3 + seed) * 0.08;
      // turn to face the camera
      group.rotation.y *= 0.95;
      prop.material.emissiveIntensity = 0.1 + ctx.nightFactor * 0.22;
    },
    onOrbOverlap(ctx) {
      if (ctx.elapsed - booAt > 3) {
        booAt = ctx.elapsed;
        ctx.sfx.boo();
        ctx.toast("boo!");
      }
    },
    onTap(ctx) {
      ctx.sfx.boo();
      ctx.toast("boo!");
    },
    dispose: bag.dispose,
  };
}
