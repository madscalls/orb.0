import * as THREE from "three";
import { materialBag, part } from "./util.js";

// R — toy rocket. Tap it (or bump it) and it blasts off, then drops back down.
export function createRocket(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const white = bag.std(0xf4f4f8, { roughness: 0.35 });
  const glass = bag.std(0x7fd4ff, { roughness: 0.1, metalness: 0.2, emissive: 0x2a7fb0, emissiveIntensity: 0.4 });
  const flameMat = bag.basic(0xffa040, { transparent: true, opacity: 0.9, depthWrite: false });

  part(group, new THREE.CylinderGeometry(0.13, 0.13, 0.5, 28), white, 0, 0.4, 0);
  part(group, new THREE.ConeGeometry(0.13, 0.24, 28), main, 0, 0.77, 0, mainParts);
  part(group, new THREE.CylinderGeometry(0.1, 0.13, 0.08, 28), main, 0, 0.15, 0, mainParts);
  const win = part(group, new THREE.CircleGeometry(0.05, 20), glass, 0, 0.5, 0.131, null, false);
  win.rotation.y = 0;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const fin = part(group, new THREE.BoxGeometry(0.02, 0.2, 0.14), main, Math.sin(a) * 0.16, 0.15, Math.cos(a) * 0.16, mainParts);
    fin.rotation.y = a;
  }
  const flame = part(group, new THREE.ConeGeometry(0.08, 0.3, 16), flameMat, 0, -0.04, 0, null, false);
  flame.rotation.x = Math.PI;
  flame.visible = false;

  let burn = 0; // seconds of thrust left

  function launch(ctx, prop) {
    if (burn > 0) return;
    burn = 1.6;
    prop.velocity.y = Math.max(prop.velocity.y, 0.1);
    ctx.sfx.whoosh();
    ctx.toast("3… 2… 1…");
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0.15, b: 0.75, r: 0.16 },
    mass: 0.7,
    preset: "glossy",
    tick(dt, ctx, prop) {
      if (burn > 0) {
        burn -= dt;
        // thrust beats gravity
        prop.velocity.y += (-ctx.gravity() * 1.9) * ctx.k;
        prop.velocity.x += Math.sin(ctx.elapsed * 13) * 0.002 * ctx.k;
        prop.velocity.y = Math.min(prop.velocity.y, 0.3);
        if (group.position.y > 5.5) prop.velocity.y = Math.min(prop.velocity.y, 0);
        flame.visible = true;
        flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        flameMat.color.setRGB(2.5, 1.2 + Math.random() * 0.4, 0.3); // hot enough to bloom
      } else {
        flame.visible = false;
      }
      group.rotation.z = burn > 0 ? Math.sin(ctx.elapsed * 13) * 0.05 : group.rotation.z * 0.9;
    },
    onOrbHit(ctx, prop, impact) {
      if (impact > 0.1) launch(ctx, prop);
    },
    onTap(ctx, prop) {
      launch(ctx, prop);
    },
    dispose: bag.dispose,
  };
}
