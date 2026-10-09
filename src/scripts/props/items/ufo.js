import * as THREE from "three";
import { materialBag, part, horizontalDistance } from "./util.js";

// U — UFO. Hovers around; roll the orb underneath and it beams it up,
// holds it for a moment, then lets go.
export function createUfo(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const glass = bag.std(0x9be7ff, { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const alien = bag.std(0x7ddc5a, { roughness: 0.5 });
  const lightMat = bag.basic(0xffffff);
  const beamMat = bag.basic(0xb8ffcf, {
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const saucer = part(group, new THREE.SphereGeometry(0.55, 40, 20), main, 0, 0, 0, mainParts);
  saucer.scale.y = 0.24;
  const rim = part(group, new THREE.TorusGeometry(0.52, 0.04, 8, 48), main, 0, 0, 0, mainParts);
  rim.rotation.x = Math.PI / 2;
  part(group, new THREE.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.08, 0, null, false);
  part(group, new THREE.SphereGeometry(0.08, 16, 12), alien, 0, 0.14, 0, null, false);
  const lights = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = lightMat.clone();
    bag.keep(m);
    const l = part(group, new THREE.SphereGeometry(0.035, 10, 8), m, Math.cos(a) * 0.48, -0.03, Math.sin(a) * 0.48, null, false);
    lights.push(l);
  }
  const BEAM_H = 2.6;
  const beamGeo = new THREE.CylinderGeometry(0.18, 0.55, BEAM_H, 32, 1, true);
  beamGeo.translate(0, -BEAM_H / 2, 0);
  const beam = part(group, beamGeo, beamMat, 0, -0.05, 0, null, false);

  const seed = Math.random() * 100;
  let state = "roam"; // roam → beaming → holding → cooldown
  let timer = 0;
  let beamLevel = 0;

  return {
    group,
    main: mainParts,
    capsule: { a: 0, b: 0, r: 0.5, centered: true },
    mass: 3,
    hover: 2.6,
    bob: (t) => Math.sin(t * 1.2 + seed) * 0.08,
    nearFront: true,
    preset: "metal",
    tick(dt, ctx, prop) {
      const t = ctx.elapsed + seed;
      group.rotation.y += dt * 0.8;
      lights.forEach((l, i) => {
        const on = (Math.floor(t * 6) + i) % 3 === 0;
        l.material.color.setRGB(on ? 2.2 : 0.4, on ? 2.4 : 0.6, on ? 1.2 : 0.3);
      });

      const orb = ctx.orb;
      const dragged = ctx.isDragged(prop);
      if (!dragged && state === "roam") {
        // lazily wander
        prop.velocity.x += Math.sin(t * 0.35) * 0.0006 * ctx.k;
        prop.velocity.z += Math.cos(t * 0.27) * 0.0006 * ctx.k;
      }
      const under =
        orb &&
        !orb.kinematic &&
        horizontalDistance(orb.position, group.position) < 0.65 &&
        orb.position.y < group.position.y;

      if (state === "roam" && under && !dragged) {
        state = "beaming";
        ctx.sfx.beam();
        ctx.toast("beam me up");
      }
      if (state === "beaming" || state === "holding") {
        if (!orb || orb.kinematic || dragged || horizontalDistance(orb.position, group.position) > 1) {
          state = "cooldown";
          timer = 3;
        } else {
          // pull toward the middle of the beam and lift
          orb.velocity.x += (group.position.x - orb.position.x) * 0.02 * ctx.k;
          orb.velocity.z += (group.position.z - orb.position.z) * 0.02 * ctx.k;
          orb.velocity.x *= Math.pow(0.9, ctx.k);
          orb.velocity.z *= Math.pow(0.9, ctx.k);
          const gap = group.position.y - 0.25 - orb.radius - orb.position.y;
          if (state === "beaming") {
            ctx.status.beam = 1.5; // gravity flips: up it goes
            orb.velocity.y = Math.min(orb.velocity.y, 0.12);
            if (gap < 0.15) {
              state = "holding";
              timer = 2.2;
            }
          } else {
            ctx.status.beam = 1;
            orb.velocity.y *= 0.8;
            orb.velocity.y += gap * 0.02;
            timer -= dt;
            if (timer <= 0) {
              state = "cooldown";
              timer = 4;
              ctx.toast("…nah, put it back");
            }
          }
        }
      }
      if (state === "cooldown") {
        timer -= dt;
        if (timer <= 0) state = "roam";
      }

      const wantBeam = state === "beaming" || state === "holding" ? 1 : 0;
      beamLevel += (wantBeam - beamLevel) * Math.min(1, dt * 6);
      beamMat.opacity = beamLevel * (0.28 + Math.sin(t * 20) * 0.04);
      beam.visible = beamLevel > 0.01;
    },
    onTap(ctx) {
      ctx.toast("greetings, earthling");
    },
    dispose: bag.dispose,
  };
}
