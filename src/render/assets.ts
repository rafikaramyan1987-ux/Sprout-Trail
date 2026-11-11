/**
 * The CC0 nature models (public/models/nature.glb, built by scripts/assets.mjs from assets-src/). Each root node
 * is named after its model. Foliage materials get a gentle wind sway in the vertex shader.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const windTime = { value: 0 };
const models = new Map<string, THREE.Object3D>();

/** sway vertices by their height above the model origin (foliage) */
export function addWind(mat: THREE.Material, amp = 0.08, freq = 1.6) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp0 = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          wp0 = instanceMatrix * wp0;
          #endif
          wp0 = modelMatrix * wp0;
          float h = max(0.0, position.y);
          float s = sin(uWind * ${freq.toFixed(2)} + wp0.x * 0.45 + wp0.z * 0.3) + 0.4 * sin(uWind * ${(freq * 2.3).toFixed(2)} + wp0.x * 1.3);
          transformed.x += s * ${amp.toFixed(3)} * h;
          transformed.z += s * ${(amp * 0.4).toFixed(3)} * h;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `wind${amp}${freq}`;
}

const FOLIAGE = /Leaves|Grass|Flowers|Leaf/i;

export async function loadModels(url: string) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const done = new Set<THREE.Material>();
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (done.has(mat)) continue;
        done.add(mat);
        const sm = mat as THREE.MeshStandardMaterial;
        sm.metalness = 0;
        sm.roughness = 0.9;
        if (/Leaves/i.test(mat.name)) sm.color.setScalar(1.35);
        if (FOLIAGE.test(mat.name)) {
          sm.alphaTest = 0.5;
          sm.side = THREE.DoubleSide;
          addWind(mat, /Grass/i.test(mat.name) ? 0.14 : 0.05);
        }
      }
    }
  });
  for (const c of gltf.scene.children) models.set(c.name, c);
}

export function hasModel(name: string) {
  return models.has(name);
}

export function model(name: string): THREE.Object3D {
  const m = models.get(name);
  if (!m) return new THREE.Group();
  return m.clone(true);
}

/** measure a model's bounds (for scaling to a target height) */
export function modelSize(name: string) {
  const m = models.get(name);
  const box = new THREE.Box3();
  if (m) box.setFromObject(m);
  return box.getSize(new THREE.Vector3());
}

/**
 * Many copies of one model as InstancedMeshes (one per mesh in the model). `mats` are world matrices.
 * Returns a group to add to the scene.
 */
export function instanced(name: string, mats: THREE.Matrix4[], shadows = true): THREE.Group {
  const g = new THREE.Group();
  const src = models.get(name);
  if (!src || !mats.length) return g;
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const im = new THREE.InstancedMesh(m.geometry, m.material, mats.length);
    const tmp = new THREE.Matrix4();
    mats.forEach((w, i) => im.setMatrixAt(i, tmp.multiplyMatrices(w, local)));
    im.castShadow = shadows;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  });
  return g;
}
