import * as THREE from "three";

// A sphere of small, mostly steady stars that fades in at night.
// Kept dim on purpose: below the bloom threshold, so they stay crisp
// pinpoints instead of glowing blobs. Only a few shimmer, slowly and
// out of sync with each other.
export function createStarfield(count = 1800) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const shimmer = new Float32Array(count); // 0 = steady, >0 = how much it shimmers
  const speeds = new Float32Array(count);
  const brightness = new Float32Array(count);
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

    // Mostly tiny faint stars, a handful of slightly larger ones.
    const big = Math.random() < 0.04;
    sizes[i] = big ? 1.6 + Math.random() * 0.8 : 0.6 + Math.random() * 0.9;
    brightness[i] = big ? 0.85 + Math.random() * 0.15 : 0.25 + Math.random() * 0.6;
    phases[i] = Math.random() * Math.PI * 2;
    // ~1 in 8 stars shimmer, each at its own slow, random pace.
    shimmer[i] = Math.random() < 0.12 ? 0.15 + Math.random() * 0.25 : 0;
    speeds[i] = 0.15 + Math.random() * 0.5;

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
  geometry.setAttribute("aShimmer", new THREE.BufferAttribute(shimmer, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aBright", new THREE.BufferAttribute(brightness, 1));

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
      attribute float aShimmer;
      attribute float aSpeed;
      attribute float aBright;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      varying vec3 vTint;
      void main() {
        vTint = aTint;
        // Two slow sines at unrelated rates = an irregular, gentle shimmer.
        float wave = sin(uTime * aSpeed + aPhase) * sin(uTime * aSpeed * 0.37 + aPhase * 3.1);
        vTwinkle = aBright * (1.0 - aShimmer + aShimmer * (0.5 + 0.5 * wave));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * 2.0;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTwinkle;
      varying vec3 vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d);
        // Max ~0.3 brightness keeps them under the bloom threshold.
        gl_FragColor = vec4(vTint * 0.32, a * vTwinkle * uOpacity);
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
