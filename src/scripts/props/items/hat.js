import * as THREE from "three";
import { materialBag, part, horizontalDistance } from "./util.js";

// H — top hat. Drops from above the orb and lands on its head.
// Drag it off to take it off again.
export function createHat(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const band = bag.std(0xd63a5a, { roughness: 0.6 });

  part(group, new THREE.CylinderGeometry(0.3, 0.3, 0.025, 36), main, 0, 0.012, 0, mainParts);
  part(group, new THREE.CylinderGeometry(0.17, 0.18, 0.32, 36), main, 0, 0.18, 0, mainParts);
  part(group, new THREE.CylinderGeometry(0.182, 0.182, 0.06, 36), band, 0, 0.06, 0);

  let attached = false;
  let wobble = 0;

  function attach(ctx, prop) {
    attached = true;
    prop.noCollide = true;
    ctx.status.hat = prop;
    ctx.toast("dapper.");
  }

  return {
    group,
    main: mainParts,
    capsule: { a: 0.05, b: 0.3, r: 0.25 },
    mass: 0.3,
    passThrough: true,
    preset: "matte",
    // Straight above the orb so it lands on it.
    spawnAt(ctx) {
      const o = ctx.orbPosition();
      return new THREE.Vector3(o.x, o.y + 3, o.z);
    },
    keepRotation: true,
    physics(dt, ctx, prop) {
      const orb = ctx.orb;
      if (attached && ctx.isDragged(prop)) {
        // pulled off
        attached = false;
        prop.noCollide = false;
        if (ctx.status.hat === prop) ctx.status.hat = null;
      }
      if (attached && orb) {
        // ride on top, staying upright (the orb rolls, the hat doesn't)
        const top = orb.position.y + orb.radius * 0.92;
        group.position.set(orb.position.x, top, orb.position.z);
        prop.velocity.copy(orb.velocity);
        wobble += (-orb.velocity.x * 1.5 - group.rotation.z) * 0.2;
        wobble *= 0.85;
        group.rotation.z += wobble * dt * 10;
        group.rotation.x = orb.velocity.z * 1.5;
        return;
      }
      group.rotation.z *= 0.9;
      group.rotation.x *= 0.9;
      ctx.defaultPhysics(prop);
    },
    onOrbOverlap(ctx, prop) {
      const orb = ctx.orb;
      if (attached || ctx.isDragged(prop)) return;
      // falling onto the top of the orb
      if (
        prop.velocity.y <= 0.02 &&
        group.position.y > orb.position.y + orb.radius * 0.4 &&
        horizontalDistance(group.position, orb.position) < orb.radius * 0.8
      ) {
        attach(ctx, prop);
      }
    },
    onTap(ctx, prop) {
      if (!attached) prop.velocity.y = 0.12;
    },
    dispose: bag.dispose,
  };
}
