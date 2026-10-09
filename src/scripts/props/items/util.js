import * as THREE from "three";

// Small helpers shared by the item models.

/** Collects fixed-color materials so the item can dispose them later. */
export function materialBag() {
  const list = [];
  const keep = (m) => {
    list.push(m);
    return m;
  };
  return {
    std: (color, opts = {}) =>
      keep(new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...opts })),
    basic: (color, opts = {}) => keep(new THREE.MeshBasicMaterial({ color, ...opts })),
    keep,
    dispose: () => list.forEach((m) => m.dispose()),
  };
}

/** Make a mesh, place it, add it to `parent`, optionally record it in `list`. */
export function part(parent, geometry, material, x = 0, y = 0, z = 0, list = null, shadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  parent.add(mesh);
  if (list) list.push(mesh);
  return mesh;
}

/** A sprite showing some text (used for the "z"s). */
export function textSprite(text, color = "#ffffff", size = 0.35) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  c.font = "bold 96px 'Lacquer', system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 10;
  c.strokeStyle = "rgba(40, 40, 70, 0.55)";
  c.strokeText(text, 64, 70);
  c.fillStyle = color;
  c.fillText(text, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.setScalar(size);
  sprite.userData.dispose = () => {
    texture.dispose();
    sprite.material.dispose();
  };
  return sprite;
}

/** Random direction on the floor plane. */
export function randomFlat(out = new THREE.Vector3()) {
  const a = Math.random() * Math.PI * 2;
  return out.set(Math.cos(a), 0, Math.sin(a));
}

export const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Make every material on the main parts see-through (ghost, jellyfish…). */
export function makeTranslucent(prop, opacity) {
  prop.material.transparent = true;
  prop.material.opacity = opacity;
  prop.material.depthWrite = false;
  prop.material.side = THREE.DoubleSide;
}
