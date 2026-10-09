import * as THREE from "three";

// A yoyo hanging from a finger ring. The ring (anchor) stays where you put it;
// the yoyo swings on its string, and tapping it does a yo-yo throw.
export function createYoyo(mainMaterial) {
  const group = new THREE.Group(); // the yoyo body; position = its center
  const main = [];

  const halves = new THREE.Group();
  group.add(halves);
  for (const side of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.07, 40), mainMaterial);
    half.rotation.x = Math.PI / 2; // faces the camera
    half.position.z = side * 0.05;
    half.castShadow = true;
    halves.add(half);
    main.push(half);
  }
  const axleMat = new THREE.MeshStandardMaterial({ color: 0xdddde6, metalness: 0.6, roughness: 0.3 });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), axleMat);
  axle.rotation.x = Math.PI / 2;
  halves.add(axle);

  // finger ring
  const anchor = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.022, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xf4f4fa, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.15 }),
  );
  anchor.castShadow = true;

  // the string
  const stringGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const string = new THREE.Line(
    stringGeometry,
    new THREE.LineBasicMaterial({ color: 0xe8e2d0 }),
  );
  string.frustumCulled = false;

  // String length animation for the yo-yo throw.
  const REST = 1.5;
  let length = REST;
  let throwTime = -1;
  const THROW_KEYS = [
    [0, REST],
    [0.35, 2.5],
    [0.95, 0.3],
    [1.5, REST],
  ];

  function throwLength(t) {
    for (let i = 0; i < THROW_KEYS.length - 1; i++) {
      const [t0, l0] = THROW_KEYS[i];
      const [t1, l1] = THROW_KEYS[i + 1];
      if (t <= t1) {
        const u = THREE.MathUtils.smoothstep((t - t0) / (t1 - t0), 0, 1);
        return l0 + (l1 - l0) * u;
      }
    }
    return REST;
  }

  return {
    group,
    main,
    anchor,
    string,
    capsule: { a: 0, b: 0, r: 0.2, centered: true },
    mass: 0.6,
    preset: "glossy",
    get length() {
      return length;
    },
    yo() {
      if (throwTime < 0) throwTime = 0;
    },
    // returns how fast the string length changed (for spin)
    tick(dt) {
      let dL = 0;
      if (throwTime >= 0) {
        throwTime += dt;
        const next = throwLength(throwTime);
        dL = next - length;
        length = next;
        if (throwTime > THROW_KEYS[THROW_KEYS.length - 1][0]) throwTime = -1;
      }
      // Unwinding spins one way, winding back the other.
      halves.rotation.z -= dL / 0.035;
      // A little idle spin that slows down.
      const pts = stringGeometry.attributes.position;
      pts.setXYZ(0, anchor.position.x, anchor.position.y, anchor.position.z);
      pts.setXYZ(1, group.position.x, group.position.y, group.position.z);
      pts.needsUpdate = true;
      return dL;
    },
    dispose() {
      axleMat.dispose();
      anchor.geometry.dispose();
      anchor.material.dispose();
      stringGeometry.dispose();
      string.material.dispose();
    },
  };
}
