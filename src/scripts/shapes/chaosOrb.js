import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
let cachedGeometry = null;

// BASE_URL is "/orb.0/" on GitHub Pages and "/" locally — a hard-coded
// "/models/..." path 404s on the live site.
const MODEL_URL = `${import.meta.env.BASE_URL}models/bumpyOrb.glb`;

async function loadGeometry() {
  if (cachedGeometry) return cachedGeometry;

  const gltf = await loader.loadAsync(MODEL_URL);
  gltf.scene.updateMatrixWorld(true);
  let source = null;
  gltf.scene.traverse((child) => {
    if (!source && child.isMesh) source = child;
  });

  const geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);

  // Center it and scale it to the same size as the other shapes.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingSphere();
  const scale = 0.52 / geometry.boundingSphere.radius;
  geometry.scale(scale, scale, scale);

  // Give it UVs (top-to-bottom) so gradients wrap it like the sphere.
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    uv[i * 2] = 0.5 + Math.atan2(z, x) / (Math.PI * 2);
    uv[i * 2 + 1] = (y - min.y) / (max.y - min.y);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  cachedGeometry = geometry;
  return geometry;
}

export async function createChaosOrb() {
  const geometry = await loadGeometry();
  const mesh = new THREE.Mesh(geometry);

  mesh.userData = {
    shape: "chaotic",
    radius: 0.5,
    defaultPreset: "matte",
    rollFactor: 0.8,
  };

  return mesh;
}
