import * as THREE from "three";

// A sphere of soft, twinkling points that fades in at night.
export function createStarfield(count = 2200) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const tints = new Float32Array(count * 3);

  const tint = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Uniform point on a sphere shell, radius 40–90.
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 50;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);

    // Mostly tiny stars, a few bright ones.
    sizes[i] = Math.random() < 0.06 ? 2.4 + Math.random() * 1.6 : 0.8 + Math.random() * 1.2;
    phases[i] = Math.random() * Math.PI * 2;

    // Subtle blue/white/warm variation.
    tint.setHSL(0.55 + (Math.random() - 0.5) * 0.25, 0.4, 0.85 + Math.random() * 0.15);
    tints[i * 3] = tint.r;
    tints[i * 3 + 1] = tint.g;
    tints[i * 3 + 2] = tint.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      varying vec3 vTint;
      void main() {
        vTint = aTint;
        vTwinkle = 0.55 + 0.45 * sin(uTime * (0.8 + fract(aPhase) * 1.6) + aPhase * 7.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * 2.2;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTwinkle;
      varying vec3 vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vTint * 1.1, a * a * vTwinkle * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;

  return {
    points,
    update(elapsed, nightFactor) {
      material.uniforms.uTime.value = elapsed;
      // Stars arrive a beat after the sky darkens.
      material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(nightFactor, 0.35, 1);
      points.visible = nightFactor > 0.35;
      // Very slow drift so the void feels alive.
      points.rotation.y = elapsed * 0.006;
    },
  };
}
