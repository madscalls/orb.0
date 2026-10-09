import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { materialBag, part, horizontalDistance } from "./util.js";

// I — ice cube. Slides around, slowly melts into a slippery puddle,
// and the puddle dries up after a while.
const MELT_SECONDS = 30;
const PUDDLE_SECONDS = 20;

export function createIce(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const cube = part(group, new RoundedBoxGeometry(0.4, 0.4, 0.4, 3, 0.06), main, 0, 0.2, 0, mainParts);

  const puddleMat = bag.std(0x8fd3ff, {
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), puddleMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.receiveShadow = true;
  puddle.scale.setScalar(0.01);

  let melt = 0; // 0..1
  let dryTime = 0;
  let slippingAt = -10;

  return {
    group,
    main: mainParts,
    extras: [puddle],
    capsule: { a: 0.15, b: 0.25, r: 0.22 },
    mass: 0.8,
    friction: 0.995, // ice slides!
    preset: "jelly",
    tick(dt, ctx, prop) {
      if (melt < 1) {
        melt = Math.min(1, melt + dt / MELT_SECONDS);
        const s = 1 - melt * 0.92;
        cube.scale.setScalar(s);
        cube.position.y = 0.2 * s;
        prop.capsule.r = 0.22 * s;
        prop.capsule.a = 0.15 * s;
        prop.capsule.b = 0.25 * s;
        // the puddle trails the cube while it melts
        puddle.position.set(group.position.x, 0.006, group.position.z);
        puddle.scale.setScalar(0.12 + melt * 0.55);
        if (melt >= 1) {
          cube.visible = false;
          prop.noCollide = true;
          prop.unpickable = true;
          ctx.toast("melted");
        }
      } else {
        dryTime += dt;
        const left = 1 - dryTime / PUDDLE_SECONDS;
        puddleMat.opacity = 0.55 * Math.max(0, left);
        puddle.scale.setScalar(0.67 * Math.max(0.2, left));
        if (left <= 0) ctx.remove(prop);
      }

      // Rolling through the puddle = no grip.
      const orb = ctx.orb;
      if (
        orb &&
        orb.position.y - orb.radius < 0.12 &&
        horizontalDistance(orb.position, puddle.position) < puddle.scale.x
      ) {
        ctx.status.slipUntil = Math.max(ctx.status.slipUntil, ctx.elapsed + 0.5);
        if (ctx.elapsed - slippingAt > 2) ctx.sfx.slip();
        slippingAt = ctx.elapsed;
      }
    },
    dispose: bag.dispose,
  };
}
