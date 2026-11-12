/**
 * Backdrop props of a scenery stretch (all procedural): a lake behind the trail, a waterfall cliff, giant tree roots,
 * glowing mushrooms, crystals, puddles after the rain, reeds. Built once when the level loads.
 */
import * as THREE from 'three';
import type { Level } from '../game/types';
import type { Variant } from './variants';
import { barkTexture, glowTexture } from './textures';
import { waterTime } from './world';

type Top = { x0: number; x1: number; y: number };

let fallsMat: THREE.ShaderMaterial | null = null;
/** falling water: bright streaks moving down, soft at the edges */
export function fallsMaterial() {
  fallsMat ??= new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT: waterTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      void main(){
        float s = sin(vUv.x * 60.0 + sin(vUv.x * 13.0) * 3.0) * 0.5 + 0.5;
        float f = fract(vUv.y * 3.0 + uT * 1.6 + s * 0.4);
        vec3 c = mix(vec3(0.55, 0.8, 0.95), vec3(0.95, 0.99, 1.0), smoothstep(0.55, 1.0, f) * 0.8 + s * 0.15);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(c, 0.82 * edge);
      }`,
  });
  fallsMat.userData.shared = true;
  return fallsMat;
}

export function sceneryProps(level: Level, v: Variant, x0: number, x1: number, tops: Top[], r: () => number): THREE.Group {
  const g = new THREE.Group();
  const from = Math.max(-20, x0),
    to = Math.min(level.goalX + 40, x1);
  if (to <= from) return g;
  const inRange = tops.filter((t) => t.x1 > from && t.x0 < to);

  if (v.lake) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(to - from + 20, 24),
      new THREE.MeshStandardMaterial({ color: '#6fbfe0', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set((from + to) / 2, -3.05, -16);
    g.add(water);
  }
  if (v.reeds || v.lake) {
    const reedM = new THREE.MeshStandardMaterial({ color: '#5f8f3f', roughness: 0.9 });
    const headM = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.9 });
    const reed = new THREE.CylinderGeometry(0.025, 0.04, 1.6, 4);
    const head = new THREE.CapsuleGeometry(0.06, 0.25, 2, 6);
    const n = Math.round((to - from) / 3);
    const im = new THREE.InstancedMesh(reed, reedM, n * 3);
    const ih = new THREE.InstancedMesh(head, headM, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = from + r() * (to - from);
      const z = -3.5 - r() * 3;
      for (let k = 0; k < 3; k++) {
        m.compose(new THREE.Vector3(x + k * 0.15, -2.5 + r() * 0.3, z + k * 0.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (r() - 0.5) * 0.3)), new THREE.Vector3(1, 1 + r() * 0.5, 1));
        im.setMatrixAt(i * 3 + k, m);
      }
      m.makeTranslation(x, -1.4, z);
      ih.setMatrixAt(i, m);
    }
    g.add(im, ih);
  }
  if (v.falls) {
    // a cliff far behind with two falling streams
    const rock = new THREE.MeshStandardMaterial({ color: '#8a9088', roughness: 1, flatShading: true });
    const moss = new THREE.MeshStandardMaterial({ color: '#6fa85a', roughness: 1, flatShading: true });
    for (let x = from; x < to; x += 24 + r() * 10) {
      // a craggy cliff of big boulders, mossy on top, with a stream falling down its face
      for (let k = 0; k < 7; k++) {
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + r() * 2, 0), rock);
        b.position.set(x + 2 + (k % 4) * 4.5 + r(), -2 + Math.floor(k / 4) * 7 + r() * 2, -26 - r() * 3);
        b.rotation.set(r() * 3, r() * 3, r() * 3);
        g.add(b);
      }
      const top = new THREE.Mesh(new THREE.DodecahedronGeometry(5, 0), moss);
      top.scale.set(2.2, 0.5, 1);
      top.position.set(x + 9, 12.5, -26);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 17), fallsMaterial());
      fall.position.set(x + 7 + r() * 4, 4, -21);
      const foam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
      foam.scale.set(6, 2.5, 1);
      foam.position.set(fall.position.x, -3, -20.5);
      g.add(top, fall, foam);
    }
  }
  if (v.roots) {
    const bark = new THREE.MeshStandardMaterial({ map: barkTexture('#6e4a2e'), roughness: 0.95 });
    for (let x = from; x < to; x += 9 + r() * 8) {
      const h = 3 + r() * 3,
        w = 4 + r() * 4,
        z = -3 - r() * 4;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, -3.4, z), new THREE.Vector3(x + w * 0.2, h, z + 0.4), new THREE.Vector3(x + w * 0.7, h * 0.8, z - 0.3), new THREE.Vector3(x + w, -3.4, z)]);
      const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.45 + r() * 0.3, 8), bark);
      root.castShadow = true;
      g.add(root);
    }
  }
  if (v.glowCaps) {
    const colors = ['#7ff0ff', '#ff8fe0', '#b8ff7a'];
    const stem = new THREE.MeshStandardMaterial({ color: '#e8f0e0', emissive: '#a0ffd0', emissiveIntensity: 0.3 });
    for (const t of inRange)
      for (let x = Math.max(t.x0, from) + 0.5; x < Math.min(t.x1, to) - 0.5; x += 2.5 + r() * 3) {
        const c = colors[Math.floor(r() * 3)];
        const m = new THREE.Group();
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6), stem);
        st.position.y = 0.17;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 }));
        cap.position.y = 0.33;
        cap.scale.y = 0.6;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        glow.scale.setScalar(1.2);
        glow.position.y = 0.35;
        m.add(st, cap, glow);
        m.position.set(x, t.y, -1.6 - r() * 0.6);
        m.scale.setScalar(0.8 + r() * 0.6);
        g.add(m);
      }
  }
  if (v.crystals) {
    const cm = ['#9ff0ff', '#c8a0ff'].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9 }));
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    for (let x = from; x < to; x += 4 + r() * 5) {
      const cl = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const c = new THREE.Mesh(geo, cm[k % 2]);
        c.scale.set(0.5, 1.6 + r() * 1.5, 0.5);
        c.position.set((r() - 0.5) * 1.2, 0.6, (r() - 0.5) * 0.8);
        c.rotation.z = (r() - 0.5) * 0.8;
        cl.add(c);
      }
      cl.position.set(x, -3.2, -4 - r() * 5);
      cl.scale.setScalar(1 + r());
      g.add(cl);
    }
  }
  if (v.puddles) {
    const pm = new THREE.MeshStandardMaterial({ color: '#9fb8c8', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.75 });
    for (const t of inRange)
      for (let x = Math.max(t.x0, from) + 1; x < Math.min(t.x1, to) - 1; x += 4 + r() * 6) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + r() * 0.5, 16), pm);
        p.rotation.x = -Math.PI / 2;
        p.scale.y = 0.45;
        p.position.set(x, t.y + 0.075, -0.6 + r() * 1.2);
        g.add(p);
      }
  }
  return g;
}
