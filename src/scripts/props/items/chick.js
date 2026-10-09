import * as THREE from "three";
import { materialBag, part, randomFlat } from "./util.js";

// The chick that hatches out of an egg. Hops about now and then.
export function createChick(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const beak = bag.std(0xff9f1c);
  const eye = bag.std(0x15151c, { roughness: 0.2 });

  const body = part(group, new THREE.SphereGeometry(0.13, 24, 18), main, 0, 0.13, 0, mainParts);
  body.scale.set(1, 0.95, 1.05);
  part(group, new THREE.SphereGeometry(0.09, 24, 18), main, 0, 0.27, 0.05, mainParts);
  const b = part(group, new THREE.ConeGeometry(0.03, 0.06, 8), beak, 0, 0.26, 0.15);
  b.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    part(group, new THREE.SphereGeometry(0.015, 8, 6), eye, side * 0.04, 0.3, 0.12);
    const wing = part(group, new THREE.SphereGeometry(0.06, 12, 8), main, side * 0.12, 0.14, -0.01, mainParts);
    wing.scale.set(0.35, 0.8, 1.1);
  }
  const tuft = part(group, new THREE.ConeGeometry(0.02, 0.06, 6), main, 0, 0.38, 0.04, mainParts);
  tuft.rotation.x = -0.4;

  let nextHop = 1.5;
  const dir = new THREE.Vector3();

  return {
    group,
    main: mainParts,
    capsule: { a: 0.12, b: 0.2, r: 0.14 },
    mass: 0.3,
    preset: "matte",
    tick(dt, ctx, prop) {
      nextHop -= dt;
      if (nextHop < 0 && prop.grounded && !ctx.isDragged(prop)) {
        nextHop = 1.5 + Math.random() * 2.5;
        randomFlat(dir);
        prop.velocity.set(dir.x * 0.04, 0.14, dir.z * 0.04);
        group.rotation.y = Math.atan2(dir.x, dir.z);
      }
    },
    onTap(ctx, prop) {
      ctx.sfx.squeak();
      prop.velocity.y = 0.16;
    },
    dispose: bag.dispose,
  };
}
