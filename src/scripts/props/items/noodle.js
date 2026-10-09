import * as THREE from "three";

// N — pool noodle. A floppy chain of points (verlet rope) that bends,
// flops over things and gets shoved around by the orb.
const COUNT = 9;
const SEG = 0.2;
const R = 0.075;

export function createNoodle(main) {
  const group = new THREE.Group(); // stays at the origin; parts are in world space
  const mainParts = [];

  const pts = Array.from({ length: COUNT }, () => ({
    p: new THREE.Vector3(),
    prev: new THREE.Vector3(),
  }));

  const segGeo = new THREE.CylinderGeometry(R, R, 1, 14, 1, true);
  const jointGeo = new THREE.SphereGeometry(R, 14, 10);
  const segments = [];
  const joints = [];
  for (let i = 0; i < COUNT; i++) {
    const j = new THREE.Mesh(jointGeo, main);
    j.castShadow = true;
    group.add(j);
    joints.push(j);
    mainParts.push(j);
    if (i < COUNT - 1) {
      const s = new THREE.Mesh(segGeo, main);
      s.castShadow = true;
      group.add(s);
      segments.push(s);
      mainParts.push(s);
    }
  }

  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let grabbed = -1;

  function layout() {
    for (let i = 0; i < COUNT; i++) joints[i].position.copy(pts[i].p);
    for (let i = 0; i < COUNT - 1; i++) {
      const a = pts[i].p;
      const b = pts[i + 1].p;
      const s = segments[i];
      s.position.addVectors(a, b).multiplyScalar(0.5);
      tmp.subVectors(b, a);
      const len = tmp.length();
      s.scale.set(1, Math.max(len, 0.001), 1);
      s.quaternion.setFromUnitVectors(up, tmp.divideScalar(len || 1));
    }
  }

  function satisfy(i, j, rest, stiffness) {
    const a = pts[i].p;
    const b = pts[j].p;
    tmp.subVectors(b, a);
    const d = tmp.length() || 1e-6;
    const diff = ((d - rest) / d) * 0.5 * stiffness;
    const wa = i === grabbed ? 0 : 1;
    const wb = j === grabbed ? 0 : 1;
    const sum = wa + wb || 1;
    a.addScaledVector(tmp, (diff * 2 * wa) / sum);
    b.addScaledVector(tmp, (-diff * 2 * wb) / sum);
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0, b: 0, r: R },
    mass: 0.6,
    noCollide: true, // it handles the orb itself, point by point
    keepRotation: true,
    preset: "matte",
    onSpawn(_ctx, prop) {
      const start = prop.group.position.clone();
      prop.group.position.set(0, 0, 0);
      const angle = Math.random() * Math.PI;
      for (let i = 0; i < COUNT; i++) {
        const off = (i - (COUNT - 1) / 2) * SEG;
        pts[i].p.set(start.x + Math.cos(angle) * off, start.y + Math.sin(i * 0.7) * 0.1, start.z + Math.sin(angle) * off);
        pts[i].prev.copy(pts[i].p);
      }
      layout();
    },
    dragPoint(pick) {
      return pick.point;
    },
    onGrab(_ctx, _prop, pick) {
      let best = 0;
      let bestD = Infinity;
      pts.forEach((pt, i) => {
        const d = pt.p.distanceToSquared(pick.point);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      grabbed = best;
    },
    onRelease() {
      grabbed = -1;
    },
    physics(dt, ctx, prop, drag) {
      const k = dt * 60;
      const g = ctx.gravity() * k * k;
      if (drag.prop !== prop) grabbed = -1;

      // integrate
      for (let i = 0; i < COUNT; i++) {
        const pt = pts[i];
        if (i === grabbed) {
          pt.prev.copy(pt.p);
          pt.p.lerp(drag.target, 1 - Math.exp(-dt * 25));
          continue;
        }
        tmp.subVectors(pt.p, pt.prev).multiplyScalar(0.99);
        pt.prev.copy(pt.p);
        pt.p.add(tmp);
        pt.p.y += g;
      }

      // collide with the orb (orb is heavy, noodle is light)
      const orb = ctx.orb;
      if (orb) {
        for (let i = 0; i < COUNT; i++) {
          const pt = pts[i];
          tmp.subVectors(pt.p, orb.position);
          const d = tmp.length();
          const min = orb.radius + R;
          if (d < min && d > 1e-5) {
            tmp.divideScalar(d);
            pt.p.addScaledVector(tmp, (min - d) * 0.9);
            orb.position.addScaledVector(tmp, -(min - d) * 0.1);
            // carry some of the orb's speed into the noodle
            pt.prev.addScaledVector(orb.velocity, -0.5 * k);
          }
        }
      }

      // constraints: segment lengths + a little bend stiffness
      for (let iter = 0; iter < 6; iter++) {
        for (let i = 0; i < COUNT - 1; i++) satisfy(i, i + 1, SEG, 1);
        for (let i = 0; i < COUNT - 2; i++) satisfy(i, i + 2, SEG * 1.85, 0.08);
        // floor + walls
        for (let i = 0; i < COUNT; i++) {
          const p = pts[i].p;
          if (p.y < R) {
            p.y = R;
            // floor friction
            const prev = pts[i].prev;
            prev.x += (p.x - prev.x) * 0.15;
            prev.z += (p.z - prev.z) * 0.15;
          }
          const b = ctx.bounds;
          p.x = THREE.MathUtils.clamp(p.x, b.minX + R, b.maxX - R);
          p.z = THREE.MathUtils.clamp(p.z, b.minZ + R, b.maxZ - R);
        }
      }
      layout();
    },
    onTap(_ctx) {
      for (const pt of pts) pt.prev.y -= 0.08; // flop
    },
    dispose() {
      segGeo.dispose();
      jointGeo.dispose();
    },
  };
}
