import * as THREE from 'three';

/**
 * Free the GPU memory of a scene that is no longer shown (a finished level). Without it every level (and every retry)
 * kept its geometries, materials and textures on the GPU: about 90 geometries per level (measured: 120 → 1,882 after
 * 21 levels), until a phone loses the WebGL context or kills the tab.
 *
 * Resources of the session-long caches (`userData.shared`: the model cache in assets.ts, textures.ts, the mist texture,
 * the waterfall material) are kept: the next level uses them again. Anything else three.js re-uploads by itself if it
 * is ever drawn again.
 */
export function disposeScene(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    // shadow-casting lights own a shadow-map render target (2048² for the moon light)
    if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
    const m = o as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
    else if (mat) mats.add(mat);
  });
  for (const g of geos) if (!g.userData?.shared) g.dispose();
  const texs = new Set<THREE.Texture>();
  for (const m of mats) {
    for (const v of Object.values(m as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) texs.add(v);
    const u = (m as THREE.ShaderMaterial).uniforms;
    if (u) for (const x of Object.values(u)) if (x && x.value instanceof THREE.Texture) texs.add(x.value);
    if (!m.userData?.shared) m.dispose();
  }
  for (const t of texs) if (!t.userData?.shared && !(t as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) t.dispose();
}

/**
 * After a WebGL context restore: forget the GPU objects of the lost context. three.js rebuilds its state on
 * restore, but the `dispose` listeners its old state put on every geometry, material, texture and render target
 * stay; disposing or resizing one of those later makes them delete objects of the lost context in the new one
 * (WebKit logs `INVALID_OPERATION: delete: object does not belong to this context` for each). Removing them is
 * safe: the new state adds its own listener the next time an object is drawn, and the lost context already freed
 * the memory. `roots`: the scenes and the post-processing composer.
 */
export function forgetLostContext(roots: object[]) {
  const seen = new Set<object>();
  const forget = (o: unknown) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    const d = o as { _listeners?: Record<string, unknown[]> };
    if (d._listeners?.dispose) delete d._listeners.dispose;
  };
  const gpu = (v: unknown) => v instanceof THREE.BufferGeometry || v instanceof THREE.Material || v instanceof THREE.Texture || v instanceof THREE.RenderTarget;
  // GPU objects reachable from `o` through its own fields (render targets, their textures, uniforms, full-screen quads)
  const walk = (o: unknown, depth: number) => {
    if (!o || typeof o !== 'object' || depth < 0 || o instanceof THREE.WebGLRenderer) return;
    if (o instanceof THREE.Object3D) return void scan(o);
    if (gpu(o)) {
      if (seen.has(o as object)) return;
      forget(o);
    }
    if (Array.isArray(o)) return void o.forEach((x) => walk(x, depth - 1));
    if (o instanceof THREE.Texture) return;
    for (const v of Object.values(o as Record<string, unknown>)) if (v && typeof v === 'object' && !(v instanceof Node)) walk(v, depth - 1);
  };
  const scan = (root: THREE.Object3D) =>
    root.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.geometry) forget(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
        forget(mat);
        walk(mat, 2);
      }
      const shadow = (x as THREE.DirectionalLight).shadow;
      if (shadow?.map) walk(shadow.map, 2);
    });
  for (const r of roots) walk(r, 4);
}
