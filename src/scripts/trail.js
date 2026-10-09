import * as THREE from "three";

// Sparkle trail behind the orb (the "sparkle" button). Glows at night via bloom.
export function createTrail(scene, max = 160) {
  const positions = new Float32Array(max * 3);
  const life = new Float32Array(max); // 1 → 0
  const seeds = new Float32Array(max);
  const drift = new Float32Array(max * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aLife", new THREE.BufferAttribute(life, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x4158d0) },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aLife;
      attribute float aSeed;
      uniform float uPixelRatio;
      varying float vLife;
      void main() {
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (6.0 + aSeed * 10.0) * aLife * uPixelRatio * (8.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uNight;
      varying float vLife;
      void main() {
        if (vLife <= 0.0) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        // four-point sparkle: soft core + thin cross
        float core = smoothstep(0.5, 0.0, d);
        float cross = max(smoothstep(0.06, 0.0, abs(c.x)), smoothstep(0.06, 0.0, abs(c.y))) * smoothstep(0.5, 0.1, d);
        float a = max(core * core, cross) * vLife;
        vec3 col = mix(uColor, vec3(1.0), 0.45) * (1.0 + uNight * 1.5);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    // Additive vanishes on a white background, so blend normally by day.
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let enabled = false;
  let carry = 0;
  const last = new THREE.Vector3();
  let hasLast = false;

  function emit(p) {
    const i = cursor;
    cursor = (cursor + 1) % max;
    positions[i * 3] = p.x + (Math.random() - 0.5) * 0.25;
    positions[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.25;
    positions[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.25;
    drift[i * 3] = (Math.random() - 0.5) * 0.3;
    drift[i * 3 + 1] = Math.random() * 0.35;
    drift[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    life[i] = 1;
    seeds[i] = Math.random();
  }

  return {
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      hasLast = false;
      return enabled;
    },
    update(dt, orbPosition, color, nightFactor) {
      material.uniforms.uColor.value.copy(color);
      material.uniforms.uNight.value = nightFactor;
      material.blending =
        nightFactor > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;

      if (enabled) {
        // Emit by distance travelled, so a fast throw leaves a longer trail.
        if (hasLast) {
          carry += orbPosition.distanceTo(last) * 14;
          while (carry >= 1) {
            emit(orbPosition);
            carry -= 1;
          }
        }
        last.copy(orbPosition);
        hasLast = true;
      }

      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt * 1.4);
        positions[i * 3] += drift[i * 3] * dt;
        positions[i * 3 + 1] += drift[i * 3 + 1] * dt;
        positions[i * 3 + 2] += drift[i * 3 + 2] * dt;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aLife.needsUpdate = true;
      geometry.attributes.aSeed.needsUpdate = true;
    },
  };
}
