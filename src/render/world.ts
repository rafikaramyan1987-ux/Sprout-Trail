/**
 * Builds the 3D trail of a level from its data: soil slabs with a soft grass cap, stumps, fallen logs, bramble
 * thorns, streams, floating ledges, decoration (CC0 nature models), pickups, beetles, signs, checkpoints, goal.
 */
import * as THREE from 'three';
import type { Box, Level } from '../game/types';
import { enemyX, type SimState } from '../game/sim';
import { instanced, hasModel, modelSize } from './assets';
import { acorn, beetle, checkpoint, gemGeo, gemMat, goalHouse, sign, type BeetleView, type CheckpointView } from './props';
import { barkTexture, ringsTexture, soilTexture } from './textures';
import { has, t } from '../i18n';

/** tutorial signs read differently on touch screens and with a keyboard */
export const touchFirst = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const signText = (k: string) => (has(`${k}.touch`) ? t(`${k}.${touchFirst() ? 'touch' : 'keys'}`) : t(k));

const Z0 = -2.4;
const Z1 = 1.25;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** a box with world-space UVs (so textures tile evenly whatever the size) */
function slabGeometry(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, uvScale = 0.25) {
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uvOf: (p: number[]) => [number, number]) => {
    const i = pos.length / 3;
    for (const p of [a, b, c, d]) {
      pos.push(...p);
      nor.push(...n);
      uv.push(...uvOf(p).map((v) => v * uvScale));
    }
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // front
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], (p) => [p[0], p[1]]);
  // left / right
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], (p) => [p[2], p[1]]);
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], (p) => [-p[2], p[1]]);
  // top
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], (p) => [p[0], p[2]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** the grass cap: a soft slab with a scalloped lip hanging over the soil */
function grassCap(x0: number, x1: number, y: number, z0: number, z1: number, lip = 0.32, seed = 1) {
  const r = rng(seed);
  const s = new THREE.Shape();
  const ox = 0.1;
  s.moveTo(x0 - ox, y + 0.07);
  s.lineTo(x1 + ox, y + 0.07);
  s.lineTo(x1 + ox, y - lip * 0.6);
  const n = Math.max(2, Math.round((x1 - x0) / 0.75));
  const w = (x1 - x0 + 2 * ox) / n;
  for (let i = n - 1; i >= 0; i--) {
    const xa = x0 - ox + i * w;
    const d = lip * (0.75 + r() * 0.5);
    s.quadraticCurveTo(xa + w / 2, y - d - lip * 0.5, xa, y - lip * 0.6);
  }
  s.lineTo(x0 - ox, y + 0.07);
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, z0);
  return g;
}

export interface WorldView {
  root: THREE.Group;
  gems: THREE.InstancedMesh;
  gemIndex: number[];
  acorns: Map<number, THREE.Group>;
  beetles: BeetleView[];
  checkpoints: CheckpointView[];
  goal: THREE.Group;
  /** pickup index → gem instance index */
  update(s: SimState, t: number, dt: number): void;
  hidePickup(i: number): void;
}

export function buildWorld(level: Level): WorldView {
  const root = new THREE.Group();
  const r = rng(level.seed * 7919);
  const soil = new THREE.MeshStandardMaterial({ map: soilTexture(), roughness: 0.95 });
  const rock = new THREE.MeshStandardMaterial({ map: soilTexture('#9c9184', '#6f665c', '#bdb3a4'), roughness: 0.95 });
  const grass = new THREE.MeshStandardMaterial({ color: '#86cf5c', roughness: 0.85 });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#a8a092', roughness: 0.95, flatShading: true });
  const deepSoil = new THREE.MeshStandardMaterial({ map: soilTexture('#5e3f27', '#3f2918', '#6f4a2e'), roughness: 1 });
  const grassDark = new THREE.MeshStandardMaterial({ color: '#5fae47', roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.9 });
  const rings = new THREE.MeshStandardMaterial({ map: ringsTexture(), roughness: 0.9 });

  const tops: { x0: number; x1: number; y: number }[] = [];
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  for (const b of level.boxes) {
    if (b.kind === 'ground' || b.kind === 'wall') {
      const y0 = Math.max(b.y0, b.y1 - 30);
      addMesh(slabGeometry(b.x0, b.x1, y0, b.y1, Z0, Z1), soil, b.kind === 'wall');
      if (b.kind === 'wall')
        for (let y = b.y0 + 0.6; y < b.y1 - 0.4; y += 1.1) {
          const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + r() * 0.2, 0), rockMat);
          st.position.set(b.x0 + 0.1 + r() * 0.3, y, Z1 - 0.2 - r() * 0.8);
          st.rotation.set(r() * 3, r() * 3, 0);
          st.castShadow = true;
          root.add(st);
        }
      addMesh(grassCap(b.x0, b.x1, b.y1, Z0, Z1, 0.32, Math.round(b.x0 * 10)), grass);
      addMesh(grassCap(b.x0 + 0.05, b.x1 - 0.05, b.y1 - 0.12, Z0 + 0.02, Z1 + 0.03, 0.28, Math.round(b.x0 * 13)), grassDark, false);
      tops.push({ x0: b.x0, x1: b.x1, y: b.y1 });
    } else if (b.kind === 'stump') {
      stump(root, b, bark, rings);
    } else if (b.kind === 'log') {
      log(root, b, bark, rings);
    } else if (b.kind === 'ledge') {
      addMesh(slabGeometry(b.x0 + 0.1, b.x1 - 0.1, b.y0, b.y1 - 0.05, -1.1, 0.9), rock);
      addMesh(grassCap(b.x0, b.x1, b.y1, -1.15, 0.95, 0.22, Math.round(b.x0 * 10)), grass);
      tops.push({ x0: b.x0, x1: b.x1, y: b.y1 });
    }
  }

  // dry pits look like ravines: a dark soil wall at the back
  const grounds = level.boxes.filter((b) => b.kind === 'ground' || b.kind === 'wall').sort((a, b) => a.x0 - b.x0);
  for (let i = 0; i + 1 < grounds.length; i++) {
    const a = grounds[i],
      b = grounds[i + 1];
    if (b.x0 - a.x1 < 0.5 || level.water.some((w) => w.x0 < b.x0 && w.x1 > a.x1)) continue;
    const top = Math.min(a.y1, b.y1) - 0.6;
    addMesh(slabGeometry(a.x1 - 0.05, b.x0 + 0.05, top - 30, top, Z0 - 0.4, Z0 + 0.05), deepSoil, false);
    addMesh(grassCap(a.x1, b.x0, top, Z0 - 0.4, Z0 + 0.05, 0.25, Math.round(a.x1 * 10)), grassDark, false);
  }

  // low meadow behind the ridge
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(level.goalX + 200, 60), new THREE.MeshStandardMaterial({ color: '#8ccf6a', roughness: 1 }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.set(level.goalX / 2, -3.2, -33);
  meadow.receiveShadow = true;
  root.add(meadow);

  // streams
  const waterMat = new THREE.MeshStandardMaterial({ color: '#59b8e6', roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.85 });
  waterMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = waterTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uT; varying vec3 vW;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rip = sin(vW.x * 3.0 + uT * 2.0) * sin(vW.z * 4.0 - uT * 1.3);
        diffuseColor.rgb += vec3(0.12, 0.16, 0.18) * smoothstep(0.55, 0.95, rip);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.95, 1.0), smoothstep(0.75, 1.0, abs(vW.z + 0.6) / 1.9) * 0.4);`,
      );
  };
  for (const w of level.water) {
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0 + 0.4, Z1 - Z0, 24, 4), waterMat);
    surf.rotation.x = -Math.PI / 2;
    surf.position.set((w.x0 + w.x1) / 2, w.y, (Z0 + Z1) / 2);
    root.add(surf);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0 + 0.4, 1.2), new THREE.MeshBasicMaterial({ color: '#2f7fb0', transparent: true, opacity: 0.75 }));
    front.position.set((w.x0 + w.x1) / 2, w.y - 0.6, Z1);
    root.add(front);
    const bed = new THREE.Mesh(slabGeometry(w.x0 - 0.2, w.x1 + 0.2, w.y - 30, w.y - 1.2, Z0, Z1 - 0.05), soil);
    root.add(bed);
    // reeds and stones on the banks
    for (const x of [w.x0 + 0.3, w.x1 - 0.3]) {
      for (let i = 0; i < 4; i++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.2 + r() * 0.6, 4), grassDark);
        reed.position.set(x + (r() - 0.5) * 0.6, w.y + 0.5, Z0 + 0.4 + r() * 0.8);
        reed.rotation.z = (r() - 0.5) * 0.3;
        root.add(reed);
      }
    }
  }

  // thorn brambles
  const thornStem = new THREE.MeshStandardMaterial({ color: '#5a3d58', roughness: 0.7 });
  const thornTip = new THREE.MeshStandardMaterial({ color: '#efe1c6', roughness: 0.5 });
  const berry = new THREE.MeshStandardMaterial({ color: '#d63b5a', roughness: 0.3 });
  const thornLeaf = new THREE.MeshStandardMaterial({ color: '#3f6e35', roughness: 0.8 });
  const coneG = new THREE.ConeGeometry(0.05, 0.22, 5);
  for (const h of level.hazards) {
    const tips: THREE.Matrix4[] = [];
    const len = h.x1 - h.x0;
    const stems = Math.max(6, Math.round(len * 3.6));
    for (let i = 0; i < stems; i++) {
      const x = h.x0 + 0.15 + ((i + r() * 0.6) / stems) * (len - 0.3);
      const z = -1.6 + r() * 2.6;
      const top = h.y1 * (0.7 + r() * 0.5);
      const pts = [new THREE.Vector3(x, h.y0 - 0.1, z), new THREE.Vector3(x + (r() - 0.5) * 0.5, h.y0 + top * 0.5, z + (r() - 0.5) * 0.3), new THREE.Vector3(x + (r() - 0.5) * 0.8, h.y0 + top, z)];
      const curve = new THREE.CatmullRomCurve3(pts);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.075, 5), thornStem);
      for (let k = 0; k < 2; k++) {
        const lf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), thornLeaf);
        lf.scale.set(1, 0.3, 0.6);
        lf.position.copy(curve.getPoint(0.35 + k * 0.3));
        lf.rotation.set(r() * 3, r() * 3, r() * 3);
        root.add(lf);
      }
      stem.castShadow = true;
      root.add(stem);
      for (let k = 0; k < 7; k++) {
        const u = 0.2 + (k / 7) * 0.8;
        const p = curve.getPoint(u);
        const dir = new THREE.Vector3((r() - 0.5) * 2, r() * 1.2 - 0.2, (r() - 0.5) * 2).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        tips.push(new THREE.Matrix4().compose(p.add(dir.clone().multiplyScalar(0.1)), q, new THREE.Vector3(1, 1, 1)));
      }
      if (i % 3 === 0) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), berry);
        b.position.copy(curve.getPoint(0.9));
        root.add(b);
      }
    }
    const im = new THREE.InstancedMesh(coneG, thornTip, tips.length);
    tips.forEach((m, i) => im.setMatrixAt(i, m));
    root.add(im);
  }

  // decoration on the ground tops
  const grassM: THREE.Matrix4[] = [];
  const flowerA: THREE.Matrix4[] = [];
  const flowerB: THREE.Matrix4[] = [];
  const bushes: THREE.Matrix4[] = [];
  const rocks1: THREE.Matrix4[] = [];
  const rocks2: THREE.Matrix4[] = [];
  const pebbles: THREE.Matrix4[] = [];
  const plants: THREE.Matrix4[] = [];
  const shrooms: THREE.Matrix4[] = [];
  const mk = (x: number, y: number, z: number, s: number, ry = r() * Math.PI * 2) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));
  const busy = (x: number) =>
    level.boxes.some((b) => (b.kind === 'stump' || b.kind === 'log') && x > b.x0 - 0.6 && x < b.x1 + 0.6) ||
    level.hazards.some((h) => x > h.x0 - 0.3 && x < h.x1 + 0.3) ||
    level.signs.some((s) => Math.abs(s.x - x) < 1.4);
  for (const tp of tops) {
    for (let x = tp.x0 + 0.3; x < tp.x1 - 0.3; x += 0.35 + r() * 0.35) {
      // back row: tall grass and flowers; front row: short grass
      grassM.push(mk(x, tp.y, Z0 + 0.3 + r() * 1.1, 0.55 + r() * 0.4));
      if (r() < 0.45) grassM.push(mk(x + 0.1, tp.y, Z1 - 0.25 - r() * 0.3, 0.3 + r() * 0.15));
      if (busy(x)) continue;
      const k = r();
      if (k < 0.1) flowerA.push(mk(x, tp.y, Z0 + 0.5 + r() * 0.9, 0.6 + r() * 0.3));
      else if (k < 0.18) flowerB.push(mk(x, tp.y, Z0 + 0.5 + r() * 0.9, 0.6 + r() * 0.3));
      else if (k < 0.215) bushes.push(mk(x, tp.y, Z0 + 0.2, 0.55 + r() * 0.25));
      else if (k < 0.24) plants.push(mk(x, tp.y, Z0 + 0.6, 0.5 + r() * 0.3));
      else if (k < 0.255) rocks1.push(mk(x, tp.y - 0.05, Z0 + 0.5, 0.35 + r() * 0.2));
      else if (k < 0.27) shrooms.push(mk(x, tp.y, Z0 + 0.8 + r() * 0.6, 0.6 + r() * 0.3));
      else if (k < 0.33) pebbles.push(mk(x, tp.y - 0.02, Z1 - 0.4 - r() * 0.4, 0.5 + r() * 0.4));
    }
    // a rock at some cliff edges
    if (r() < 0.5) rocks2.push(mk(tp.x1 - 0.4, tp.y - 0.2, Z1 - 0.3, 0.45));
  }
  const fit = (name: string, h: number) => {
    const s = modelSize(name);
    return s.y > 0 ? h / s.y : 1;
  };
  const scaleAll = (mats: THREE.Matrix4[], k: number) => mats.map((m) => m.clone().multiply(new THREE.Matrix4().makeScale(k, k, k)));
  if (hasModel('Grass_Common_Tall')) root.add(instanced('Grass_Common_Tall', scaleAll(grassM, fit('Grass_Common_Tall', 0.75)), false));
  root.add(instanced('Flower_3_Group', scaleAll(flowerA, fit('Flower_3_Group', 0.7)), false));
  root.add(instanced('Flower_4_Group', scaleAll(flowerB, fit('Flower_4_Group', 0.7)), false));
  root.add(instanced('Bush_Common_Flowers', scaleAll(bushes, fit('Bush_Common_Flowers', 1.4))));
  root.add(instanced('Plant_1_Big', scaleAll(plants, fit('Plant_1_Big', 1.0))));
  root.add(instanced('Rock_Medium_1', scaleAll(rocks1, fit('Rock_Medium_1', 1.0))));
  root.add(instanced('Rock_Medium_2', scaleAll(rocks2, fit('Rock_Medium_2', 1.0))));
  root.add(instanced('Pebble_Round_1', scaleAll(pebbles, fit('Pebble_Round_1', 0.25)), false));
  root.add(instanced('Mushroom_Common', scaleAll(shrooms, fit('Mushroom_Common', 0.5)), false));

  // trees behind the trail, in two depths, and a few in the low meadow
  const near: THREE.Matrix4[] = [];
  const pines: THREE.Matrix4[] = [];
  const pines2: THREE.Matrix4[] = [];
  const meadowBush: THREE.Matrix4[] = [];
  for (let x = -20; x < level.goalX + 40; x += 5 + r() * 6) near.push(mk(x, -3.2, -6.5 - r() * 7, 7 + r() * 3));
  for (let x = -30; x < level.goalX + 60; x += 4 + r() * 5) (r() < 0.5 ? pines : pines2).push(mk(x, -3.2, -17 - r() * 10, 8 + r() * 5));
  for (let x = -20; x < level.goalX + 40; x += 2 + r() * 4) meadowBush.push(mk(x, -3.2, -4.5 - r() * 9, 1.4 + r() * 0.8));
  const fitTo = (mats: THREE.Matrix4[], name: string) => mats.map((m) => m.clone().multiply(new THREE.Matrix4().makeScale(fit(name, 1), fit(name, 1), fit(name, 1))));
  root.add(instanced('CommonTree_1', fitTo(near, 'CommonTree_1')));
  root.add(instanced('Pine_3', fitTo(pines, 'Pine_3'), false));
  root.add(instanced('Pine_5', fitTo(pines2, 'Pine_5'), false));
  root.add(instanced('Bush_Common_Flowers', fitTo(meadowBush, 'Bush_Common_Flowers'), false));

  // pickups
  const gemList = level.pickups.map((p, i) => ({ p, i })).filter((q) => q.p.kind === 'gem');
  const gems = new THREE.InstancedMesh(gemGeo, gemMat, Math.max(1, gemList.length));
  gems.castShadow = true;
  const gemIndex: number[] = new Array(level.pickups.length).fill(-1);
  gemList.forEach((q, k) => (gemIndex[q.i] = k));
  root.add(gems);
  const hidden = new Set<number>();
  const acorns = new Map<number, THREE.Group>();
  level.pickups.forEach((p, i) => {
    if (p.kind !== 'acorn') return;
    const a = acorn();
    a.position.set(p.x, p.y, 0);
    root.add(a);
    acorns.set(i, a);
  });

  const beetles = level.enemies.map(() => beetle());
  for (const b of beetles) root.add(b.root);

  for (const s of level.signs) {
    const g = sign(signText(s.key));
    g.position.set(s.x, s.y, -1.5);
    root.add(g);
  }
  const checkpoints = level.checkpoints.map((c) => {
    const v = checkpoint();
    v.root.position.set(c.x, c.y, -1.1);
    root.add(v.root);
    return v;
  });
  // planting spots at decision points: a little soil mound with a sparkle
  for (const dp of level.dps) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1 }));
    mound.scale.set(1.3, 0.25, 1);
    mound.position.set(dp.anchorX - 0.9, dp.y, 0.6);
    root.add(mound);
  }
  const goal = goalHouse();
  goal.position.set(level.goalX, level.goalY, 0);
  root.add(goal);

  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const pv = new THREE.Vector3();
  const cpOpen = checkpoints.map(() => 0);
  return {
    root,
    gems,
    gemIndex,
    acorns,
    beetles,
    checkpoints,
    goal,
    hidePickup(i) {
      hidden.add(i);
      const a = acorns.get(i);
      if (a) a.visible = false;
    },
    update(s, time, dt) {
      waterTime.value = time;
      gemList.forEach((g, k) => {
        const p = g.p;
        q.setFromEuler(new THREE.Euler(0, time * 2 + p.x, 0));
        pv.set(p.x, p.y + Math.sin(time * 3 + p.x) * 0.06, 0);
        tmp.compose(pv, q, s.got[g.i] || hidden.has(g.i) ? zero : one);
        gems.setMatrixAt(k, tmp);
      });
      gems.instanceMatrix.needsUpdate = true;
      for (const [i, a] of acorns) {
        if (s.got[i]) a.visible = false;
        a.rotation.y = time * 1.6;
        a.position.y = level.pickups[i].y + Math.sin(time * 2.4) * 0.1;
      }
      level.enemies.forEach((e, i) => {
        const b = beetles[i];
        if (s.enemyDead[i]) {
          b.root.scale.y = Math.max(0.001, b.root.scale.y - dt * 6);
          if (b.root.scale.y < 0.05) b.root.visible = false;
          return;
        }
        const x = enemyX(e, s.et);
        const x2 = enemyX(e, s.et + 1);
        b.root.position.set(x, e.y, 0);
        b.update(time, x2 >= x ? 1 : -1);
      });
      checkpoints.forEach((c, i) => {
        const target = s.cp >= i ? 1 : 0;
        cpOpen[i] += (target - cpOpen[i]) * Math.min(1, dt * 5);
        c.open(cpOpen[i]);
      });
    },
  };
}

export const waterTime = { value: 0 };

function stump(root: THREE.Group, b: Box, bark: THREE.Material, rings: THREE.Material) {
  const r = (b.x1 - b.x0) / 2;
  const h = b.y1 - b.y0;
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 16), bark);
  c.position.set((b.x0 + b.x1) / 2, b.y0 + h / 2, 0);
  c.castShadow = c.receiveShadow = true;
  root.add(c);
  const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 16), rings);
  top.rotation.x = -Math.PI / 2;
  top.position.set(c.position.x, b.y1 + 0.005, 0);
  root.add(top);
  // roots
  for (let i = 0; i < 4; i++) {
    const rt = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), bark);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    rt.position.set(c.position.x + Math.cos(a) * r, b.y0 + 0.08, Math.sin(a) * r);
    rt.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    root.add(rt);
  }
}

function log(root: THREE.Group, b: Box, bark: THREE.Material, rings: THREE.Material) {
  const len = b.x1 - b.x0 + 0.6;
  const rad = 0.5;
  const cx = (b.x0 + b.x1) / 2;
  const cy = b.y0 + rad;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 18, 1, true), bark);
  trunk.rotation.z = Math.PI / 2;
  trunk.position.set(cx, cy, 0);
  trunk.castShadow = trunk.receiveShadow = true;
  root.add(trunk);
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CircleGeometry(rad, 18), rings);
    end.rotation.y = (s * Math.PI) / 2;
    end.position.set(cx + (s * len) / 2, cy, 0);
    root.add(end);
    // boulders holding the log up
    const bould = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), new THREE.MeshStandardMaterial({ color: '#a39a8c', roughness: 0.95, flatShading: true }));
    bould.scale.set(1, 0.9, 1);
    bould.position.set(cx + s * (len / 2 - 0.3), b.y0 - 0.15, -1.5);
    bould.castShadow = true;
    root.add(bould);
  }
  // moss and a thick hedge on top (too high to jump over)
  const moss = new THREE.MeshStandardMaterial({ color: '#6dbb4a', roughness: 0.9 });
  const leaf = new THREE.MeshStandardMaterial({ color: '#4f9c3a', roughness: 0.9 });
  const leaf2 = new THREE.MeshStandardMaterial({ color: '#6cb84c', roughness: 0.9 });
  const n = Math.round(len * 1.6);
  for (let i = 0; i < n; i++) {
    const x = b.x0 - 0.2 + (i / (n - 1)) * (len - 0.2);
    const s = 0.55 + ((i * 7) % 5) * 0.08;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), i % 2 ? leaf : leaf2);
    blob.position.set(x, cy + rad + s * 0.7 + (i % 2) * 0.4, (i % 3) * 0.3 - 0.3);
    blob.castShadow = true;
    root.add(blob);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, len * 0.95, 18, 1, true, Math.PI * 0.6, Math.PI * 0.8), moss);
  top.rotation.z = Math.PI / 2;
  top.position.set(cx, cy, 0);
  root.add(top);
}
