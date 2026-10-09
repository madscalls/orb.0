import * as THREE from "three";
import { materialBag, part } from "./util.js";

// C — cactus in a pot. Doesn't budge; the orb bounces off it extra hard.
export function createCactus(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const pot = bag.std(0xc96f4a, { roughness: 0.8 });
  const soil = bag.std(0x4a3426, { roughness: 1 });
  const spine = bag.std(0xfff6dc);
  const flower = bag.std(0xff6fa8, { roughness: 0.6 });

  part(group, new THREE.CylinderGeometry(0.22, 0.17, 0.28, 24), pot, 0, 0.14, 0);
  part(group, new THREE.CylinderGeometry(0.235, 0.235, 0.06, 24), pot, 0, 0.29, 0);
  part(group, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), soil, 0, 0.31, 0);

  part(group, new THREE.CapsuleGeometry(0.13, 0.5, 8, 16), main, 0, 0.62, 0, mainParts);
  // arms: out sideways, then up
  for (const side of [-1, 1]) {
    const h = side === 1 ? 0.62 : 0.52;
    const out = part(group, new THREE.CapsuleGeometry(0.07, 0.12, 6, 12), main, side * 0.17, h, 0, mainParts);
    out.rotation.z = Math.PI / 2;
    part(group, new THREE.CapsuleGeometry(0.07, 0.16, 6, 12), main, side * 0.25, h + 0.1, 0, mainParts);
  }
  // little spines
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = 0.4 + Math.random() * 0.48;
    const s = part(group, new THREE.ConeGeometry(0.008, 0.05, 4), spine, Math.cos(a) * 0.135, y, Math.sin(a) * 0.135, null, false);
    s.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2);
    s.rotateX(Math.PI / 2);
  }
  // flower on top
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = part(group, new THREE.SphereGeometry(0.035, 10, 8), flower, Math.cos(a) * 0.04, 0.93, Math.sin(a) * 0.04, null, false);
    petal.scale.set(1, 0.5, 1);
  }

  let ouchAt = -10;
  return {
    group,
    main: mainParts,
    capsule: { a: 0.2, b: 0.85, r: 0.25 },
    mass: Infinity,
    restitution: 1.15, // boing!
    preset: "matte",
    onOrbHit(ctx, _prop, impact) {
      if (impact < 0.03) return;
      ctx.sfx.boing();
      if (impact > 0.08 && ctx.elapsed - ouchAt > 2) {
        ouchAt = ctx.elapsed;
        ctx.toast("ouch!");
      }
    },
    onTap(ctx) {
      ctx.toast("prickly…");
    },
    dispose: bag.dispose,
  };
}
