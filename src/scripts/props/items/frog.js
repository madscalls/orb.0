import * as THREE from "three";
import { materialBag, part, randomFlat } from "./util.js";

// F — frog. Every few seconds it hops somewhere new (and says so).
export function createFrog(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const white = bag.std(0xffffff, { roughness: 0.3 });
  const pupil = bag.std(0x15151c, { roughness: 0.2 });
  const belly = bag.std(0xf3f0c8, { roughness: 0.7 });
  const mouth = bag.std(0x2a1b1b);

  const body = part(group, new THREE.SphereGeometry(0.22, 28, 20), main, 0, 0.17, 0, mainParts);
  body.scale.set(1.15, 0.75, 1);
  const tummy = part(group, new THREE.SphereGeometry(0.17, 20, 14), belly, 0, 0.13, 0.09);
  tummy.scale.set(1.05, 0.6, 0.8);

  for (const side of [-1, 1]) {
    // eye bumps on top
    part(group, new THREE.SphereGeometry(0.075, 18, 14), main, side * 0.11, 0.3, 0.06, mainParts);
    part(group, new THREE.SphereGeometry(0.052, 16, 12), white, side * 0.11, 0.32, 0.1);
    part(group, new THREE.SphereGeometry(0.027, 12, 8), pupil, side * 0.11, 0.325, 0.145);
    // back legs folded
    const thigh = part(group, new THREE.SphereGeometry(0.1, 16, 12), main, side * 0.2, 0.08, -0.06, mainParts);
    thigh.scale.set(0.7, 0.55, 1.2);
    // front feet
    const foot = part(group, new THREE.SphereGeometry(0.05, 12, 8), main, side * 0.12, 0.025, 0.17, mainParts);
    foot.scale.set(1.2, 0.4, 1.3);
  }
  const smile = part(group, new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI), mouth, 0, 0.19, 0.19, null, false);
  smile.rotation.z = Math.PI;
  smile.rotation.x = 0.35;

  let nextHop = 2;
  const dir = new THREE.Vector3();

  function hop(ctx, prop) {
    randomFlat(dir);
    // Lean toward the middle so it doesn't hug the walls.
    dir.x -= group.position.x * 0.1;
    dir.z -= group.position.z * 0.1;
    dir.normalize();
    prop.velocity.set(dir.x * 0.07, 0.26 * Math.sqrt(-ctx.gravity() / 0.02), dir.z * 0.07);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    ctx.sfx.ribbit();
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0.15, b: 0.2, r: 0.22 },
    mass: 0.6,
    preset: "glossy",
    keepRotation: true,
    tick(dt, ctx, prop) {
      nextHop -= dt;
      if (nextHop < 0 && prop.grounded && !ctx.isDragged(prop)) {
        nextHop = 2 + Math.random() * 2.5;
        hop(ctx, prop);
      }
      // stretch out in mid-air, squat on the ground
      const target = prop.grounded ? 1 : 1.25;
      group.scale.z += (target - group.scale.z) * Math.min(1, dt * 12);
    },
    onTap(ctx, prop) {
      nextHop = 2 + Math.random() * 2;
      hop(ctx, prop);
    },
    dispose: bag.dispose,
  };
}
