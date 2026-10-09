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
  // Warm glow on the inside of the shade, so it looks lit from within.
  const innerGlow = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.35,
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
  add(new THREE.CylinderGeometry(0.022, 0.022, 1.06, 12), metal, 0.59, false);
  // Shade: open at the bottom, closed at the top, bulb tucked up inside it.
  const shade = add(new THREE.CylinderGeometry(0.14, 0.3, 0.34, 40, 1, true), mainMaterial, 1.15, true);
  shade.castShadow = false; // let the light out
  const cap = add(new THREE.CircleGeometry(0.14, 40), mainMaterial, 1.32, true);
  cap.rotation.x = -Math.PI / 2;
  cap.castShadow = false;
  // Light shining *through* the fabric: a warm shell just outside the shade
  // that fades in at night (on top of whatever color the shade is).
  const throughGlow = new THREE.MeshBasicMaterial({
    color: 0xffc77a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shell = add(new THREE.CylinderGeometry(0.145, 0.305, 0.345, 40, 1, true), throughGlow, 1.15, false);
  shell.castShadow = false;
  const shellCap = add(new THREE.CircleGeometry(0.145, 40), throughGlow, 1.322, false);
  shellCap.rotation.x = -Math.PI / 2;
  shellCap.castShadow = false;
  const inner = add(new THREE.CylinderGeometry(0.135, 0.29, 0.33, 40, 1, true), innerGlow, 1.15, false);
  inner.castShadow = false;
  // socket on top of the pole, bulb standing up inside the shade
  add(new THREE.CylinderGeometry(0.032, 0.026, 0.07, 12), metal, 1.14, false).castShadow = false;
  const bulb = add(new THREE.SphereGeometry(0.062, 20, 16), bulbMat, 1.22, false);
  bulb.castShadow = false;

  if (light) {
    // At the bulb; the open bottom of the shade lets it spill down and out.
    light.position.set(0, 1.24, 0);
    pivot.add(light);
  }

  // wobble spring
  const tilt = new THREE.Vector2();
  const tiltVel = new THREE.Vector2();

  return {
    group,
    main,
    capsule: { a: 0.25, b: 1.1, r: 0.28 },
    mass: 2,
    preset: "matte",
    light,
    // Swing a little when bumped; springs back upright.
    nudge(dir, strength) {
      tiltVel.x += dir.z * strength * 2.2;
      tiltVel.y += -dir.x * strength * 2.2;
    },
    tick(dt, ctx) {
      const nightFactor = ctx.nightFactor;
      const k = 60 * dt;
      tiltVel.x += (-tilt.x * 0.06 - tiltVel.x * 0.12) * k;
      tiltVel.y += (-tilt.y * 0.06 - tiltVel.y * 0.12) * k;
      tilt.x += tiltVel.x * k;
      tilt.y += tiltVel.y * k;
      tilt.clampScalar(-0.35, 0.35);
      pivot.rotation.x = tilt.x;
      pivot.rotation.z = tilt.y;

      bulbMat.emissiveIntensity = 0.8 + nightFactor * 2.4;
      innerGlow.opacity = 0.25 + nightFactor * 0.55;
      throughGlow.opacity = 0.05 + nightFactor * 0.5;
      if (light) light.intensity = 0.4 + nightFactor * 2.2;
    },
    dispose() {
      metal.dispose();
      bulbMat.dispose();
      innerGlow.dispose();
      throughGlow.dispose();
      // The light itself goes back to the pool (see propsController).
    },
  };
}
