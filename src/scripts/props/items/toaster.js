import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { materialBag, part } from "./util.js";

// T — toaster. Tap it (or whack it with the orb) and it pops out two slices.
export function createToaster(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const dark = bag.std(0x222228, { roughness: 0.6 });
  const chrome = bag.std(0xd8dbe2, { metalness: 0.9, roughness: 0.2 });

  part(group, new RoundedBoxGeometry(0.56, 0.36, 0.34, 4, 0.08), main, 0, 0.2, 0, mainParts);
  for (const x of [-0.12, 0.12]) {
    part(group, new THREE.BoxGeometry(0.16, 0.02, 0.06), dark, x, 0.381, 0, null, false);
  }
  const lever = part(group, new THREE.BoxGeometry(0.03, 0.04, 0.08), chrome, 0.29, 0.3, 0);
  part(group, new THREE.BoxGeometry(0.5, 0.03, 0.3), dark, 0, 0.015, 0);

  let cooldown = 0;
  let leverT = 0;

  function pop(ctx, prop) {
    if (cooldown > 0) return;
    cooldown = 1.2;
    leverT = 1;
    ctx.sfx.pop();
    for (const x of [-0.12, 0.12]) {
      const at = prop.group.localToWorld(new THREE.Vector3(x, 0.45, 0));
      ctx.spawn("toast", {
        position: at,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.28 + Math.random() * 0.06, (Math.random() - 0.5) * 0.04),
        silent: true,
      });
    }
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0.15, b: 0.25, r: 0.25 },
    mass: 2,
    preset: "metal",
    tick(dt) {
      cooldown -= dt;
      leverT = Math.max(0, leverT - dt * 2);
      lever.position.y = 0.3 - Math.sin(leverT * Math.PI) * 0.1;
    },
    onOrbHit(ctx, prop, impact) {
      if (impact > 0.08) pop(ctx, prop);
    },
    onTap(ctx, prop) {
      pop(ctx, prop);
    },
    dispose: bag.dispose,
  };
}

// A slice of toast (only comes out of the toaster).
export function createToast(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const crust = bag.std(0x9a5b26, { roughness: 0.9 });
  part(group, new RoundedBoxGeometry(0.26, 0.28, 0.05, 2, 0.02), crust, 0, 0, 0);
  part(group, new RoundedBoxGeometry(0.22, 0.24, 0.052, 2, 0.02), main, 0, 0, 0, mainParts);
  let flip = (Math.random() - 0.5) * 0.4;

  return {
    group,
    main: mainParts,
    capsule: { a: 0, b: 0, r: 0.13, centered: true },
    floorOffset: 0.03, // lies flat once it lands
    mass: 0.15,
    preset: "matte",
    keepRotation: true,
    landBounce: 0.15,
    tick(dt, _ctx, prop) {
      if (!prop.grounded) {
        group.rotation.x += flip * dt * 20;
      } else {
        // settle flat
        const flat = Math.round(group.rotation.x / Math.PI) * Math.PI + Math.PI / 2;
        group.rotation.x += (flat - group.rotation.x) * Math.min(1, dt * 10);
        flip *= 0.9;
      }
    },
    onTap(ctx, prop) {
      prop.velocity.y = 0.14;
      flip = (Math.random() - 0.5) * 0.5;
      ctx.toast("crunch");
    },
    dispose: bag.dispose,
  };
}
