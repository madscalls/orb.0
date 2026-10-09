import * as THREE from "three";

// A little sitting cat, built from simple shapes. Origin = between its feet.
// Everything in `main` takes the custom color; eyes/nose stay fixed.
export function createKitty(mainMaterial) {
  const group = new THREE.Group();
  const main = [];

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.2 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xf28ca0, roughness: 0.5 });
  const whiskerMat = new THREE.LineBasicMaterial({ color: 0x555566 });

  const add = (geometry, material, x, y, z, isMain = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    if (isMain) main.push(mesh);
    return mesh;
  };

  // body + head
  const body = add(new THREE.SphereGeometry(0.28, 40, 32), mainMaterial, 0, 0.3, 0);
  body.scale.set(1, 1.15, 0.95);
  add(new THREE.SphereGeometry(0.22, 40, 32), mainMaterial, 0, 0.7, 0.05);

  // ears
  for (const side of [-1, 1]) {
    const ear = add(new THREE.ConeGeometry(0.085, 0.17, 4), mainMaterial, side * 0.12, 0.89, 0.04);
    ear.rotation.z = -side * 0.3;
    ear.rotation.y = Math.PI / 4;
  }

  // front paws
  for (const side of [-1, 1]) {
    const paw = add(new THREE.SphereGeometry(0.085, 24, 16), mainMaterial, side * 0.11, 0.06, 0.2);
    paw.scale.set(1, 0.7, 1.3);
  }

  // tail curling round to the side
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.12, -0.24),
    new THREE.Vector3(0.18, 0.06, -0.28),
    new THREE.Vector3(0.32, 0.08, -0.1),
    new THREE.Vector3(0.34, 0.22, 0.08),
  ]);
  add(new THREE.TubeGeometry(tailCurve, 24, 0.045, 10), mainMaterial, 0, 0, 0);

  // face
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(0.034, 16, 12), eyeMat, side * 0.085, 0.73, 0.25, false);
    // little highlight so the eyes still read on a black kitty
    add(new THREE.SphereGeometry(0.011, 8, 6), shineMat, side * 0.085 + 0.012, 0.745, 0.28, false);
  }
  add(new THREE.SphereGeometry(0.022, 12, 8), noseMat, 0, 0.665, 0.27, false);

  const whiskers = [];
  for (const side of [-1, 1]) {
    for (const dy of [-0.015, 0.015]) {
      whiskers.push(
        new THREE.Vector3(side * 0.06, 0.66, 0.26),
        new THREE.Vector3(side * 0.22, 0.66 + dy * 2.5, 0.22),
      );
    }
  }
  group.add(
    new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(whiskers), whiskerMat),
  );

  return {
    group,
    main,
    // collision capsule (bottom/top of the segment, radius) in local space
    capsule: { a: 0.3, b: 0.62, r: 0.3 },
    mass: Infinity, // the orb can't push it around (but you can drag it)
    preset: "matte",
    dispose() {
      eyeMat.dispose();
      shineMat.dispose();
      noseMat.dispose();
      whiskerMat.dispose();
    },
  };
}
