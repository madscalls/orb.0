import * as THREE from "three";
import { materialBag, part } from "./util.js";

// B — banana peel. Roll the orb over it and it loses all grip for a moment.
export function createBanana(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const brown = bag.std(0x6b4a2b);

  // four flopped-open petals
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const petal = part(group, new THREE.SphereGeometry(0.1, 20, 12), main, 0, 0.03, 0, mainParts);
    petal.scale.set(0.75, 0.28, 2.2);
    petal.position.set(Math.sin(a) * 0.17, 0.03, Math.cos(a) * 0.17);
    petal.rotation.y = a;
    petal.rotation.x = -0.15;
  }
  const middle = part(group, new THREE.SphereGeometry(0.08, 16, 12), main, 0, 0.06, 0, mainParts);
  middle.scale.set(1, 0.7, 1);
  const stem = part(group, new THREE.CylinderGeometry(0.02, 0.03, 0.08, 8), brown, 0, 0.12, 0);
  stem.rotation.z = 0.4;

  let cooldownUntil = 0;

  return {
    group,
    main: mainParts,
    capsule: { a: 0, b: 0.05, r: 0.3 },
    mass: 0.3,
    friction: 0.97, // slides a bit itself
    passThrough: true,
    preset: "glossy",
    onOrbOverlap(ctx, prop) {
      const orb = ctx.orb;
      const speed = Math.hypot(orb.velocity.x, orb.velocity.z);
      const onFloor = orb.position.y - orb.radius < 0.12;
      if (!onFloor || speed < 0.02 || ctx.elapsed < cooldownUntil) return;
      cooldownUntil = ctx.elapsed + 1.5;
      ctx.status.slipUntil = ctx.elapsed + 1.4;
      // a sideways skid…
      orb.velocity.x += (Math.random() - 0.5) * 0.12;
      orb.velocity.z += (Math.random() - 0.5) * 0.12;
      orb.velocity.y += 0.08;
      // …and the peel shoots off the other way
      prop.velocity.set(-orb.velocity.x * 1.2, 0.05, -orb.velocity.z * 1.2);
      ctx.sfx.slip();
      ctx.toast("whoops!");
    },
    dispose: bag.dispose,
  };
}

