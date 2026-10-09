import * as THREE from "three";
import { materialBag, part } from "./util.js";

// V — vase. Fragile: knock it hard and it shatters into pieces.
export function createVase(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const pts = [];
  const shape = [
    [0.0, 0.0], [0.12, 0.0], [0.16, 0.06], [0.2, 0.2], [0.19, 0.34],
    [0.12, 0.48], [0.08, 0.58], [0.09, 0.66], [0.12, 0.7], [0.11, 0.71],
  ];
  shape.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
  const body = part(group, new THREE.LatheGeometry(pts, 40), main, 0, 0, 0, mainParts);
  body.userData.isBody = true;

  // shards (hidden until it breaks)
  const shardMat = bag.std(0xffffff, { roughness: 0.3 });
  const shards = [];
  const shardGroup = new THREE.Group();
  group.add(shardGroup);
  for (let i = 0; i < 12; i++) {
    const s = part(shardGroup, new THREE.TetrahedronGeometry(0.06 + Math.random() * 0.05), shardMat, 0, 0, 0);
    s.visible = false;
    shards.push({ mesh: s, v: new THREE.Vector3(), spin: new THREE.Vector3() });
  }

  let broken = false;
  let brokenFor = 0;

  function shatter(ctx, prop, push) {
    if (broken) return;
    broken = true;
    body.visible = false;
    prop.noCollide = true;
    prop.unpickable = true;
    shardMat.color.copy(prop.material.color);
    if (prop.material.map) shardMat.color.set(0xffffff);
    shards.forEach((s, i) => {
      s.mesh.visible = true;
      s.mesh.position.set((Math.random() - 0.5) * 0.25, 0.1 + (i / shards.length) * 0.55, (Math.random() - 0.5) * 0.25);
      s.v.set((Math.random() - 0.5) * 0.12, 0.05 + Math.random() * 0.12, (Math.random() - 0.5) * 0.12);
      if (push) s.v.addScaledVector(push, 0.6);
      s.spin.set(Math.random(), Math.random(), Math.random()).multiplyScalar(0.4);
    });
    ctx.sfx.shatter();
    ctx.toast("oops.");
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0.15, b: 0.55, r: 0.2 },
    mass: 0.7,
    preset: "glossy",
    spawnAt(ctx) {
      const s = ctx.randomSpot();
      s.y = 0.5; // set down gently
      return s;
    },
    physics(dt, ctx, prop) {
      if (!broken) {
        ctx.defaultPhysics(prop);
        return;
      }
      brokenFor += dt;
      const k = dt * 60;
      for (const s of shards) {
        s.v.y += ctx.gravity() * k;
        s.mesh.position.addScaledVector(s.v, k);
        if (s.mesh.position.y < 0.03) {
          s.mesh.position.y = 0.03;
          s.v.y *= -0.3;
          s.v.x *= 0.7;
          s.v.z *= 0.7;
          s.spin.multiplyScalar(0.7);
        }
        s.mesh.rotation.x += s.spin.x * k;
        s.mesh.rotation.y += s.spin.y * k;
        s.mesh.rotation.z += s.spin.z * k;
      }
      if (brokenFor > 4) {
        const f = Math.max(0, 1 - (brokenFor - 4) / 1.5);
        shardGroup.scale.setScalar(f);
        if (f === 0) ctx.remove(prop);
      }
    },
    onOrbHit(ctx, prop, impact, normal) {
      if (impact > 0.1) shatter(ctx, prop, normal.clone().negate().multiplyScalar(impact));
    },
    onLand(ctx, prop, impact) {
      if (impact > 0.3 * Math.sqrt(Math.max(1, ctx.gravity() / -0.02))) shatter(ctx, prop);
    },
    onTap(ctx, prop) {
      prop.velocity.y = 0.08;
      ctx.toast("easy…");
    },
    dispose: bag.dispose,
  };
}
