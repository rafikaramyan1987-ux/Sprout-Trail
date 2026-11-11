/**
 * The magic plants that grow at decision points, modelled from primitives: a plank bridge woven from vines, a vine
 * ladder, a bouncy mushroom. Each has a growth animation (`grow(k)`, k from 0 to 1), a reaction (bounce squish)
 * and a wilt for wrong choices.
 */
import * as THREE from 'three';
import { BRIDGE_LEN, LOG_LEN, LOG_TOP, MUSHROOM_TOP, TREE_LEN, VINE_H } from '../game/physics';
import type { PlantKind } from '../game/types';
import { barkTexture, ringsTexture } from './textures';

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

/** a giant leaf: it grows from a curled sprout and opens like an umbrella (the sprite holds it to glide) */
export function leafShapeGeo(len = 1.6, wid = 0.85) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid, len * 0.2, wid * 1.05, len * 0.7, 0, len);
  s.bezierCurveTo(-wid * 1.05, len * 0.7, -wid, len * 0.2, 0, 0);
  const g = new THREE.ShapeGeometry(s, 16);
  // cup it a little
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, -(Math.abs(p.getX(i)) ** 2) * 0.35);
  g.computeVertexNormals();
  return g;
}

function bigLeaf(): PlantView {
  const root = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: '#5fbf45', roughness: 0.6, side: THREE.DoubleSide });
  const vein = new THREE.MeshStandardMaterial({ color: '#3f8f2f', roughness: 0.6 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.6, 6), vein);
  stem.position.y = 0.8;
  const pivot = new THREE.Group();
  pivot.position.y = 1.6;
  const leaf = new THREE.Mesh(leafShapeGeo(), green);
  leaf.rotation.x = -Math.PI / 2 + 0.7;
  leaf.position.set(0, 0, 0.8);
  leaf.castShadow = true;
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 4), vein);
  mid.rotation.x = Math.PI / 2 - 0.25;
  mid.position.set(0, 0.06, 0.78);
  pivot.add(leaf, mid);
  root.add(stem, pivot);
  root.rotation.y = -Math.PI / 2 + 0.6;
  let k0 = 0;
  return {
    kind: 'leaf',
    root,
    grow(k) {
      k0 = k;
      stem.scale.set(1, Math.max(0.001, clamp01(k * 1.6)), 1);
      stem.position.y = 0.8 * clamp01(k * 1.6);
      pivot.position.y = 1.6 * clamp01(k * 1.6);
      const open = back(clamp01((k - 0.35) / 0.65));
      pivot.scale.setScalar(Math.max(0.001, open));
      pivot.rotation.z = (1 - clamp01(open)) * 1.2;
    },
    wilt(k) {
      tintAll(root, k);
      pivot.rotation.x = k * 0.8;
    },
    poke() {},
    update(_dt, t) {
      if (k0 >= 1) pivot.rotation.y = Math.sin(t * 2) * 0.06;
    },
  };
}

/** a tall tree: it shoots up, then topples forward into a long bridge */
function tallTree(): PlantView {
  const root = new THREE.Group();
  const hinge = new THREE.Group();
  root.add(hinge);
  const bark = new THREE.MeshStandardMaterial({ color: '#b98a5a', map: barkTexture('#8b5a35'), roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, TREE_LEN, 14), bark);
  trunk.position.y = TREE_LEN / 2;
  trunk.castShadow = trunk.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), new THREE.MeshStandardMaterial({ map: ringsTexture(), roughness: 0.9 }));
  ring.rotation.x = Math.PI / 2;
  hinge.add(trunk, ring);
  const crown = new THREE.Group();
  crown.position.y = TREE_LEN - 0.4;
  const greens = ['#5cb840', '#7bd05a', '#4a9a35'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + (i % 3) * 0.2, 1), greens[i % 3]);
    b.position.set(Math.cos(i * 2.1) * 0.6, (i % 3) * 0.35, Math.sin(i * 2.1) * 0.6);
    b.castShadow = true;
    crown.add(b);
  }
  hinge.add(crown);
  let grown = 0;
  return {
    kind: 'tree',
    root,
    grow(k) {
      grown = k;
      // 0-0.55: grow up; 0.55-1: fall forward (rotate around the base towards +x)
      const up = clamp01(k / 0.55);
      hinge.scale.set(1, Math.max(0.001, back(up)), 1);
      const fall = clamp01((k - 0.55) / 0.45);
      hinge.rotation.z = -(Math.PI / 2) * fall * fall;
      hinge.position.y = -0.4 * fall;
    },
    wilt(k) {
      tintAll(root, k);
    },
    poke() {},
    update(_dt, t) {
      if (grown < 0.55) crown.rotation.y = t;
    },
  };
}

/** a sturdy log that drops onto the obstacle */
function bigLog(): PlantView {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  root.add(holder);
  const bark = new THREE.MeshStandardMaterial({ color: '#a8784a', map: barkTexture('#7b5236'), roughness: 0.9 });
  const rad = (LOG_TOP - 0.2) / 2 + 0.05;
  const log = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, LOG_LEN, 16), bark);
  log.rotation.z = Math.PI / 2;
  log.position.set(LOG_LEN / 2, 0.2 + rad, 0);
  log.castShadow = log.receiveShadow = true;
  holder.add(log);
  const rings = new THREE.MeshStandardMaterial({ map: ringsTexture(), roughness: 0.9 });
  for (const x of [0, LOG_LEN]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(rad, 16), rings);
    e.rotation.y = x ? Math.PI / 2 : -Math.PI / 2;
    e.position.set(x, 0.2 + rad, 0);
    holder.add(e);
  }
  const moss = new THREE.MeshStandardMaterial({ color: '#6dbb4a' });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), moss);
    m.scale.y = 0.4;
    m.position.set(0.4 + i * 0.65, 0.2 + rad * 2, (i % 2) * 0.2 - 0.1);
    holder.add(m);
  }
  // little stakes holding it up
  for (const x of [0.3, LOG_LEN - 0.3]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6), bark);
    st.position.set(x, 0.1, 0.5);
    holder.add(st);
  }
  return {
    kind: 'log',
    root,
    grow(k) {
      const kk = clamp01(k);
      holder.position.y = (1 - kk) ** 2 * 6;
      holder.scale.setScalar(Math.max(0.001, clamp01(k * 3)));
    },
    wilt(k) {
      tintAll(root, k);
      holder.rotation.z = -k * 0.3;
    },
    poke() {},
    update() {},
  };
}

export function makePlant(kind: PlantKind): PlantView {
  if (kind === 'bridge') return bridge();
  if (kind === 'vine') return vineLadder();
  if (kind === 'leaf') return bigLeaf();
  if (kind === 'tree') return tallTree();
  if (kind === 'log') return bigLog();
  return mushroom();
}
