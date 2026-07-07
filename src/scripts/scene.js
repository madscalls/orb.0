import * as THREE from "three";

export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

camera.position.set(0, 7, 7);
camera.lookAt(0, 0, 0);

export const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});

renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.2);
scene.add(hemiLight);

export const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;

keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;

scene.add(keyLight);

export const orbGlow = new THREE.PointLight(0x4158d0, 2, 6);
orbGlow.position.set(0, 1, 0);
scene.add(orbGlow);

export const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.ShadowMaterial({ opacity: 0.18 }),
);

shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

export const modes = {
  day: {
    background: new THREE.Color(0xffffff),
    lightColor: new THREE.Color(0xffffff),
    lightIntensity: 2,
    ambientIntensity: 0.35,
    hemiIntensity: 1.2,
  },
  night: {
    background: new THREE.Color(0x050510),
    lightColor: new THREE.Color(0x334488),
    lightIntensity: 0.4,
    ambientIntensity: 0.15,
    hemiIntensity: 0.45,
  },
};

export const currentBackground = new THREE.Color(0xffffff);
export const currentLightColor = new THREE.Color(0xffffff);

export function mountRenderer(selector) {
  const container = document.querySelector(selector);
  container.appendChild(renderer.domElement);
}

export function updateLighting(isNight) {
  const target = isNight ? modes.night : modes.day;
  const speed = 0.03;

  currentBackground.lerp(target.background, speed);
  renderer.setClearColor(currentBackground, 1);

  currentLightColor.lerp(target.lightColor, speed);
  keyLight.color.set(currentLightColor);

  keyLight.intensity += (target.lightIntensity - keyLight.intensity) * speed;
  ambientLight.intensity +=
    (target.ambientIntensity - ambientLight.intensity) * speed;
  hemiLight.intensity += (target.hemiIntensity - hemiLight.intensity) * speed;
}

export function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
