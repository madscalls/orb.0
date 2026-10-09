import * as THREE from "three";
import { materialBag, part } from "./util.js";

// P — pizza slice. Leave it lying around and a pigeon swoops in and steals it.
const ANGLE = 0.75;

function makePigeon(bag) {
  const g = new THREE.Group();
  const grey = bag.std(0x8a8f9c, { roughness: 0.7 });
  const dark = bag.std(0x5b606d, { roughness: 0.7 });
  const neck = bag.std(0x4c8a76, { roughness: 0.3, metalness: 0.4 });
  const beak = bag.std(0x3a3a3a);
  const feet = bag.std(0xe58a9a);
  const eye = bag.std(0xff7a1a);

  const body = part(g, new THREE.SphereGeometry(0.17, 20, 14), grey, 0, 0.2, 0);
  body.scale.set(0.85, 0.8, 1.3);
  const n = part(g, new THREE.SphereGeometry(0.09, 16, 12), neck, 0, 0.3, 0.13);
  n.scale.set(1, 1.1, 1);
  part(g, new THREE.SphereGeometry(0.075, 16, 12), dark, 0, 0.38, 0.18);
  const b = part(g, new THREE.ConeGeometry(0.02, 0.07, 8), beak, 0, 0.37, 0.27);
  b.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    part(g, new THREE.SphereGeometry(0.014, 8, 6), eye, side * 0.05, 0.4, 0.23);
    const legs = part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), feet, side * 0.05, 0.05, 0);
    legs.userData.isLeg = true;
  }
  const tail = part(g, new THREE.BoxGeometry(0.14, 0.02, 0.16), dark, 0, 0.2, -0.24);
  tail.rotation.x = -0.3;
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.26, 0);
    g.add(pivot);
    const w = part(pivot, new THREE.BoxGeometry(0.32, 0.02, 0.2), dark, side * 0.16, 0, -0.02);
    w.castShadow = true;
    wings.push({ pivot, side });
  }
  g.userData.wings = wings;
  return g;
}

export function createPizza(main) {
  const group = new THREE.Group();
  const mainParts = [];
  const bag = materialBag();
  const crustMat = bag.std(0xd9a05b, { roughness: 0.8 });
  const pepperoni = bag.std(0xb3261e, { roughness: 0.6 });

  // wedge: point toward the back (-z), crust toward the camera
  const cheese = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24, 1, false, -ANGLE / 2, ANGLE);
  cheese.translate(0, 0.03, -0.28);
  part(group, cheese, main, 0, 0, 0, mainParts);
  const arc = [];
  for (let i = 0; i <= 12; i++) {
    const t = -ANGLE / 2 + (ANGLE * i) / 12;
    arc.push(new THREE.Vector3(0.42 * Math.sin(t), 0.05, 0.42 * Math.cos(t) - 0.28));
  }
  part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 24, 0.04, 8), crustMat);
  for (const [x, z] of [[0, -0.02], [-0.07, 0.08], [0.07, 0.08]]) {
    const p = part(group, new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), pepperoni, x, 0.056, z);
    p.receiveShadow = true;
  }

  // the thief
  const pigeon = makePigeon(bag);
  pigeon.visible = false;

  let state = "waiting"; // waiting → flyingIn → pecking → flyingOff
  let timer = 5 + Math.random() * 4;
  const from = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let flap = 0;

  function flapWings(dt, speed) {
    flap += dt * speed;
    for (const w of pigeon.userData.wings) {
      w.pivot.rotation.z = w.side * Math.sin(flap) * 0.9;
    }
  }

  return {
    group,
    main: mainParts,
    extras: [pigeon],
    capsule: { a: 0, b: 0.05, r: 0.3 },
    mass: 0.4,
    preset: "matte",
    physics(dt, ctx, prop) {
      if (state === "flyingOff") {
        // carried in the pigeon's beak
        group.position.set(pigeon.position.x, pigeon.position.y + 0.1, pigeon.position.z + 0.2);
        return;
      }
      ctx.defaultPhysics(prop);
    },
    tick(dt, ctx, prop) {
      const pos = group.position;
      if (state === "waiting") {
        if (prop.grounded && !ctx.isDragged(prop)) timer -= dt;
        if (timer <= 0) {
          state = "flyingIn";
          // come in from off-screen, high up
          const side = Math.random() < 0.5 ? -1 : 1;
          from.set(side * 9, 5, pos.z - 3);
          pigeon.position.copy(from);
          pigeon.visible = true;
          ctx.sfx.coo();
        }
      } else if (state === "flyingIn") {
        tmp.set(pos.x, 0, pos.z + 0.35);
        pigeon.position.lerp(tmp, 1 - Math.exp(-dt * 1.6));
        pigeon.lookAt(tmp.x, pigeon.position.y, tmp.z);
        flapWings(dt, 22);
        if (pigeon.position.distanceTo(tmp) < 0.12) {
          state = "pecking";
          timer = 1.6;
          pigeon.rotation.set(0, Math.PI, 0);
          ctx.sfx.coo();
        }
      } else if (state === "pecking") {
        timer -= dt;
        pigeon.position.set(pos.x, 0, pos.z + 0.35);
        pigeon.rotation.x = Math.max(0, Math.sin(timer * 14)) * 0.5;
        flapWings(dt, 0);
        if (ctx.isDragged(prop)) {
          // you snatched it back — the pigeon gives up for now
          state = "waiting";
          timer = 6;
          pigeon.visible = false;
          ctx.toast("shoo!");
        } else if (timer <= 0) {
          state = "flyingOff";
          prop.unpickable = true;
          prop.noCollide = true;
          ctx.toast("pigeon took your pizza");
        }
      } else if (state === "flyingOff") {
        pigeon.position.y += dt * 2.2;
        pigeon.position.x += dt * 1.5 * Math.sign(from.x);
        pigeon.position.z -= dt * 1.2;
        pigeon.rotation.x = -0.4;
        flapWings(dt, 24);
        if (pigeon.position.y > 6) ctx.remove(prop);
      }
    },
    onTap(ctx, prop) {
      prop.velocity.y = 0.1;
      ctx.toast("smells good");
    },
    dispose: bag.dispose,
  };
}
