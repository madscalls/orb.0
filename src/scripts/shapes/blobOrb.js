import * as THREE from "three";

/*
 * Gelatinous blob.
 * A sphere whose vertices are squashed / stretched in the shader by a
 * damped spring, so it splats on impact, wobbles back, and stretches
 * when you fling it. The squash keeps its volume (wide when flat, thin
 * when stretched), which is what sells the "jelly" feel.
 */

const RADIUS = 0.5;
const STIFFNESS = 170; // higher = snappier jiggle
const DAMPING = 6.5; // lower = wobbles for longer
const MAX_SQUASH = 0.42;

export function createBlobOrb() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 64));

  const uniforms = {
    uAxis: { value: new THREE.Vector3(0, 1, 0) }, // squash axis (object space)
    uScaleA: { value: 1 }, // scale along the axis
    uScaleP: { value: 1 }, // scale perpendicular to it
    uWobble: { value: 0 },
    uTime: { value: 0 },
  };

  const glslHeader = /* glsl */ `
    uniform vec3 uAxis;
    uniform float uScaleA;
    uniform float uScaleP;
    uniform float uWobble;
    uniform float uTime;
    float blobWobble(vec3 p) {
      return (sin(p.x * 9.0 + uTime * 5.1) +
              sin(p.y * 7.0 + uTime * 6.3) +
              sin(p.z * 8.0 + uTime * 4.4)) / 3.0;
    }
  `;

  const glslNormal = /* glsl */ `
    vec3 objectNormal = vec3( normal );
    {
      float na = dot(objectNormal, uAxis);
      objectNormal = normalize(uAxis * na / uScaleA + (objectNormal - uAxis * na) / uScaleP);
    }
    #ifdef USE_TANGENT
      vec3 objectTangent = vec3( tangent.xyz );
    #endif
  `;

  const glslVertex = /* glsl */ `
    float pa = dot(position, uAxis);
    vec3 transformed = uAxis * pa * uScaleA + (position - uAxis * pa) * uScaleP;
    transformed += normal * blobWobble(position) * uWobble * 0.12;
    #ifdef USE_ALPHAHASH
      vPosition = vec3( position );
    #endif
  `;

  function patch(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${glslHeader}`)
        .replace("#include <beginnormal_vertex>", glslNormal)
        .replace("#include <begin_vertex>", glslVertex);
    };
    material.customProgramCacheKey = () => "orb-blob";
  }

  // Shadow follows the squash too.
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });
  patch(depthMaterial);
  mesh.customDepthMaterial = depthMaterial;

  // ---- jiggle state ----
  const worldAxis = new THREE.Vector3(0, 1, 0);
  const tmpAxis = new THREE.Vector3();
  const invQuat = new THREE.Quaternion();
  let squash = 0; // >0 flattened, <0 stretched
  let squashVel = 0;
  let wobbleEnergy = 0;

  function scales() {
    const s = THREE.MathUtils.clamp(squash, -MAX_SQUASH, MAX_SQUASH);
    const a = 1 - s;
    return { a, p: 1 / Math.sqrt(a) }; // volume preserving
  }

  mesh.userData = {
    shape: "blob",
    radius: RADIUS,
    defaultPreset: "jelly",
    rollFactor: 0.6,
    patchMaterial: patch,

    onImpact(normal, speed) {
      // Lean the squash axis toward the surface we hit.
      worldAxis.lerp(normal, 0.85).normalize();
      squashVel += Math.min(speed * 55, 9);
      wobbleEnergy = Math.min(1, wobbleEnergy + speed * 6);
    },

    tick(dt, elapsed, velocity, grabbed) {
      let target = 0;
      const speed = velocity.length();
      if (grabbed && speed > 0.002) {
        // Stretch along the direction it's being dragged.
        tmpAxis.copy(velocity).normalize();
        worldAxis.lerp(tmpAxis, 0.25).normalize();
        target = -Math.min(speed * 3, 0.3);
      } else if (!grabbed && speed > 0.05) {
        // Slight stretch while flying.
        tmpAxis.copy(velocity).normalize();
        worldAxis.lerp(tmpAxis, 0.08).normalize();
        target = -Math.min(speed * 1.2, 0.18);
      }

      // Damped spring toward the target shape.
      const accel = -STIFFNESS * (squash - target) - DAMPING * squashVel;
      squashVel += accel * dt;
      squash += squashVel * dt;

      wobbleEnergy *= Math.exp(-dt * 1.8);
      const idle = 0.05; // gentle "breathing" even at rest
      uniforms.uWobble.value = idle + wobbleEnergy;
      uniforms.uTime.value = elapsed;

      const { a, p } = scales();
      uniforms.uScaleA.value = a;
      uniforms.uScaleP.value = p;

      // The mesh rolls, so convert the world axis into its local space.
      invQuat.copy(mesh.quaternion).invert();
      uniforms.uAxis.value.copy(worldAxis).applyQuaternion(invQuat).normalize();
    },

    // Half-size along a world axis (0 = x, 1 = y, 2 = z) — an ellipsoid.
    halfExtent(axisIndex) {
      const { a, p } = scales();
      const d = worldAxis.getComponent(axisIndex);
      return RADIUS * Math.sqrt(a * a * d * d + p * p * (1 - d * d));
    },
  };

  return mesh;
}
