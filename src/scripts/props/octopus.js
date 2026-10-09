import * as THREE from "three";

// A friendly octopus. Origin = where the tentacles touch the floor.
// The head and the eight tentacles take the custom color; the tentacles
// sway gently, and wave harder for a moment when it gets bumped.
export function createOctopus(mainMaterial) {
  const group = new THREE.Group();
  const main = [];

  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.2 });

  // head (mantle): a tall, slightly squashed sphere
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 32), mainMaterial);
  head.scale.set(1, 1.15, 0.95);
  head.position.y = 0.6;
  head.castShadow = true;
  group.add(head);
  main.push(head);

  // eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), eyeWhite);
    eye.position.set(side * 0.12, 0.55, 0.24);
    group.add(eye);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), pupil);
    p.position.set(side * 0.12, 0.55, 0.305);
    group.add(p);
  }

  // tentacles: each hangs from a pivot under the head so it can sway
  const tentacles = [];
  const COUNT = 8;
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2 + Math.PI / COUNT;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 0.15, 0.4, Math.sin(angle) * 0.15);
    pivot.rotation.y = -angle;
    group.add(pivot);

    // drawn along local +x: down to the floor, out, then curling up at the tip
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08, -0.25, 0),
      new THREE.Vector3(0.22, -0.37, 0),
      new THREE.Vector3(0.36, -0.36, 0),
      new THREE.Vector3(0.42, -0.26, 0),
      new THREE.Vector3(0.37, -0.2, 0),
    ]);
    const geometry = new THREE.TubeGeometry(curve, 32, 0.05, 10);
    // taper toward the tip
    const pos = geometry.attributes.position;
    const tangentsPerSegment = 11;
    for (let v = 0; v < pos.count; v++) {
      const seg = Math.floor(v / tangentsPerSegment) / 32;
      const center = curve.getPointAt(Math.min(1, seg));
      const taper = 1 - seg * 0.75;
      pos.setXYZ(
        v,
        center.x + (pos.getX(v) - center.x) * taper,
        center.y + (pos.getY(v) - center.y) * taper,
        center.z + (pos.getZ(v) - center.z) * taper,
      );
    }
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, mainMaterial);
    mesh.castShadow = true;
    pivot.add(mesh);
    main.push(mesh);
    tentacles.push({ pivot, phase: i * 0.8 });
  }

  let excitement = 0;
  let time = 0;

  return {
    group,
    main,
    capsule: { a: 0.3, b: 0.62, r: 0.33 },
    mass: 1.2,
    preset: "glossy",
    nudge(_dir, strength) {
      excitement = Math.min(1, excitement + strength * 4);
    },
    tick(dt) {
      time += dt;
      excitement *= Math.exp(-dt * 1.5);
      const amount = 0.08 + excitement * 0.35;
      const speed = 1.6 + excitement * 5;
      for (const t of tentacles) {
        t.pivot.rotation.z = Math.sin(time * speed + t.phase) * amount;
      }
      head.scale.y = 1.15 + Math.sin(time * 1.8) * 0.02 + excitement * 0.05;
    },
    dispose() {
      eyeWhite.dispose();
      pupil.dispose();
    },
  };
}
