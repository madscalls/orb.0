import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createStarfield } from "./stars.js";

export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);

camera.position.set(0, 7, 7);
camera.lookAt(0, 0, 0);

export const renderer = new THREE.WebGLRenderer({ antialias: true });

// Sharp on retina screens, but capped so phones don't melt.
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// ---------- lights ----------

export const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.2);
scene.add(hemiLight);

export const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.radius = 6; // soft edges
scene.add(keyLight);

// Follows the orb and takes its color, so the glow lights its surroundings.
export const orbGlow = new THREE.PointLight(0x4158d0, 0.8, 4);
orbGlow.position.set(0, 1, 0);
scene.add(orbGlow);

// ---------- floor ----------

export const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.ShadowMaterial({ opacity: 0.18 }),
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Soft pool of light under the orb at night (replaces the hard shadow).
function radialTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const glowPool = new THREE.Mesh(
  new THREE.PlaneGeometry(3.2, 3.2),
  new THREE.MeshBasicMaterial({
    map: radialTexture(),
    color: 0x4158d0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
glowPool.rotation.x = -Math.PI / 2;
glowPool.position.y = 0.002;
scene.add(glowPool);

// ---------- night sky ----------

export const starfield = createStarfield();
scene.add(starfield.points);

// ---------- post-processing (bloom = the night glow) ----------

export const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

export const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
  0,
  0.3,
  1,
);
bloomPass.enabled = false;
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------- day / night ----------

const modes = {
  day: {
    background: new THREE.Color(0xffffff),
    lightColor: new THREE.Color(0xffffff),
    lightIntensity: 2,
    ambientIntensity: 0.35,
    hemiIntensity: 1.2,
  },
  night: {
    background: new THREE.Color(0x02020a),
    lightColor: new THREE.Color(0x334488),
    lightIntensity: 0.25,
    ambientIntensity: 0.06,
    hemiIntensity: 0.15,
  },
};

const currentBackground = new THREE.Color(0xffffff);
const clearColor = new THREE.Color(0xffffff);
const currentLightColor = new THREE.Color(0xffffff);

// 0 = full day, 1 = full night. Everything night-related eases off this.
export let nightFactor = 0;
let nightProgress = 0; // linear 0..1, eased into nightFactor
const TRANSITION_SECONDS = 1.6;

// Blend background colors in sRGB so the fade looks even (a linear-space
// blend lingers on grey and never reads as a true void).
const daySRGB = modes.day.background.clone().convertLinearToSRGB();
const nightSRGB = modes.night.background.clone().convertLinearToSRGB();

export function mountRenderer(selector) {
  document.querySelector(selector).appendChild(renderer.domElement);
}

export function updateLighting(isNight, dt, elapsed) {
  const step = dt / TRANSITION_SECONDS;
  nightProgress = THREE.MathUtils.clamp(
    nightProgress + (isNight ? step : -step),
    0,
    1,
  );
  nightFactor = THREE.MathUtils.smoothstep(nightProgress, 0, 1);

  const n = nightFactor;

  currentBackground.lerpColors(daySRGB, nightSRGB, n).convertSRGBToLinear();
  // The composer's render target gets the clear color sRGB-encoded and then
  // OutputPass encodes it again, which turned the void navy. Pre-linearize
  // once more so the final pixel is the color we asked for.
  clearColor.copy(currentBackground).convertSRGBToLinear();
  renderer.setClearColor(clearColor, 1);

  currentLightColor.lerpColors(modes.day.lightColor, modes.night.lightColor, n);
  keyLight.color.copy(currentLightColor);
  keyLight.intensity = THREE.MathUtils.lerp(
    modes.day.lightIntensity,
    modes.night.lightIntensity,
    n,
  );
  ambientLight.intensity = THREE.MathUtils.lerp(
    modes.day.ambientIntensity,
    modes.night.ambientIntensity,
    n,
  );
  hemiLight.intensity = THREE.MathUtils.lerp(
    modes.day.hemiIntensity,
    modes.night.hemiIntensity,
    n,
  );

  // The floor dissolves into the void.
  shadowPlane.material.opacity = 0.18 * (1 - n);

  starfield.update(elapsed, n);

  bloomPass.strength = 0.95 * n;
  // Keep the threshold high mid-transition so the grey background never blooms.
  bloomPass.threshold = 1 - 0.75 * n * n;
  bloomPass.enabled = n > 0.01;
}

export function render() {
  composer.render();
}

// Play area on the floor, sized to what's actually visible on screen.
export const bounds = { minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5 };
const MAX_BOUND = 4.5;
const boundsRay = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const boundsHit = new THREE.Vector3();

function floorPointAt(x, y) {
  boundsRay.setFromCamera(new THREE.Vector2(x, y), camera);
  return boundsRay.ray.intersectPlane(floorPlane, boundsHit);
}

function updateBounds() {
  camera.updateMatrixWorld();
  // Sides: measured a little below center, where the floor is narrowest.
  const side = floorPointAt(0.94, -0.55);
  if (side) {
    bounds.maxX = Math.min(MAX_BOUND, Math.abs(side.x));
    bounds.minX = -bounds.maxX;
  }
  const near = floorPointAt(0, -0.9);
  if (near) bounds.maxZ = Math.min(MAX_BOUND, near.z);
  const far = floorPointAt(0, 0.7); // stay below the nav bar
  bounds.minZ = far ? Math.max(-MAX_BOUND, far.z) : -MAX_BOUND;
}

export function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;

  // Back the camera off on narrow (portrait) screens so there's room to play.
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const wanted = 3.4 / (Math.tan(halfFov) * camera.aspect);
  const distance = THREE.MathUtils.clamp(wanted, 9.9, 20);
  camera.position.set(0, 1, 1).normalize().multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w / 2, h / 2);
  updateBounds();
}

handleResize();
