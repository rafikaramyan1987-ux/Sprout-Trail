/** Hand-modelled props: gems, golden acorns, the beetle, wooden signs, checkpoint flowers, the goal burrow. */
import * as THREE from 'three';
import { barkTexture, glowTexture, ringsTexture, signTexture } from './textures';

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

export const gemGeo = new THREE.OctahedronGeometry(0.26, 0);
gemGeo.scale(1, 1.35, 1);
export const gemMat = std('#5fd8ff', { roughness: 0.15, metalness: 0.1, emissive: '#1a9ad0', emissiveIntensity: 0.55, flatShading: true });

export function acorn(): THREE.Group {
  const g = new THREE.Group();
  const gold = std('#ffc83d', { roughness: 0.3, metalness: 0.35, emissive: '#b36b00', emissiveIntensity: 0.35 });
  const capM = std('#c58a2a', { roughness: 0.6, metalness: 0.2, emissive: '#5a3500', emissiveIntensity: 0.25 });
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), gold);
  nut.scale.set(1, 1.15, 1);
  nut.position.y = -0.06;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 10), gold);
  tip.rotation.x = Math.PI;
  tip.position.y = -0.36;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM);
  cap.scale.set(1, 0.55, 1);
  cap.position.y = 0.08;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6), capM);
  stem.position.set(0.02, 0.27, 0);
  stem.rotation.z = -0.3;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffe48a', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.5);
  g.add(halo, nut, tip, cap, stem);
  for (const m of [nut, tip, cap]) m.castShadow = true;
  return g;
}

export interface BeetleView {
  root: THREE.Group;
  update(t: number, dir: number): void;
}

export function beetle(): BeetleView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), std('#7a5cd6', { roughness: 0.35 }));
  shell.scale.set(1.15, 0.85, 0.95);
  shell.position.y = 0.16;
  shell.castShadow = true;
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.02), std('#3d2a7a'));
  line.position.set(-0.05, 0.32, 0.39);
  const spots = std('#f7d24a');
  for (const [x, z] of [[-0.18, 0.3], [0.16, 0.3], [0.0, 0.42], [-0.22, -0.15], [0.2, -0.15]] as const) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), spots);
    s.position.set(x, 0.36 + (z > 0.35 ? -0.12 : 0), z * 0.8);
    s.scale.y = 0.5;
    body.add(s);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), std('#3a2c4a'));
  head.position.set(0.42, 0.22, 0);
  head.castShadow = true;
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const pupM = new THREE.MeshBasicMaterial({ color: '#1a1020' });
  for (const z of [-0.09, 0.09]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeM);
    e.position.set(0.56, 0.3, z + 0.04);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), pupM);
    p.position.set(0.62, 0.3, z + 0.07);
    body.add(e, p);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 4), std('#3a2c4a'));
    ant.position.set(0.5, 0.48, z);
    ant.rotation.z = -0.5;
    body.add(ant);
  }
  body.add(shell, line, head);
  const legs: THREE.Mesh[] = [];
  const legM = std('#3a2c4a');
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.22, 4), legM);
    l.position.set(-0.22 + (i % 3) * 0.22, 0.08, i < 3 ? 0.3 : -0.3);
    l.rotation.x = i < 3 ? 0.6 : -0.6;
    body.add(l);
    legs.push(l);
  }
  return {
    root,
    update(t, dir) {
      body.rotation.y = dir > 0 ? -0.5 : Math.PI + 0.5;
      body.position.y = Math.abs(Math.sin(t * 10)) * 0.04;
      legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 14 + i * 2) * 0.5));
    },
  };
}

export function sign(text: string): THREE.Group {
  const g = new THREE.Group();
  const wood = std('#8b5a35', { map: barkTexture('#8b5a35') });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 8), wood);
  post.position.set(0, 0.95, -0.14);
  post.castShadow = true;
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.12), std('#a87346'));
  board.position.y = 1.75;
  board.castShadow = true;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.18), new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.9 }));
  face.position.set(0, 1.75, 0.065);
  g.add(post, board, face);
  g.rotation.y = 0.12;
  return g;
}

export interface CheckpointView {
  root: THREE.Group;
  open(k: number): void;
}

export function checkpoint(): CheckpointView {
  const root = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), std('#4f9e3a'));
  stem.position.y = 0.8;
  root.add(stem);
  const head = new THREE.Group();
  head.position.y = 1.65;
  root.add(head);
  const petals: THREE.Mesh[] = [];
  const pm = std('#ffd1e8', { emissive: '#ff8cc6', emissiveIntensity: 0.15 });
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), pm);
    p.scale.set(1, 0.35, 0.55);
    const a = (i / 8) * Math.PI * 2;
    p.userData.a = a;
    head.add(p);
    petals.push(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), std('#ffcf3d', { emissive: '#ffb000', emissiveIntensity: 0.3 }));
  head.add(core);
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), std('#5cb840'));
    leaf.scale.set(1, 0.25, 0.5);
    leaf.position.set(s * 0.2, 0.6, 0);
    leaf.rotation.z = s * 0.5;
    root.add(leaf);
  }
  const open = (k: number) => {
    petals.forEach((p) => {
      const a = p.userData.a as number;
      const r = 0.05 + 0.22 * k;
      p.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.02);
      p.rotation.set(0, 0, a);
      p.scale.set(0.5 + 0.5 * k, 0.35, 0.55);
    });
    pm.color.set(k > 0.5 ? '#ff9ccf' : '#ffd1e8');
    core.scale.setScalar(0.6 + 0.4 * k);
  };
  open(0);
  root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return { root, open };
}

/** the goal: a cosy stump house with a round door and a flower arch */
export function goalHouse(): THREE.Group {
  const g = new THREE.Group();
  const bark = std('#8b5a35', { map: barkTexture('#9a6640') });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 3.2, 20), bark);
  trunk.position.set(1.6, 1.6, -1.6);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), std('#d9a86c', { map: ringsTexture() }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(1.6, 3.21, -1.6);
  const roof = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#ff7a6b', { roughness: 0.5 }));
  roof.scale.set(1, 0.7, 1);
  roof.position.set(1.6, 3.15, -1.6);
  const spot = std('#fff6ea');
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), spot);
    const a = i * 1.1;
    s.position.set(1.6 + Math.cos(a) * 1.1, 3.75 - (i % 2) * 0.2, -1.6 + Math.sin(a) * 1.1);
    s.scale.y = 0.4;
    g.add(s);
  }
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), std('#5a3a22'));
  door.position.set(1.0, 1.0, -0.15);
  door.rotation.y = -0.35;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#ffd34d', { metalness: 0.5 }));
  knob.position.set(1.25, 0.95, -0.05);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), std('#ffe9a8', { emissive: '#ffcc66', emissiveIntensity: 0.8 }));
  win.position.set(2.3, 2.1, -0.25);
  win.rotation.y = 0.3;
  g.add(trunk, top, roof, door, knob, win);
  // flower arch over the path
  const archM = std('#5aa83c');
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 8, 30, Math.PI), archM);
  arch.position.set(-0.6, 0, 0.3);
  g.add(arch);
  const colors = ['#ffd84a', '#ff8fb8', '#ffffff', '#b38bff'];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), std(colors[i % 4], { emissive: colors[i % 4], emissiveIntensity: 0.15 }));
    f.position.set(-0.6 + Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0.35);
    g.add(f);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}
