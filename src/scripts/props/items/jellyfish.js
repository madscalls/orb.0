import * as THREE from "three";
import { materialBag, part, makeTranslucent } from "./util.js";

// J — jellyfish. Floats and pulses, trailing wavy tentacles; glows in the dark.
export function createJellyfish(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();

  const bellPivot = new THREE.Group();
  bellPivot.position.y = 0.45;
  group.add(bellPivot);
  const bell = part(bellPivot, new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0, 0, mainParts, false);
  const rim = part(bellPivot, new THREE.TorusGeometry(0.27, 0.025, 8, 40), main, 0, 0, 0, mainParts, false);
  rim.rotation.x = Math.PI / 2;

  // tentacles: lines whose points wave every frame
  const tentacleMat = bag.keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  const tentacles = [];
  const POINTS = 10;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.17;
    const geometry = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: POINTS }, () => new THREE.Vector3()),
    );
    const line = new THREE.Line(geometry, tentacleMat);
    line.frustumCulled = false;
    group.add(line);
    tentacles.push({ line, x: Math.cos(a) * r, z: Math.sin(a) * r, phase: i * 1.3, length: 0.45 + Math.random() * 0.25 });
  }

  const seed = Math.random() * 100;

  return {
    group,
    main: mainParts,
    capsule: { a: 0.25, b: 0.5, r: 0.28 },
    mass: 0.3,
    restitution: 0.2,
    hover: 1.6,
    bob: (t) => Math.sin(t * 1.8 + seed) * 0.12,
    nearFront: true,
    ownGlow: true,
    preset: "jelly",
    onSpawn(_ctx, prop) {
      makeTranslucent(prop, 0.7);
      tentacleMat.color.set(prop.appearance.color);
    },
    onRecolor(prop) {
      makeTranslucent(prop, 0.7);
      if (prop.appearance.color) tentacleMat.color.set(prop.appearance.color);
    },
    tick(dt, ctx, prop) {
      const t = ctx.elapsed + seed;
      // pulse: squeeze and relax
      const pulse = Math.sin(t * 3.6);
      bellPivot.scale.set(1 - pulse * 0.08, 1 + pulse * 0.12, 1 - pulse * 0.08);
      // drift
      if (!ctx.isDragged(prop)) {
        prop.velocity.x += Math.sin(t * 0.25) * 0.0004 * ctx.k;
        prop.velocity.z += Math.cos(t * 0.21) * 0.0004 * ctx.k;
      }
      for (const tn of tentacles) {
        const pos = tn.line.geometry.attributes.position;
        for (let i = 0; i < POINTS; i++) {
          const f = i / (POINTS - 1);
          const sway = Math.sin(t * 2.4 - f * 4 + tn.phase) * 0.06 * f;
          pos.setXYZ(i, tn.x + sway - prop.velocity.x * f * 4, 0.45 - f * tn.length, tn.z + sway * 0.6 - prop.velocity.z * f * 4);
        }
        pos.needsUpdate = true;
      }
      prop.material.emissiveIntensity = 0.2 + ctx.nightFactor * 0.6;
      tentacleMat.opacity = 0.45 + ctx.nightFactor * 0.4;
    },
    onTap(ctx, prop) {
      prop.velocity.y = 0.08;
    },
    dispose: bag.dispose,
  };
}
