/**
 * The magic plants that grow at decision points, modelled from primitives: a plank bridge woven from vines, a vine
 * ladder, a bouncy mushroom. Each has a growth animation (`grow(k)`, k from 0 to 1), a reaction (bounce squish)
 * and a wilt for wrong choices.
 */
import * as THREE from 'three';
import { BRIDGE_LEN, MUSHROOM_TOP, VINE_H } from '../game/physics';
import type { PlantKind } from '../game/types';
import { barkTexture } from './textures';

const back = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

export interface PlantView {
  kind: PlantKind;
  root: THREE.Group;
  grow(k: number): void;
  /** 0..1 wilt for a failed choice */
  wilt(k: number): void;
  poke(): void;
  update(dt: number, t: number): void;
}

const leafGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.12, 0.08, 0.12, 0.24, 0, 0.32);
  s.bezierCurveTo(-0.12, 0.24, -0.12, 0.08, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
})();

function mat(color: string, rough = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide });
}

function tintAll(root: THREE.Object3D, k: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !m.color) return;
    m.userData.base ??= m.color.clone();
    m.color.copy(m.userData.base as THREE.Color).lerp(new THREE.Color('#8a6a3a'), k * 0.7);
  });
}

function bridge(): PlantView {
  const root = new THREE.Group();
  const planks: THREE.Mesh[] = [];
  const wood = new THREE.MeshStandardMaterial({ color: '#c99662', map: barkTexture('#b8854f'), roughness: 0.85 });
  const vine = mat('#4d9a34');
  const n = 13;
  const step = BRIDGE_LEN / n;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(step * 0.86, 0.14, 1.5), wood);
    p.position.set(step * (i + 0.5), -0.08, 0);
    p.rotation.y = ((i * 37) % 7) * 0.012 - 0.03;
    p.castShadow = p.receiveShadow = true;
    root.add(p);
    planks.push(p);
  }
  // rope-vines along both sides with a gentle sag, plus little posts at the ends
  const ropes: THREE.Mesh[] = [];
  for (const z of [-0.72, 0.72]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const x = (BRIDGE_LEN * i) / 20;
      pts.push(new THREE.Vector3(x, 0.7 - Math.sin((Math.PI * i) / 20) * 0.25, z));
    }
    const r = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 6), vine);
    r.castShadow = true;
    root.add(r);
    ropes.push(r);
    for (const x of [0.1, BRIDGE_LEN - 0.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.95, 8), wood);
      post.position.set(x, 0.3, z);
      post.castShadow = true;
      root.add(post);
    }
    for (let i = 0; i < 10; i++) {
      const l = new THREE.Mesh(leafGeo, vine);
      const x = 0.3 + i * (BRIDGE_LEN / 10);
      l.position.set(x, 0.7 - Math.sin((Math.PI * x) / BRIDGE_LEN) * 0.25, z);
      l.rotation.set(0.4, 0, i % 2 ? 2.3 : -2.3);
      root.add(l);
    }
  }
  let wilt = 0;
  let sway = 0;
  return {
    kind: 'bridge',
    root,
    grow(k) {
      planks.forEach((p, i) => {
        const kk = clamp01(k * 1.4 - (i / n) * 0.9);
        p.scale.setScalar(Math.max(0.001, back(kk)));
        p.position.y = -0.08 + (1 - kk) * 0.4 - wilt * (i / n) * 1.6;
      });
      const kr = clamp01((k - 0.45) / 0.55);
      root.children.forEach((c) => {
        if (!planks.includes(c as THREE.Mesh)) c.scale.set(1, Math.max(0.001, kr), 1);
      });
    },
    wilt(k) {
      wilt = k;
      tintAll(root, k);
      this.grow(1);
      root.rotation.z = -k * 0.08;
    },
    poke() {
      sway = 1;
    },
    update(dt, t) {
      sway = Math.max(0, sway - dt);
      for (const r of ropes) r.position.y = Math.sin(t * 2) * 0.02;
      root.position.y += 0;
      void sway;
    },
  };
}

function vineLadder(): PlantView {
  const root = new THREE.Group();
  const green = mat('#3f9a37');
  const light = mat('#79cf4f');
  const rungMat = new THREE.MeshStandardMaterial({ color: '#6b8f2f', roughness: 0.8 });
  const parts: { o: THREE.Object3D; h: number }[] = [];
  for (const z of [-0.45, 0.45]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const y = (VINE_H * i) / 24;
      pts.push(new THREE.Vector3(Math.sin(i * 0.9 + z * 3) * 0.08, y, z + Math.cos(i * 0.7) * 0.06));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 6), green);
    tube.castShadow = true;
    root.add(tube);
    parts.push({ o: tube, h: 0 });
  }
  for (let y = 0.45; y < VINE_H; y += 0.5) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 6), rungMat);
    r.rotation.x = Math.PI / 2;
    r.position.set(0, y, 0);
    root.add(r);
    parts.push({ o: r, h: y });
  }
  for (let i = 0; i < 26; i++) {
    const y = 0.2 + (i / 26) * (VINE_H - 0.2);
    const l = new THREE.Mesh(leafGeo, i % 3 ? green : light);
    l.scale.setScalar(1.3 + (i % 4) * 0.2);
    l.position.set(0.05, y, i % 2 ? 0.5 : -0.5);
    l.rotation.set(i % 2 ? 0.3 : -0.3, 0, i % 2 ? -1.2 : 1.2);
    root.add(l);
    parts.push({ o: l, h: y });
  }
  // a curl at the top
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 16, Math.PI * 1.5), light);
  curl.position.set(0.1, VINE_H + 0.1, 0);
  root.add(curl);
  parts.push({ o: curl, h: VINE_H });
  let grown = 0;
  let wobble = 0;
  return {
    kind: 'vine',
    root,
    grow(k) {
      grown = k;
      const top = VINE_H * clamp01(k * 1.15);
      for (const p of parts) {
        if (p.h === 0) {
          p.o.scale.set(1, Math.max(0.001, clamp01(k * 1.15)), 1);
          continue;
        }
        const kk = clamp01((top - p.h) / 0.6);
        p.o.visible = kk > 0;
        if (p.o !== curl && kk > 0) p.o.scale.setScalar((p.o.type === 'Mesh' && (p.o as THREE.Mesh).geometry === leafGeo ? 1.4 : 1) * back(kk));
      }
    },
    wilt(k) {
      tintAll(root, k);
      wobble = k;
    },
    poke() {},
    update(_dt, t) {
      root.rotation.z = Math.sin(t * 1.3) * 0.015 * grown - wobble * 0.5 * Math.min(1, wobble * 2);
    },
  };
}

function mushroom(): PlantView {
  const root = new THREE.Group();
  const stalk = new THREE.Group();
  root.add(stalk);
  const stemMat = new THREE.MeshStandardMaterial({ color: '#f6ead2', roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#ff6b6b', roughness: 0.45 });
  const spotMat = new THREE.MeshStandardMaterial({ color: '#fff8ec', roughness: 0.6 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, MUSHROOM_TOP - 0.1, 14), stemMat);
  stem.position.y = (MUSHROOM_TOP - 0.1) / 2;
  stem.castShadow = true;
  stalk.add(stem);
  const cap = new THREE.Group();
  cap.position.y = MUSHROOM_TOP - 0.12;
  stalk.add(cap);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  dome.scale.set(1, 0.62, 1);
  dome.castShadow = true;
  cap.add(dome);
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshStandardMaterial({ color: '#f1c7a8', side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2;
  cap.add(under);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4,
      r = i === 0 ? 0 : 0.36 + (i % 2) * 0.1;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.075 + (i % 3) * 0.02, 10, 8), spotMat);
    const y = Math.sqrt(Math.max(0, 0.62 ** 2 - r * r)) * 0.62;
    s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    s.scale.y = 0.4;
    cap.add(s);
  }
  // little grass collar
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(leafGeo, mat('#5cb840'));
    l.position.set(Math.cos(i) * 0.3, 0, Math.sin(i) * 0.3);
    l.rotation.set(-0.3, i, (i % 2 ? 1 : -1) * 0.4);
    root.add(l);
  }
  let squish = 0;
  let k0 = 0;
  return {
    kind: 'mushroom',
    root,
    grow(k) {
      k0 = k;
      const s = Math.max(0.001, back(clamp01(k)));
      stalk.scale.set(s, Math.max(0.001, back(clamp01(k * 1.1))), s);
    },
    wilt(k) {
      tintAll(root, k);
      stalk.rotation.z = -k * 0.6;
    },
    poke() {
      squish = 1;
    },
    update(dt, t) {
      squish = Math.max(0, squish - dt * 3.5);
      const w = Math.sin(squish * 14) * squish;
      if (k0 >= 1) stalk.scale.set(1 + w * 0.35, 1 - w * 0.45, 1 + w * 0.35);
      cap.rotation.y = t * 0.2;
    },
  };
}

export function makePlant(kind: PlantKind): PlantView {
  if (kind === 'bridge') return bridge();
  if (kind === 'vine') return vineLadder();
  return mushroom();
}
