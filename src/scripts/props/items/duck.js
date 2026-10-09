import * as THREE from "three";
import { materialBag, part } from "./util.js";

// Q — rubber duck. Squeaks every time anything happens to it.
export function createDuck(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const beakMat = bag.std(0xff8c1a, { roughness: 0.4 });
  const eyeMat = bag.std(0x15151c, { roughness: 0.2 });
  const shine = bag.basic(0xffffff);

  const squish = new THREE.Group();
  group.add(squish);
  const body = part(squish, new THREE.SphereGeometry(0.22, 32, 24), main, 0, 0.18, 0, mainParts);
  body.scale.set(1.05, 0.8, 1.25);
  const tail = part(squish, new THREE.ConeGeometry(0.08, 0.16, 16), main, 0, 0.27, -0.25, mainParts);
  tail.rotation.x = -0.9;
  part(squish, new THREE.SphereGeometry(0.15, 28, 20), main, 0, 0.42, 0.1, mainParts);
  const beak = part(squish, new THREE.SphereGeometry(0.075, 16, 12), beakMat, 0, 0.39, 0.25);
  beak.scale.set(1.2, 0.45, 1.1);
  for (const side of [-1, 1]) {
    part(squish, new THREE.SphereGeometry(0.025, 12, 8), eyeMat, side * 0.075, 0.47, 0.22);
    part(squish, new THREE.SphereGeometry(0.008, 6, 4), shine, side * 0.075 + 0.008, 0.48, 0.243, null, false);
    const wing = part(squish, new THREE.SphereGeometry(0.1, 16, 12), main, side * 0.2, 0.2, -0.02, mainParts);
    wing.scale.set(0.35, 0.6, 1.1);
  }

  let s = 0;
  let sv = 0;
  const squeak = (ctx) => {
    ctx.sfx.squeak();
    sv -= 0.08;
  };

  return {
    group,
    main: mainParts,
    capsule: { a: 0.18, b: 0.38, r: 0.23 },
    mass: 0.5,
    restitution: 0.6,
    landBounce: 0.4,
    preset: "glossy",
    tick(dt) {
      const k = dt * 60;
      sv += (-s * 0.3 - sv * 0.2) * k;
      s += sv * k;
      squish.scale.set(1 - s * 0.6, 1 + s, 1 - s * 0.6);
    },
    onOrbHit(ctx, _prop, impact) {
      if (impact > 0.02) squeak(ctx);
    },
    onLand(ctx) {
      squeak(ctx);
    },
    onTap(ctx, prop) {
      squeak(ctx);
      prop.velocity.y = 0.06;
    },
    dispose: bag.dispose,
  };
}
