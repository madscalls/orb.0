import * as THREE from "three";
import { materialBag, part } from "./util.js";

// X — jack-o'-lantern. Its carved face glows at night.
export function createPumpkin(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const stemMat = bag.std(0x4f6b2a, { roughness: 0.8 });
  const faceMat = bag.basic(0x2a1606);

  // ribbed body: push the sphere in along 8 grooves
  const geo = new THREE.SphereGeometry(0.32, 48, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const groove = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 0.6);
    v.x *= groove;
    v.z *= groove;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const body = part(group, geo, main, 0, 0.27, 0, mainParts);
  body.scale.set(1.1, 0.85, 1.1);

  const stem = part(group, new THREE.CylinderGeometry(0.03, 0.045, 0.14, 10), stemMat, 0, 0.58, 0);
  stem.rotation.z = 0.25;

  // carved face (flat shapes just in front of the surface)
  const tri = (size) => {
    const s = new THREE.Shape();
    s.moveTo(-size, -size * 0.7);
    s.lineTo(size, -size * 0.7);
    s.lineTo(0, size * 0.8);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  };
  const face = new THREE.Group();
  face.position.set(0, 0.3, 0.375);
  group.add(face);
  for (const side of [-1, 1]) {
    part(face, tri(0.055), faceMat, side * 0.11, 0.06, 0, null, false);
  }
  part(face, tri(0.03), faceMat, 0, -0.01, 0.005, null, false);
  const mouth = new THREE.Shape();
  mouth.moveTo(-0.17, 0);
  for (let i = 0; i <= 8; i++) {
    const x = -0.17 + (0.34 * i) / 8;
    const y = -0.08 * Math.sin((Math.PI * i) / 8) + (i % 2 ? 0.025 : 0);
    mouth.lineTo(x, y);
  }
  for (let i = 8; i >= 0; i--) {
    const x = -0.17 + (0.34 * i) / 8;
    mouth.lineTo(x, -0.12 * Math.sin((Math.PI * i) / 8) - 0.01 - (i % 2 ? 0 : 0.02));
  }
  part(face, new THREE.ShapeGeometry(mouth), faceMat, 0, -0.07, -0.01, null, false);
  face.rotation.x = -0.12;

  return {
    group,
    main: mainParts,
    capsule: { a: 0.25, b: 0.3, r: 0.34 },
    mass: 1.5,
    preset: "matte",
    keepRotation: true,
    tick(_dt, ctx) {
      // dark carved holes by day, a flickering candle glow by night
      const n = ctx.nightFactor;
      const flicker = 0.85 + Math.random() * 0.15;
      faceMat.color.setRGB(
        0.16 + n * 2.4 * flicker,
        0.09 + n * 1.3 * flicker,
        0.02 + n * 0.25,
      );
    },
    onTap(ctx, prop) {
      prop.velocity.y = 0.1;
      ctx.toast("happy halloween");
    },
    dispose: bag.dispose,
  };
}
