import * as THREE from "three";

// Finishes the "material" (gears) button cycles through.
export const PRESETS = {
  glossy: {
    label: "glossy",
    roughness: 0.25,
    metalness: 0.15,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    transmission: 0,
  },
  matte: {
    label: "matte",
    roughness: 0.85,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0,
    transmission: 0,
  },
  metal: {
    label: "metal",
    roughness: 0.22,
    metalness: 0.9,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
    transmission: 0,
  },
  jelly: {
    label: "jelly",
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transmission: 0.5,
    thickness: 0.9,
    ior: 1.33,
  },
};

export const PRESET_ORDER = ["glossy", "matte", "metal", "jelly"];

// Simple environment so metal / clearcoat have something to reflect.
let envTexture = null;
export function setupEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xdde0ee);
  const panel = (color, x, y, z, s) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(0xffffff, 0, 6, 0, 8);
  panel(0xffffff, 6, 3, 4, 4);
  panel(0x8890b0, -6, 1, -3, 6);
  panel(0x404050, 0, -6, 0, 10);
  envTexture = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
}

export function createGradientTexture(stops) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  stops.forEach((s) => gradient.addColorStop(s.stop, `#${s.color}`));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  // Without this the gradient renders washed out.
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Average color of a gradient, used to tint the glow light.
export function gradientAverage(stops, out = new THREE.Color()) {
  const tmp = new THREE.Color();
  out.setRGB(0, 0, 0);
  stops.forEach((s) => {
    tmp.set(`#${s.color}`);
    out.r += tmp.r / stops.length;
    out.g += tmp.g / stops.length;
    out.b += tmp.b / stops.length;
  });
  return out;
}

/**
 * Build a fresh material for the orb.
 * appearance: { color: "#rrggbb" } or { gradient: [{stop, color}] }
 */
export function buildOrbMaterial(appearance, presetKey, gradientTexture) {
  const preset = PRESETS[presetKey] ?? PRESETS.glossy;

  const material = new THREE.MeshPhysicalMaterial({
    roughness: preset.roughness,
    metalness: preset.metalness,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: preset.clearcoatRoughness,
    transmission: preset.transmission,
    thickness: preset.thickness ?? 0,
    ior: preset.ior ?? 1.5,
    emissiveIntensity: 0.05,
  });

  if (appearance.gradient && gradientTexture) {
    material.color.set(0xffffff);
    material.map = gradientTexture;
    material.emissive.set(0xffffff);
    material.emissiveMap = gradientTexture;
  } else {
    material.color.set(appearance.color);
    material.emissive.set(appearance.color);
  }

  return material;
}

export function disposeMaterial(material) {
  if (!material) return;
  // Textures are owned by the controller (shared between meshes), not disposed here.
  material.dispose();
}
