import * as THREE from "three";

// Floor lamp with a real light in it. Origin = bottom of the base.
// The base and shade take the custom color.
export function createLamp(mainMaterial, light) {
  const group = new THREE.Group();
  // Everything hangs off a pivot at the base so the lamp can wobble.
  const pivot = new THREE.Group();
  group.add(pivot);
  const main = [];

  const metal = new THREE.MeshStandardMaterial({ color: 0x2d2d35, metalness: 0.8, roughness: 0.35 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff1d6,
    emissive: 0xffd9a0,
    emissiveIntensity: 1,
  });

  const add = (geometry, material, y, isMain) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    mesh.castShadow = true;
    pivot.add(mesh);
    if (isMain) main.push(mesh);
    return mesh;
  };

  add(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 40), mainMaterial, 0.03, true);
  add(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 12), metal, 0.56, false);
  const shade = add(new THREE.CylinderGeometry(0.13, 0.3, 0.32, 40, 1, true), mainMaterial, 1.14, true);
  shade.castShadow = false; // let the light out
  const bulb = add(new THREE.SphereGeometry(0.075, 20, 16), bulbMat, 1.07, false);
  bulb.castShadow = false;

  if (light) {
    light.position.set(0, 1.05, 0);
    pivot.add(light);
  }

  // wobble spring
  const tilt = new THREE.Vector2();
  const tiltVel = new THREE.Vector2();

  return {
    group,
    main,
    capsule: { a: 0.25, b: 1.05, r: 0.27 },
    mass: 2,
    preset: "matte",
    light,
    // Swing a little when bumped; springs back upright.
    nudge(dir, strength) {
      tiltVel.x += dir.z * strength * 2.2;
      tiltVel.y += -dir.x * strength * 2.2;
    },
    tick(dt, nightFactor) {
      const k = 60 * dt;
      tiltVel.x += (-tilt.x * 0.06 - tiltVel.x * 0.12) * k;
      tiltVel.y += (-tilt.y * 0.06 - tiltVel.y * 0.12) * k;
      tilt.x += tiltVel.x * k;
      tilt.y += tiltVel.y * k;
      tilt.clampScalar(-0.35, 0.35);
      pivot.rotation.x = tilt.x;
      pivot.rotation.z = tilt.y;

      bulbMat.emissiveIntensity = 0.8 + nightFactor * 2.4;
      if (light) light.intensity = 0.6 + nightFactor * 5.5;
    },
    dispose() {
      metal.dispose();
      bulbMat.dispose();
      // The light itself goes back to the pool (see propsController).
    },
  };
}
