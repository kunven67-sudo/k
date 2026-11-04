// THE MASK - cartoon look: every surface uses a 4-step toon ramp so light falls off in soft bands.
import * as THREE from 'three';

let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const data = new Uint8Array([90, 150, 205, 255]);
  ramp = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

export const PAL = {
  cream: 0xf1e7d0, teal: 0x2c8c87, tealDark: 0x1d5f5c, brass: 0xd09a3e, brassDark: 0x8a5f22,
  mustard: 0xe2a63b, mustardDark: 0xb07a22, ink: 0x2a1d1a, plum: 0x3b2638, plum2: 0x45303f,
  wood: 0x5a3424, woodDark: 0x3c2219, woodLight: 0x7a4a2f, ceiling: 0x221719, night: 0x15233f,
  moon: 0xcfe0ff, glass: 0x8fb6e8
};

export function toon(opts = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap: toonRamp(), ...opts });
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  return m;
}

// swap whatever a model came with for toon materials (keeps its color atlas)
export function toonify(root, { shadows = true } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (mm) => toon({
      color: mm.color ? mm.color.clone() : new THREE.Color(1, 1, 1),
      map: mm.map || null, transparent: mm.transparent, opacity: mm.opacity, side: mm.side,
      emissive: mm.emissive ? mm.emissive.clone() : new THREE.Color(0, 0, 0), emissiveMap: mm.emissiveMap || null
    });
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = shadows; o.receiveShadow = true;
  });
  return root;
}

// soft glow sprite (lamp halos, candle flames): additive, cheap in VR
let glowTex = null;
export function glowSprite(color, size, strength = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: strength, fog: false
  }));
  s.scale.setScalar(size); s.renderOrder = 5;
  return s;
}

// copies of you: same toon look plus a colored rim + slight see-through. One shader for every copy (the color is a
// uniform), so a new copy never makes the game hitch while a shader compiles.
export function ghostify(root, color) {
  const rim = { value: new THREE.Color(color) };
  const fade = { value: 1 };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (mm) => {
      const m = mm.clone();
      m.transparent = true; m.opacity = 0.93; m.depthWrite = true;
      m.color = (m.color ? m.color.clone() : new THREE.Color(1, 1, 1)).lerp(rim.value, 0.5);
      if (!(m.isMeshToonMaterial || m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial)) return m; // glows: just tinted
      m.emissive = rim.value.clone().multiplyScalar(0.12);
      m.onBeforeCompile = (sh) => {
        sh.uniforms.rimColor = rim; sh.uniforms.ghostFade = fade;
        sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float ghostFade;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
          `#include <dithering_fragment>
           float rimF = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
           gl_FragColor.rgb += rimColor * smoothstep(0.45, 0.95, rimF) * 0.9;
           gl_FragColor.a *= ghostFade;`);
      };
      m.customProgramCacheKey = () => 'ghost';
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  root.userData.ghost = { rim, fade };
  return root;
}
