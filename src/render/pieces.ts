/**
 * The set pieces, modelled from primitives: planks hanging on ropes, drifting logs, lily pads and stepping stones,
 * big bouncy mushrooms, swing ropes, a cartoon crocodile, wind (blowing leaves), an old bridge that breaks, the
 * wild boar and its fence, cave rock, the waterfall curtain, dandelions. They follow the simulation every frame.
 */
import * as THREE from 'three';
import { bridgeGone, enemyX, gustOn, moverOffset, type SimState } from '../game/sim';
import type { Level } from '../game/types';
import { barkTexture, glowTexture, ringsTexture } from './textures';
import { fallsMaterial } from './scenery';

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const glow = (color: string, size: number, opacity = 0.6) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
};

export interface PiecesView {
  root: THREE.Group;
  update(s: SimState, t: number, dt: number): void;
  /** a big mushroom was bounced on */
  squish(i: number): void;
  /** how dark it is around x (cave) 0..1 */
  caveAt(x: number): number;
}

export function buildPieces(level: Level): PiecesView {
  const root = new THREE.Group();
  const wood = std('#b07a48', { map: barkTexture('#a8703f') });
  const ropeM = std('#c9a66b', { roughness: 0.9 });
  const vineM = std('#4f9a37');

  // ------------------------------------------------------------- movers
  const movers = level.movers.map((m) => {
    const g = new THREE.Group();
    const w = m.x1 - m.x0;
    if (m.kind === 'plank') {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 1.3), wood);
      board.position.set(w / 2, -0.11, 0);
      board.castShadow = board.receiveShadow = true;
      g.add(board);
      for (const x of [0.15, w - 0.15]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 4), ropeM);
        rope.position.set(x, 3, -0.2);
        g.add(rope);
      }
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, w + 1.6, 8), wood);
      branch.rotation.z = Math.PI / 2;
      branch.position.set(w / 2, 6, -0.2);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), std('#5cb840'));
      leaves.position.set(w / 2 + 0.6, 6.4, -0.4);
      g.add(branch, leaves);
      if (m.sinkAfter > 0) {
        // cracks: a sinking plank looks older
        const crack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.03, 1.32), std('#5a3a20'));
        crack.position.set(w / 2, 0.005, 0);
        g.add(crack);
      }
    } else if (m.kind === 'log') {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, w, 14), std('#9a6a40', { map: barkTexture('#8b5a35') }));
      log.rotation.z = Math.PI / 2;
      log.position.set(w / 2, -0.42, 0);
      log.castShadow = true;
      const ringM = std('#d9a86c', { map: ringsTexture() });
      for (const x of [0, w]) {
        const e = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), ringM);
        e.rotation.y = x ? Math.PI / 2 : -Math.PI / 2;
        e.position.set(x, -0.42, 0);
        g.add(e);
      }
      g.add(log);
    } else if (m.kind === 'lily') {
      const padC = m.sinkAfter > 0 ? '#a8c84a' : '#5fc84a';
      const pad = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 20, 0.3, Math.PI * 2 - 0.6), std(padC, { side: THREE.DoubleSide, emissive: padC, emissiveIntensity: 0.25 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(w / 2, 0.01, 0);
      pad.receiveShadow = true;
      g.add(pad);
      if (m.sinkAfter === 0) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), std('#ff9ccf', { emissive: '#ff6fb0', emissiveIntensity: 0.2 }));
        fl.position.set(w / 2 + 0.3, 0.12, -0.3);
        g.add(fl);
      } else {
        // yellowing edges: this one sinks
        const ring = new THREE.Mesh(new THREE.RingGeometry(w / 2 - 0.12, w / 2, 20), std('#c9b04a', { side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(w / 2, 0.02, 0);
        g.add(ring);
      }
    } else if (m.kind === 'stone') {
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(w / 2, 1), std('#9a9488', { flatShading: true }));
      st.scale.set(1, 0.5, 0.9);
      st.position.set(w / 2, -0.2, 0);
      st.castShadow = st.receiveShadow = true;
      g.add(st);
    } else {
      // big bouncy mushroom: the cap top is the bounce surface
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 12), std('#f4e8d0'));
      stem.position.set(w / 2, -3.3, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(w / 2 + 0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#5fa8ff', { roughness: 0.4, emissive: '#2f6fd0', emissiveIntensity: 0.15 }));
      cap.scale.y = 0.55;
      cap.position.set(w / 2, -0.35, 0);
      cap.castShadow = true;
      g.add(stem, cap);
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std('#ffffff'));
        const a = i * 1.1;
        sp.position.set(w / 2 + Math.cos(a) * 0.5, -0.05, Math.sin(a) * 0.5);
        sp.scale.y = 0.4;
        g.add(sp);
      }
      g.userData.cap = cap;
    }
    g.position.set(m.x0, m.y, 0);
    root.add(g);
    return { g, squish: 0 };
  });

  // ------------------------------------------------------------- ropes
  const ropes = level.ropes.map((r) => {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.4, 8), wood);
    branch.rotation.z = Math.PI / 2;
    branch.position.set(r.x, r.y + 0.1, -0.3);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), std('#4fa83a'));
    crown.position.set(r.x + 1, r.y + 0.9, -0.6);
    root.add(branch, crown);
    const pivot = new THREE.Group();
    pivot.position.set(r.x, r.y, 0);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), vineM);
    rope.castShadow = true;
    pivot.add(rope);
    for (let k = 0; k < 4; k++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), std('#79cf4f'));
      l.scale.set(1, 0.4, 0.6);
      l.userData.k = (k + 1) / 5;
      pivot.add(l);
    }
    root.add(pivot);
    return { pivot, rope };
  });

  // ------------------------------------------------------------- crocodiles (cartoon)
  const crocs = level.water.filter((w) => w.croc).map((w) => {
    const g = new THREE.Group();
    const green = std('#5fae4a', { roughness: 0.55 });
    const dark = std('#3f8a3a', { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.8, 6, 14), green);
    body.rotation.z = Math.PI / 2;
    body.scale.set(0.75, 1, 1);
    for (let i = 0; i < 6; i++) {
      const bump = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 5), dark);
      bump.position.set(-0.9 + i * 0.35, 0.36, 0);
      g.add(bump);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 8), green);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-1.8, -0.05, 0);
    const snout = new THREE.Group();
    snout.position.set(1.2, 0.05, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.26, 0.7), green);
    upper.position.set(0.6, 0.1, 0);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.62), std('#ff9e8a'));
    lower.position.set(0.55, -0.14, 0);
    const teeth = std('#ffffff');
    for (let i = 0; i < 5; i++)
      for (const z of [-0.3, 0.3]) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), teeth);
        t.rotation.x = Math.PI;
        t.position.set(0.15 + i * 0.25, -0.08, z);
        upper.add(t);
      }
    snout.add(upper, lower);
    for (const z of [-0.22, 0.22]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), std('#ffffff'));
      e.position.set(1.15, 0.45, z);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std('#1a1a1a'));
      p.position.set(1.3, 0.5, z * 1.15);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), green);
      lid.position.copy(e.position);
      g.add(e, p, lid);
    }
    g.add(body, tail, snout);
    g.scale.setScalar(1.25);
    g.position.set((w.x0 + w.x1) / 2, w.y + 0.05, 0.4);
    root.add(g);
    return { g, upper, w };
  });

  // ------------------------------------------------------------- wind: leaves blowing along the zone
  const winds = level.zones.filter((z) => z.kind === 'wind').map((z) => {
    const n = Math.round((z.x1 - z.x0) * 1.2);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([z.x0 + ((i * 37) % 100) / 100 * (z.x1 - z.x0), 0.5 + ((i * 53) % 100) / 100 * 5, -1.5 + ((i * 71) % 100) / 100 * 3], i * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), color: '#f0a03a', size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
    pts.frustumCulled = false;
    root.add(pts);
    // a wind vane at the start shows the direction
    const vane = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), wood);
    pole.position.y = 1.2;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 4), std('#ff7a3a', { side: THREE.DoubleSide }));
    flag.rotation.z = -(z.dir ?? 1) * Math.PI / 2;
    flag.position.set((z.dir ?? 1) * 0.5, 2.2, 0);
    vane.add(pole, flag);
    vane.position.set(z.x0 + 0.5, 0, -1.6);
    root.add(vane);
    return { z, pts, flag };
  });

  // ------------------------------------------------------------- collapsing bridges
  const planks: { i: number; m: THREE.Group; fall: number }[] = [];
  level.boxes.forEach((b, i) => {
    if (b.kind !== 'bridge') return;
    const m = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry((b.x1 - b.x0) * 0.92, 0.2, 1.5), std('#a8784a', { map: barkTexture('#9a6a40') }));
    p.castShadow = p.receiveShadow = true;
    p.rotation.y = ((i * 13) % 5) * 0.02 - 0.04;
    m.add(p);
    for (const z of [-0.75, 0.75]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, b.x1 - b.x0, 4), ropeM);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(0, 0.7, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 4), wood);
      post.position.set(-(b.x1 - b.x0) / 2, 0.35, z);
      m.add(rope, post);
    }
    m.position.set((b.x0 + b.x1) / 2, b.y1 - 0.1, 0);
    root.add(m);
    planks.push({ i, m, fall: 0 });
  });

  // ------------------------------------------------------------- chase: boar and fence
  const chase = level.zones.find((z) => z.kind === 'chase');
  let boar: { g: THREE.Group; legs: THREE.Mesh[] } | null = null;
  if (chase) {
    const g = new THREE.Group();
    const fur = std('#8a5a3a', { roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), fur);
    body.scale.set(1.4, 0.95, 0.85);
    body.position.y = 0.8;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), fur);
    head.position.set(0.95, 0.75, 0);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 12), std('#e0a090'));
    snout.rotation.z = Math.PI / 2;
    snout.position.set(1.35, 0.68, 0);
    const tuskM = std('#fff6e0');
    for (const z of [-0.14, 0.14]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), tuskM);
      t.position.set(1.3, 0.5, z);
      t.rotation.z = -0.6;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#1a1a1a'));
      e.position.set(1.15, 0.95, z * 1.3);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), fur);
      ear.position.set(0.85, 1.15, z * 1.8);
      g.add(t, e, ear);
    }
    const mane = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.2), std('#5a3a22'));
    mane.position.set(0.1, 1.42, 0);
    g.add(body, head, snout, mane);
    const legs: THREE.Mesh[] = [];
    for (const [x, z] of [[-0.6, -0.3], [-0.6, 0.3], [0.5, -0.3], [0.5, 0.3]] as const) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.5, 6), std('#5a3a22'));
      l.position.set(x, 0.25, z);
      g.add(l);
      legs.push(l);
    }
    g.position.set(chase.x0 - 12, chase.y ?? 0, 0.2);
    g.visible = false;
    root.add(g);
    boar = { g, legs };
    // the fence at the end
    const fence = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.16), wood);
      post.position.set(0, 0.7, -1.6 + k * 1.1);
      fence.add(post);
    }
    for (const y of [0.5, 1.1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 3.6), wood);
      rail.position.set(0, y, -0.05);
      fence.add(rail);
    }
    fence.position.set(chase.x1 - 0.4, chase.y ?? 0, 0);
    root.add(fence);
  }

  // ------------------------------------------------------------- caves: rock ceiling, glowing hazards
  const caves = level.zones.filter((z) => z.kind === 'cave');
  const rockM = std('#4a4440', { flatShading: true, roughness: 1 });
  for (const z of caves) {
    for (let x = z.x0 - 2; x < z.x1 + 2; x += 2.2) {
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), rockM);
      c.position.set(x, 7.2 + Math.sin(x) * 0.6, -0.5 + Math.cos(x * 1.3));
      c.rotation.set(x, x * 0.7, 0);
      root.add(c);
      if (Math.floor(x) % 3 === 0) {
        const sta = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), rockM);
        sta.rotation.x = Math.PI;
        sta.position.set(x + 0.8, 5.4, -1);
        root.add(sta);
      }
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(z.x1 - z.x0 + 8, 14), std('#2a2624'));
    back.position.set((z.x0 + z.x1) / 2, 2, -3.5);
    root.add(back);
    // static hazards glow so they are seen early in the dark
    for (const h of level.hazards) if (h.x0 >= z.x0 - 1 && h.x1 <= z.x1 + 1) {
      const gl = glow('#ff7a9a', (h.x1 - h.x0) + 1.5, 0.7);
      gl.position.set((h.x0 + h.x1) / 2, h.y1 * 0.6, 0.4);
      root.add(gl);
    }
    for (const b of level.boxes) if ((b.kind === 'stump' || b.kind === 'log') && b.x0 >= z.x0 - 1 && b.x1 <= z.x1 + 1) {
      const gl = glow('#ffd27a', 2.2, 0.55);
      gl.position.set((b.x0 + b.x1) / 2, b.kind === 'log' ? b.y0 + 0.5 : b.y1, 0.4);
      root.add(gl);
    }
  }
  const enemyGlows = level.enemies.map((e) => {
    if (!caves.some((z) => e.x0 >= z.x0 - 2 && e.x0 <= z.x1 + 2)) return null;
    const gl = glow('#ff9a5a', 1.8, 0.7);
    root.add(gl);
    return gl;
  });

  // ------------------------------------------------------------- waterfalls
  for (const z of level.zones.filter((q) => q.kind === 'waterfall')) {
    const top = 9;
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(z.x1 - z.x0 - 1, top), fallsMaterial());
    curtain.position.set((z.x0 + z.x1) / 2, top / 2 - 0.2, 1.0);
    curtain.renderOrder = 2;
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(z.x1 - z.x0 + 3, top + 2, 2), std('#7a8078', { flatShading: true }));
    cliff.position.set((z.x0 + z.x1) / 2, (top + 2) / 2 - 1, -2.6);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(z.x1 - z.x0 + 3.2, 0.6, 2.6), std('#6fa85a'));
    lip.position.set((z.x0 + z.x1) / 2, top, -1.2);
    const spray = glow('#ffffff', 5, 0.5);
    spray.position.set((z.x0 + z.x1) / 2, 0.4, 1.2);
    root.add(cliff, lip, curtain, spray);
  }

  // ------------------------------------------------------------- dandelions at the glide valleys
  for (const z of level.zones.filter((q) => q.kind === 'glide')) {
    for (let k = 0; k < 3; k++) {
      const d = dandelion();
      d.position.set(z.x0 + 0.6 + k * 0.7, 0, -1.2 + k * 0.3);
      const y = level.boxes.find((b) => b.kind === 'ground' && z.x0 + 1 >= b.x0 && z.x0 + 1 <= b.x1)?.y1 ?? 0;
      d.position.y = y;
      root.add(d);
    }
  }

  const tmp = new THREE.Vector3();
  return {
    root,
    squish(i) {
      if (movers[i]) movers[i].squish = 1;
    },
    caveAt(x) {
      let k = 0;
      for (const z of caves) k = Math.max(k, Math.min(1, (x - z.x0 + 3) / 4, (z.x1 + 3 - x) / 4));
      return Math.max(0, k);
    },
    update(s, t, dt) {
      level.movers.forEach((m, i) => {
        const v = movers[i];
        v.g.position.set(m.x0 + moverOffset(m, s.et), m.y - s.moverD[i] + (m.kind === 'log' || m.kind === 'lily' ? Math.sin(t * 2 + i) * 0.03 : 0), 0);
        if (m.kind === 'plank' && m.amp) v.g.rotation.z = Math.cos(s.et / 60 * m.freq + m.phase) * 0.05;
        if (m.kind === 'shroom') {
          v.squish = Math.max(0, v.squish - dt * 3);
          const w = Math.sin(v.squish * 12) * v.squish;
          (v.g.userData.cap as THREE.Mesh).scale.set(1 + w * 0.3, 0.55 * (1 - w * 0.5), 1 + w * 0.3);
        }
      });
      level.ropes.forEach((r, i) => {
        const v = ropes[i];
        let a: number, len: number;
        if (s.rope === i) {
          a = s.ropeA;
          len = s.ropeL + 0.2;
        } else {
          a = Math.sin(t * 1.3 + i) * 0.08;
          len = r.len;
        }
        v.pivot.rotation.z = -a;
        v.rope.scale.y = len;
        v.rope.position.y = -len / 2;
        for (const c of v.pivot.children) if (c.userData.k) c.position.set(0.08, -len * (c.userData.k as number), 0);
      });
      for (const c of crocs) {
        const mid = (c.w.x0 + c.w.x1) / 2;
        const half = (c.w.x1 - c.w.x0) / 2 - 1.5;
        c.g.position.x = mid + Math.sin(t * 0.4) * half;
        c.g.rotation.y = Math.cos(t * 0.4) > 0 ? 0 : Math.PI;
        const near = s.x > c.w.x0 - 2 && s.x < c.w.x1 + 2 && Math.abs(s.x - c.g.position.x) < 4;
        const open = near ? 0.35 + Math.sin(t * 6) * 0.15 : 0.05;
        c.upper.rotation.z += (open - c.upper.rotation.z) * Math.min(1, dt * 8);
        c.g.position.y = c.w.y + 0.05 + Math.sin(t * 1.7) * 0.06;
      }
      for (const w of winds) {
        const on = gustOn(w.z, s.et);
        const p = w.pts.geometry.attributes.position as THREE.BufferAttribute;
        const dir = w.z.dir ?? 1;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i) + dir * dt * (on ? 9 : 0.8);
          if (x > w.z.x1) x -= w.z.x1 - w.z.x0;
          if (x < w.z.x0) x += w.z.x1 - w.z.x0;
          p.setX(i, x);
          p.setY(i, p.getY(i) + Math.sin(t * 3 + i) * dt * (on ? 1.5 : 0.3));
        }
        p.needsUpdate = true;
        (w.pts.material as THREE.PointsMaterial).opacity = on ? 0.95 : 0.35;
        w.flag.rotation.x = Math.sin(t * (on ? 18 : 3)) * (on ? 0.4 : 0.1);
      }
      for (const p of planks) {
        if (bridgeGone(level, s, p.i)) {
          p.fall += dt;
          p.m.position.y -= p.fall * dt * 14;
          p.m.rotation.z += dt * (p.i % 2 ? 1.5 : -1.5);
          p.m.visible = p.fall < 2;
        } else if (p.fall > 0) {
          // a retry: the bridge is back
          const b = level.boxes[p.i];
          p.fall = 0;
          p.m.position.set((b.x0 + b.x1) / 2, b.y1 - 0.1, 0);
          p.m.rotation.set(0, 0, 0);
          p.m.visible = true;
        }
      }
      if (boar && chase) {
        const on = !Number.isNaN(s.boarX);
        boar.g.visible = on;
        if (on) {
          boar.g.position.x = s.boarX;
          const run = !s.boarDone;
          boar.legs.forEach((l, i) => (l.rotation.z = run ? Math.sin(t * 16 + i * 1.6) * 0.6 : 0));
          boar.g.children[0].position.y = 0.8 + (run ? Math.abs(Math.sin(t * 16)) * 0.08 : 0);
        }
      }
      enemyGlows.forEach((gl, i) => {
        if (!gl) return;
        const e = level.enemies[i];
        gl.visible = !s.enemyDead[i];
        tmp.set(enemyX(e, s.et, s.rollAt[i]), e.y + 0.5, 0.5);
        gl.position.copy(tmp);
      });
    },
  };
}

/** a dandelion: a stem and a puff of seeds */
export function dandelion(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.4 * scale, 5), std('#6ab04a'));
  stem.position.y = 0.7 * scale;
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 14, 10), std('#ffffff', { transparent: true, opacity: 0.85, emissive: '#ffffff', emissiveIntensity: 0.2 }));
  puff.position.y = 1.5 * scale;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 8, 6), std('#c8a040'));
  core.position.y = 1.5 * scale;
  g.add(stem, puff, core);
  return g;
}
