import * as THREE from "three";
import { materialBag, part } from "./util.js";

// M — mushroom trampoline. Land on the cap and it launches the orb sky-high.
export function createMushroom(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const stemMat = bag.std(0xf4ead8, { roughness: 0.8 });
  const spotMat = bag.std(0xffffff, { roughness: 0.6 });

  part(group, new THREE.CylinderGeometry(0.13, 0.17, 0.42, 24), stemMat, 0, 0.21, 0);
  const capPivot = new THREE.Group();
  capPivot.position.y = 0.38;
  group.add(capPivot);
  const cap = part(capPivot, new THREE.SphereGeometry(0.45, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0, 0, mainParts);
  cap.scale.y = 0.65;
  const under = part(capPivot, new THREE.CircleGeometry(0.45, 40), stemMat, 0, 0.001, 0, null, false);
  under.rotation.x = Math.PI / 2;
  // white spots sitting on the cap
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2;
    const tilt = 0.25 + Math.random() * 0.9; // angle down from the top
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt) * 0.65, Math.sin(tilt) * Math.sin(a));
    const spot = part(capPivot, new THREE.SphereGeometry(0.05 + Math.random() * 0.03, 12, 8), spotMat, dir.x * 0.45, dir.y * 0.45, dir.z * 0.45, null, false);
    spot.scale.y = 0.35;
    spot.lookAt(dir.clone().multiplyScalar(2).add(spot.position));
    spot.rotateX(Math.PI / 2);
  }

  let squash = 0;
  let squashVel = 0;

  return {
    group,
    main: mainParts,
    capsule: { a: 0.45, b: 0.55, r: 0.4 },
    mass: Infinity,
    restitution: 0.6,
    preset: "glossy",
    tick(dt) {
      const k = dt * 60;
      squashVel += (-squash * 0.25 - squashVel * 0.18) * k;
      squash += squashVel * k;
      capPivot.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    },
    onOrbHit(ctx, _prop, impact, normal) {
      if (normal.y > 0.45) {
        // came down on top: bounce way up
        const lift = 0.5 * Math.sqrt(-ctx.gravity() / 0.02);
        ctx.orb.velocity.y = Math.max(ctx.orb.velocity.y, lift);
        squashVel += 0.12;
        ctx.sfx.boing();
      } else if (impact > 0.05) {
        squashVel += 0.04;
        ctx.sfx.boing();
      }
    },
    onTap(ctx) {
      squashVel += 0.1;
      ctx.sfx.boing();
    },
    dispose: bag.dispose,
  };
}
