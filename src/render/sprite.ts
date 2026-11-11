/**
 * The forest sprite: a round little sprout with big eyes, rosy cheeks and two leaves on its head, modelled from
 * primitives and animated procedurally (run cycle, jump stretch, landing squash, duck, climb, hurt, dizzy).
 */
import * as THREE from 'three';

export interface SpritePose {
  /** run cycle phase (radians), advances with distance */
  phase: number;
  speed: number;
  vy: number;
  grounded: boolean;
  ducking: boolean;
  climbing: boolean;
  /** 0..1 landing squash, decays */
  squash: number;
  hurt: boolean;
  dizzy: boolean;
  /** standing still (decision point) */
  idle: boolean;
  /** happy hop (win) */
  cheer: boolean;
  t: number;
}

function leafShape(len: number, wid: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid, len * 0.25, wid * 0.9, len * 0.75, 0, len);
  s.bezierCurveTo(-wid * 0.9, len * 0.75, -wid, len * 0.25, 0, 0);
  return new THREE.ShapeGeometry(s, 10);
}

export class Sprite {
  readonly root = new THREE.Group();
  /** the part that squashes and leans */
  private body = new THREE.Group();
  private head = new THREE.Group();
  private sprout = new THREE.Group();
  private leafL: THREE.Mesh;
  private leafR: THREE.Mesh;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private footL: THREE.Mesh;
  private footR: THREE.Mesh;
  private eyes: THREE.Group[] = [];
  private stars = new THREE.Group();
  private skin: THREE.MeshStandardMaterial;
  private blinkAt = 2;
  readonly shadow: THREE.Mesh;

  constructor(color = '#9fd66b') {
    this.skin = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
    const belly = new THREE.MeshStandardMaterial({ color: '#f4efcf', roughness: 0.75 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 0.3 });
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const cheek = new THREE.MeshBasicMaterial({ color: '#ff9e9e', transparent: true, opacity: 0.75 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#5cbf3f', roughness: 0.6, side: THREE.DoubleSide });
    const bootMat = new THREE.MeshStandardMaterial({ color: '#8b5a35', roughness: 0.8 });

    this.root.add(this.body);
    // the sprite faces 3/4 towards the camera while running right
    this.body.rotation.y = 0.75;

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), this.skin);
    torso.scale.set(1, 1.04, 0.96);
    torso.position.y = 0.56;
    torso.castShadow = true;
    this.body.add(torso);
    const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), belly);
    tummy.scale.set(0.95, 0.95, 0.5);
    tummy.position.set(0, 0.46, 0.28);
    this.body.add(tummy);

    // face
    this.head.position.set(0, 0.62, 0);
    this.body.add(this.head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.15, 0.06, 0.38);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), dark);
      ball.scale.set(0.9, 1.15, 0.6);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), white);
      glint.position.set(0.025, 0.04, 0.045);
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), white);
      glint2.position.set(-0.02, -0.03, 0.05);
      eye.add(ball, glint, glint2);
      this.head.add(eye);
      this.eyes.push(eye);
      const ch = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), cheek);
      ch.position.set(side * 0.26, -0.08, 0.36);
      ch.rotation.y = side * 0.55;
      this.head.add(ch);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), dark);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.08, 0.42);
    this.head.add(mouth);

    // sprout on the head
    this.sprout.position.set(0, 0.98, -0.02);
    this.body.add(this.sprout);
    const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.02, 0.1, 0), new THREE.Vector3(-0.02, 0.2, 0)]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 8, 0.025, 6), leafMat);
    this.sprout.add(stem);
    this.leafL = new THREE.Mesh(leafShape(0.32, 0.13), leafMat);
    this.leafL.position.set(-0.02, 0.19, 0);
    this.leafL.rotation.z = 0.95;
    this.leafR = new THREE.Mesh(leafShape(0.27, 0.11), leafMat);
    this.leafR.position.set(-0.02, 0.19, 0);
    this.leafR.rotation.z = -0.85;
    this.leafL.castShadow = this.leafR.castShadow = true;
    this.sprout.add(this.leafL, this.leafR);

    // arms
    const mkArm = (side: number) => {
      const g = new THREE.Group();
      g.position.set(side * 0.4, 0.55, 0.02);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.16, 4, 8), this.skin);
      a.position.y = -0.11;
      a.castShadow = true;
      g.add(a);
      this.body.add(g);
      return g;
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);
    // feet
    const mkFoot = (side: number) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), bootMat);
      f.scale.set(1, 0.7, 1.35);
      f.position.set(side * 0.17, 0.08, 0.04);
      f.castShadow = true;
      this.body.add(f);
      return f;
    };
    this.footL = mkFoot(-1);
    this.footR = mkFoot(1);

    // dizzy stars
    const starMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), starMat);
      this.stars.add(s);
    }
    this.stars.position.y = 1.25;
    this.stars.visible = false;
    this.root.add(this.stars);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      new THREE.MeshBasicMaterial({ color: '#203010', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
  }

  setColor(c: string) {
    this.skin.color.set(c);
  }

  update(p: SpritePose) {
    const t = p.t;
    const run = p.grounded && !p.idle && !p.climbing;
    const sw = Math.sin(p.phase);
    // squash and stretch
    let sy = 1,
      sxz = 1;
    if (p.ducking) {
      sy = 0.55;
      sxz = 1.3;
    } else if (!p.grounded && !p.climbing) {
      const k = THREE.MathUtils.clamp(p.vy / 12, -1, 1);
      sy = 1 + 0.16 * k;
      sxz = 1 - 0.09 * k;
    }
    sy -= p.squash * 0.28;
    sxz += p.squash * 0.2;
    this.body.scale.set(sxz, sy, sxz);
    this.body.position.y = run && !p.ducking ? Math.abs(sw) * 0.07 : p.idle ? Math.sin(t * 3) * 0.012 : 0;
    if (p.cheer) this.body.position.y = Math.abs(Math.sin(t * 7)) * 0.35;
    this.body.rotation.z = run ? -0.12 - Math.min(0.1, p.speed * 0.01) : !p.grounded && !p.climbing ? -0.05 : 0;
    this.body.rotation.x = 0;

    // limbs
    if (p.climbing) {
      const c = Math.sin(t * 12);
      this.armL.rotation.set(0, 0, 2.6 + c * 0.35);
      this.armR.rotation.set(0, 0, -2.6 + c * 0.35);
      this.footL.position.set(-0.17, 0.08 + Math.max(0, c) * 0.12, 0.04);
      this.footR.position.set(0.17, 0.08 + Math.max(0, -c) * 0.12, 0.04);
      this.body.rotation.y = 0.75 - 0.9;
    } else {
      this.body.rotation.y = p.idle ? 0.55 + Math.sin(t * 0.7) * 0.1 : 0.75;
      if (run) {
        this.armL.rotation.set(sw * 0.9, 0, 0.25);
        this.armR.rotation.set(-sw * 0.9, 0, -0.25);
        this.footL.position.set(-0.17, 0.08 + Math.max(0, sw) * 0.14, 0.04 + sw * 0.16);
        this.footR.position.set(0.17, 0.08 + Math.max(0, -sw) * 0.14, 0.04 - sw * 0.16);
      } else if (!p.grounded) {
        const up = p.vy > 0 ? 1 : 0.4;
        this.armL.rotation.set(0, 0, 0.6 + 1.6 * up);
        this.armR.rotation.set(0, 0, -0.6 - 1.6 * up);
        this.footL.position.set(-0.17, 0.16, 0.08);
        this.footR.position.set(0.17, 0.12, -0.06);
      } else {
        const wave = p.cheer ? Math.sin(t * 14) * 0.4 : 0;
        this.armL.rotation.set(0, 0, p.cheer ? 2.6 + wave : 0.2 + Math.sin(t * 2) * 0.05);
        this.armR.rotation.set(0, 0, p.cheer ? -2.6 - wave : -0.2 - Math.sin(t * 2) * 0.05);
        this.footL.position.set(-0.17, 0.08, 0.04);
        this.footR.position.set(0.17, 0.08, 0.04);
      }
    }
    // the leaves flutter with speed
    const flutter = Math.sin(t * 9) * (run ? 0.12 : 0.05) + (p.grounded ? 0 : -p.vy * 0.025);
    this.leafL.rotation.z = 0.95 + flutter;
    this.leafR.rotation.z = -0.85 + flutter * 0.8;
    this.sprout.rotation.z = run ? 0.25 : 0.05 * Math.sin(t * 1.5);

    // blink
    if (t > this.blinkAt) {
      const k = t - this.blinkAt;
      const s = k < 0.12 ? 0.1 : 1;
      for (const e of this.eyes) e.scale.y = s;
      if (k > 0.12) this.blinkAt = t + 2 + ((t * 7.7) % 2.5);
    }
    for (const e of this.eyes) e.position.y = p.dizzy ? 0.06 + Math.sin(t * 10) * 0.01 : 0.06;

    // hurt flash
    this.skin.emissive.set(p.hurt && Math.floor(t * 12) % 2 === 0 ? '#ff5a3c' : '#000000');
    this.skin.emissiveIntensity = 0.6;

    this.stars.visible = p.dizzy;
    if (p.dizzy)
      this.stars.children.forEach((s, i) => {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.35, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.35);
        s.rotation.y = t * 6;
      });
  }
}
