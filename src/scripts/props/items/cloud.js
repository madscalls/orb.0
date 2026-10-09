import * as THREE from "three";
import { part, textSprite, horizontalDistance } from "./util.js";

// Z — sleepy cloud. Puffs out "z"s; roll the orb underneath and it dozes off.
export function createCloud(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const puffs = [
    [0, 0, 0, 0.28], [0.26, -0.04, 0.02, 0.21], [-0.27, -0.05, 0, 0.2],
    [0.12, 0.13, -0.02, 0.2], [-0.13, 0.11, 0.03, 0.19], [0.42, -0.08, 0, 0.13],
  ];
  for (const [x, y, z, r] of puffs) part(group, new THREE.SphereGeometry(r, 24, 16), main, x, y, z, mainParts, true);

  // little "z"s floating up from the cloud, and later from a sleeping orb
  const zs = Array.from({ length: 6 }, () => {
    const s = textSprite("z", "#ffffff", 0.3);
    s.visible = false;
    return { sprite: s, life: 0 };
  });
  let nextZ = 0;
  let zzzAt = -10;
  const seed = Math.random() * 100;

  function puffZ(from) {
    const z = zs.find((x) => x.life <= 0) ?? zs[0];
    z.life = 1;
    z.sprite.visible = true;
    z.sprite.position.copy(from);
    z.sprite.userData.dx = (Math.random() - 0.5) * 0.3;
  }

  return {
    group,
    main: mainParts,
    extras: zs.map((z) => z.sprite),
    capsule: { a: 0, b: 0, r: 0.35, centered: true },
    mass: 0.5,
    hover: 2.5,
    bob: (t) => Math.sin(t * 0.9 + seed) * 0.1,
    passThrough: true,
    nearFront: true,
    preset: "matte",
    tick(dt, ctx, prop) {
      const t = ctx.elapsed + seed;
      if (!ctx.isDragged(prop)) {
        prop.velocity.x += Math.sin(t * 0.2) * 0.0005 * ctx.k;
        prop.velocity.z += Math.cos(t * 0.17) * 0.0004 * ctx.k;
      }
      const orb = ctx.orb;
      const asleep = ctx.elapsed < ctx.status.sleepUntil;

      // Under the cloud = nap time.
      if (orb && !orb.kinematic && horizontalDistance(orb.position, group.position) < 0.8) {
        ctx.status.sleepUntil = ctx.elapsed + 4;
        if (ctx.elapsed - zzzAt > 6) {
          zzzAt = ctx.elapsed;
          ctx.toast("zzz…");
        }
      }

      nextZ -= dt;
      if (nextZ <= 0) {
        nextZ = 0.9;
        puffZ(group.position.clone().add(new THREE.Vector3(0.2, 0.25, 0)));
        if (asleep && orb) puffZ(orb.position.clone().add(new THREE.Vector3(0.2, orb.radius + 0.15, 0)));
      }
      for (const z of zs) {
        if (z.life <= 0) continue;
        z.life -= dt * 0.5;
        z.sprite.position.y += dt * 0.35;
        z.sprite.position.x += z.sprite.userData.dx * dt;
        z.sprite.material.opacity = Math.max(0, z.life);
        z.sprite.scale.setScalar(0.18 + (1 - z.life) * 0.22);
        if (z.life <= 0) z.sprite.visible = false;
      }
      prop.material.emissiveIntensity = 0.05 + ctx.nightFactor * 0.08;
    },
    ownGlow: true,
    onTap(ctx) {
      ctx.toast("*yawn*");
    },
    dispose() {
      zs.forEach((z) => z.sprite.userData.dispose());
    },
  };
}
