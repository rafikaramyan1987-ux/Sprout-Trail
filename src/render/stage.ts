/**
 * The renderer, camera and the world around the trail: sky gradient with a soft sun, layered parallax hills,
 * drifting clouds, light rays, pollen, soft sunlight with shadows following the camera.
 */
import * as THREE from 'three';
import { windTime } from './assets';
import { glowTexture, rayTexture } from './textures';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  fog: string;
  hills: string[];
  sun: string;
  ambientSky: string;
  ambientGround: string;
}

export const SPRING: Theme = {
  skyTop: '#6db9ec',
  skyBottom: '#fdf3d0',
  fog: '#dff0e4',
  hills: ['#8fcf72', '#a7d68e', '#b9dbc0', '#cfe3e6'],
  sun: '#fff1c9',
  ambientSky: '#dff3ff',
  ambientGround: '#6f8f4a',
};

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  readonly sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  /** things that follow the camera horizontally at a fraction of its speed (parallax) */
  private far: { o: THREE.Object3D; k: number; x: number }[] = [];
  private clouds: THREE.Group[] = [];
  private rays: THREE.Mesh[] = [];
  private pollen: THREE.Points;
  /** world objects of the current level */
  readonly world = new THREE.Group();
  readonly fx = new THREE.Group();
  width = 1;
  height = 1;
  time = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.world, this.fx);

    this.hemi = new THREE.HemisphereLight('#dff3ff', '#6f8f4a', 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1c9', 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -26;
    sc.right = 26;
    sc.top = 14;
    sc.bottom = -10;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    // sky dome (a big plane far behind, gradient + sun glow)
    this.skyMat = new THREE.ShaderMaterial({
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunPos: { value: new THREE.Vector2(0.72, 0.62) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sun; uniform vec2 sunPos; varying vec2 vUv;
        void main(){
          float k = smoothstep(0.42, 0.62, vUv.y);
          vec3 c = mix(bottom, top, k);
          vec2 d = (vUv - sunPos) * vec2(2.2, 1.0);
          float g = exp(-dot(d,d) * 18.0);
          c += sun * g * 0.55 + sun * exp(-dot(d,d) * 400.0) * 0.6;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(900, 360), this.skyMat);
    this.sky.position.set(0, 60, -200);
    this.scene.add(this.sky);

    const pg = new THREE.BufferGeometry();
    const n = 90;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = ((i * 53) % 100) / 100 * 60 - 30;
      pos[i * 3 + 1] = ((i * 29) % 100) / 100 * 14 - 2;
      pos[i * 3 + 2] = ((i * 71) % 100) / 100 * 10 - 6;
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pollen = new THREE.Points(
      pg,
      new THREE.PointsMaterial({ map: glowTexture(), size: 0.22, color: '#fff7c2', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.scene.add(this.pollen);
  }

  /** set the sky, light and background layers for a world */
  setTheme(th: Theme) {
    (this.skyMat.uniforms.top.value as THREE.Color).set(th.skyTop);
    (this.skyMat.uniforms.bottom.value as THREE.Color).set(th.skyBottom);
    (this.skyMat.uniforms.sun.value as THREE.Color).set(th.sun);
    this.scene.fog = new THREE.Fog(th.fog, 45, 230);
    this.hemi.color.set(th.ambientSky);
    this.hemi.groundColor.set(th.ambientGround);
    this.sun.color.set(th.sun);
    for (const f of this.far) this.scene.remove(f.o);
    for (const c of this.clouds) this.scene.remove(c);
    for (const r of this.rays) this.scene.remove(r);
    this.far = [];
    this.clouds = [];
    this.rays = [];
    // rolling hill layers: farther layers move slower
    const layers = [
      { z: -26, y: -3, amp: 3.2, freq: 0.09, color: th.hills[0], k: 0.25 },
      { z: -48, y: -1, amp: 5, freq: 0.05, color: th.hills[1], k: 0.45 },
      { z: -85, y: 1, amp: 9, freq: 0.03, color: th.hills[2], k: 0.65 },
      { z: -140, y: 4, amp: 16, freq: 0.018, color: th.hills[3], k: 0.8 },
    ];
    layers.forEach((L, li) => {
      const shape = new THREE.Shape();
      const w = 600;
      shape.moveTo(-w / 2, -40);
      for (let x = -w / 2; x <= w / 2; x += 2) {
        const y = L.amp * (0.6 * Math.sin(x * L.freq + li * 1.7) + 0.4 * Math.sin(x * L.freq * 2.3 + li)) + L.amp;
        shape.lineTo(x, y);
      }
      shape.lineTo(w / 2, -40);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), new THREE.MeshLambertMaterial({ color: L.color }));
      mesh.position.set(0, L.y, L.z);
      this.scene.add(mesh);
      this.far.push({ o: mesh, k: L.k, x: 0 });
    });
    // clouds
    const cm = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45 });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 5; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cm);
        s.scale.set(2.2 - Math.abs(j - 2) * 0.4, 1.4 - Math.abs(j - 2) * 0.25, 1.2);
        s.position.set((j - 2) * 1.7, Math.abs(j - 2) * -0.25, 0);
        c.add(s);
      }
      c.scale.setScalar(1.6 + (i % 3) * 0.5);
      c.position.set(-120 + i * 32, 22 + (i % 3) * 6, -95 - (i % 2) * 20);
      this.scene.add(c);
      this.clouds.push(c);
      this.far.push({ o: c, k: 0.7, x: c.position.x });
    }
    // light rays slanting from the upper right
    const rm = new THREE.MeshBasicMaterial({ map: rayTexture(), color: '#fff3c4', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(3 + (i % 2) * 2, 30), rm.clone());
      r.rotation.z = 0.42;
      r.position.set(i * 9 - 18, 6, -9 - (i % 3) * 3);
      this.scene.add(r);
      this.rays.push(r);
      this.far.push({ o: r, k: 0.15, x: r.position.x });
    }
  }

  resize(w: number, h: number, dpr: number) {
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Place the camera so that the point (x, y) is at the screen position (sx, sy) in 0..1 units, showing `viewW`
   * world units across (or `viewH` up, whichever is larger on this screen).
   */
  frame(x: number, y: number, viewW: number, viewH: number, sx = 0.5, sy = 0.5) {
    const cam = this.camera;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const hNeeded = Math.max(viewH, viewW / cam.aspect);
    const dist = hNeeded / 2 / tan;
    const visW = hNeeded * cam.aspect;
    const cx = x + (0.5 - sx) * visW;
    const cy = y + (0.5 - sy) * hNeeded;
    cam.position.set(cx, cy + dist * 0.06, dist);
    cam.lookAt(cx, cy, 0);
    return dist;
  }

  update(dt: number) {
    this.time += dt;
    windTime.value = this.time;
    const cx = this.camera.position.x;
    for (const f of this.far) f.o.position.x = f.x + cx * f.k;
    this.sky.position.x = cx;
    this.clouds.forEach((c, i) => {
      const f = this.far.find((q) => q.o === c);
      if (f) f.x += dt * (0.4 + (i % 3) * 0.15);
    });
    this.rays.forEach((r, i) => (((r.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.08 * Math.sin(this.time * 0.6 + i * 1.7))));
    // pollen drifts around the camera
    const p = this.pollen.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + dt * (0.3 + (i % 5) * 0.05);
      const y = p.getY(i) + Math.sin(this.time * 0.8 + i) * dt * 0.15;
      if (x - cx > 30) x -= 60;
      if (x - cx < -30) x += 60;
      p.setXY(i, x, y);
    }
    p.needsUpdate = true;
    this.pollen.position.y = this.camera.position.y - 6;
    // shadows follow the camera
    const tx = this.camera.position.x,
      ty = this.camera.position.y - 2;
    this.sun.position.set(tx + 10, ty + 22, 18);
    this.sun.target.position.set(tx, ty - 2, 0);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
