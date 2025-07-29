// Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 7, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0xffffff); // white background
renderer.setSize(window.innerWidth, window.innerHeight);
const container = document.querySelector(".orb");
container.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

// Clean white ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// White walls with higher height
const wallMaterial = new THREE.MeshBasicMaterial({ visible: false });
const wallHeight = 4;
const wallThickness = 0.2;
const wallLength = 10;

function createWall(x, z, rotY = 0) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(wallLength, wallHeight, wallThickness),
    wallMaterial
  );
  wall.position.set(x, wallHeight / 2, z);
  wall.rotation.y = rotY;
  scene.add(wall);
}
createWall(0, -5); // back wall
createWall(0, 5); // front wall
createWall(-5, 0, Math.PI / 2); // left wall
createWall(5, 0, Math.PI / 2); // right wall

// Gradient texture canvas
const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext("2d");
const gradient = ctx.createLinearGradient(0, 0, 0, 256);
gradient.addColorStop(0, "rgb(0, 0, 255)");
gradient.addColorStop(1, "rgb(238, 130, 238)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 256);
const texture = new THREE.CanvasTexture(canvas);
texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

// Ball with gradient texture
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  new THREE.MeshStandardMaterial({ map: texture })
);
sphere.position.y = 1;
scene.add(sphere);

// Physics
let velocity = new THREE.Vector3();
const gravity = new THREE.Vector3(0, -0.02, 0);
const bounce = 0.7;
const friction = 0.98;
const wallBounce = 0.9;

// Drag + throw logic
let isDragging = false;
let dragStart = null;

window.addEventListener("mousedown", (e) => {
  isDragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  velocity.set(0, 0, 0);
});

window.addEventListener("mouseup", (e) => {
  if (isDragging && dragStart) {
    const dx = (e.clientX - dragStart.x) * 0.008; // less aggressive
    const dz = (e.clientY - dragStart.y) * 0.008;
    velocity.set(dx, 0.2, dz);
    isDragging = false;
  }
});

// Animate
function animate() {
  requestAnimationFrame(animate);

  velocity.add(gravity);
  sphere.position.add(velocity);

  const limit = 4.5;
  if (sphere.position.x > limit || sphere.position.x < -limit) {
    sphere.position.x = THREE.MathUtils.clamp(sphere.position.x, -limit, limit);
    velocity.x *= -wallBounce;
  }
  if (sphere.position.z > limit || sphere.position.z < -limit) {
    sphere.position.z = THREE.MathUtils.clamp(sphere.position.z, -limit, limit);
    velocity.z *= -wallBounce;
  }

  if (sphere.position.y <= 0.5) {
    sphere.position.y = 0.5;
    velocity.y *= -bounce;
    velocity.x *= friction;
    velocity.z *= friction;
    if (Math.abs(velocity.y) < 0.01) velocity.y = 0;
  }

  // Roll the gradient
  const rollAxis = new THREE.Vector3(velocity.z, 0, -velocity.x).normalize();
  const rollAngle = velocity.length() * 0.05;
  sphere.rotateOnAxis(rollAxis, rollAngle);

  renderer.render(scene, camera);
}
animate();

// Resize support
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
