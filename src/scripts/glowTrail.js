import * as THREE from "three";

/*
 * Night-time comet tail.
 * Remembers where the orb has been over the last fraction of a second and
 * draws a soft, glowing streak through those points that shrinks and fades
 * with age. A light pool on the floor follows the same path, so the glow
 * smears along the ground instead of sitting under the orb as a static circle.
 */

const MAX_SAMPLES = 120;
const LIFETIME = 0.75; // seconds a point of the tail lasts
const SPACING = 0.035; // world units between samples

export function createGlowTrail(scene) {
  const positions = new Float32Array(MAX_SAMPLES * 3);
  const floorPositions = new Float32Array(MAX_SAMPLES * 3);
  const ages = new Float32Array(MAX_SAMPLES).fill(1); // 0 = new, 1 = gone
  const heights = new Float32Array(MAX_SAMPLES);
  const born = new Float32Array(MAX_SAMPLES);

  const makeMaterial = (floor) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() },
        uNight: { value: 0 },
        uSize: { value: 1 },
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aAge;
        attribute float aHeight;
        uniform float uSize;
        uniform float uScale;
        varying float vAge;
        varying float vHeight;
        void main() {
          vAge = aAge;
          vHeight = aHeight;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          // World-sized sprite that tapers toward the tail end.
          float taper = pow(1.0 - aAge, 0.6);
          gl_PointSize = uSize * taper * uScale * projectionMatrix[1][1] / -mv.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uNight;
        varying float vAge;
        varying float vHeight;
        void main() {
          if (vAge >= 1.0) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float soft = exp(-d * d * 4.0);
          float fade = pow(1.0 - vAge, 1.6);
          ${
            floor
              ? "float a = soft * fade * 0.12 / (1.0 + vHeight * 0.9);"
              : "float a = soft * fade * 0.2;"
          }
          // Mostly the orb's own color; samples overlap, so keep each one faint.
          gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.08) * a * uNight, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  function makePoints(array, floor) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(array, 3));
    geometry.setAttribute("aAge", new THREE.BufferAttribute(ages, 1));
    geometry.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
    const points = new THREE.Points(geometry, makeMaterial(floor));
    points.frustumCulled = false;
    points.renderOrder = floor ? -1 : 1;
    scene.add(points);
    return points;
  }

  const tail = makePoints(positions, false);
  const floorTail = makePoints(floorPositions, true);

  let cursor = 0;
  const last = new THREE.Vector3();
  let hasLast = false;

  function add(p, groundY, elapsed) {
    const i = cursor;
    cursor = (cursor + 1) % MAX_SAMPLES;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    floorPositions[i * 3] = p.x;
    floorPositions[i * 3 + 1] = 0.004;
    floorPositions[i * 3 + 2] = p.z;
    heights[i] = groundY;
    born[i] = elapsed;
    ages[i] = 0;
  }

  return {
    // Call after the orb has moved this frame.
    update(elapsed, orbPosition, height, radius, color, nightFactor, viewportHeight) {
      for (const pts of [tail, floorTail]) {
        const u = pts.material.uniforms;
        u.uColor.value.copy(color);
        u.uNight.value = nightFactor;
        u.uScale.value = viewportHeight / 2;
      }
      tail.material.uniforms.uSize.value = radius * 2.1;
      floorTail.material.uniforms.uSize.value = radius * 3.6;

      const visible = nightFactor > 0.01;
      tail.visible = floorTail.visible = visible;

      // Lay down samples along the path (several per frame on fast throws,
      // so the tail stays continuous instead of dotted).
      if (!hasLast) {
        last.copy(orbPosition);
        hasLast = true;
      }
      const dist = orbPosition.distanceTo(last);
      if (dist >= SPACING) {
        const steps = Math.min(Math.floor(dist / SPACING), 12);
        for (let s = 1; s <= steps; s++) {
          last.lerp(orbPosition, 1 / (steps - s + 1));
          add(last, height, elapsed);
        }
        last.copy(orbPosition);
      }

      for (let i = 0; i < MAX_SAMPLES; i++) {
        if (ages[i] < 1) ages[i] = Math.min(1, (elapsed - born[i]) / LIFETIME);
      }

      tail.geometry.attributes.position.needsUpdate = true;
      tail.geometry.attributes.aAge.needsUpdate = true;
      tail.geometry.attributes.aHeight.needsUpdate = true;
      floorTail.geometry.attributes.position.needsUpdate = true;
      floorTail.geometry.attributes.aAge.needsUpdate = true;
      floorTail.geometry.attributes.aHeight.needsUpdate = true;
    },

    // Shape switch / teleport: don't draw a streak across the screen.
    reset(orbPosition) {
      last.copy(orbPosition);
      ages.fill(1);
    },
  };
}
