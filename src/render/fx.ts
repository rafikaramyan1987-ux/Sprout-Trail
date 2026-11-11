/** Particle bursts: dust puffs, gem sparkles, leaf confetti, water splashes, growth magic. Pooled sprites. */
import * as THREE from 'three';
import { glowTexture } from './textures';

interface P {
  s: THREE.Sprite | THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  life: number;
  max: number;
  size: number;
  spin: number;
  fade: boolean;
}

const leafGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.12);
  s.quadraticCurveTo(0.09, 0, 0, 0.12);
  s.quadraticCurveTo(-0.09, 0, 0, -0.12);
  return new THREE.ShapeGeometry(s, 4);
})();

export class Fx {
  private ps: P[] = [];
  private seed = 1;
  constructor(readonly root: THREE.Group) {}

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private sprite(color: string, additive: boolean) {
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    return new THREE.Sprite(m);
  }

  private add(o: THREE.Sprite | THREE.Mesh, p: Omit<P, 's'>) {
    this.root.add(o);
    this.ps.push({ s: o, ...p });
  }

  dust(x: number, y: number, n = 8, power = 1) {
    for (let i = 0; i < n; i++) {
      const s = this.sprite('#f2e6c8', false);
      s.position.set(x + (this.rnd() - 0.5) * 0.5, y + 0.1, (this.rnd() - 0.5) * 0.6 + 0.3);
      const dir = this.rnd() < 0.5 ? -1 : 1;
      this.add(s, { vx: dir * (0.6 + this.rnd() * 1.6) * power, vy: 0.4 + this.rnd() * 0.8, vz: (this.rnd() - 0.5) * 0.5, g: -0.6, life: 0, max: 0.45 + this.rnd() * 0.3, size: 0.35 + this.rnd() * 0.3, spin: 0, fade: true });
    }
  }

  sparkle(x: number, y: number, color = '#9ff0ff', n = 10) {
    for (let i = 0; i < n; i++) {
      const s = this.sprite(color, true);
      s.position.set(x, y, 0.2);
      const a = this.rnd() * Math.PI * 2,
        v = 1.5 + this.rnd() * 2.5;
      this.add(s, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 0, g: 2, life: 0, max: 0.4 + this.rnd() * 0.3, size: 0.25 + this.rnd() * 0.2, spin: 0, fade: true });
    }
  }

  leaves(x: number, y: number, n = 14, colors = ['#7bd05a', '#5cb840', '#b8e986', '#ffd84a']) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
      m.position.set(x + (this.rnd() - 0.5) * 0.6, y + this.rnd() * 0.4, 0.4 + (this.rnd() - 0.5) * 0.8);
      const a = Math.PI * (0.15 + this.rnd() * 0.7),
        v = 2.5 + this.rnd() * 3.5;
      this.add(m, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (this.rnd() - 0.5) * 2, g: 6, life: 0, max: 1 + this.rnd() * 0.6, size: 1 + this.rnd() * 0.8, spin: (this.rnd() - 0.5) * 12, fade: true });
    }
  }

  splash(x: number, y: number) {
    for (let i = 0; i < 22; i++) {
      const s = this.sprite(i % 3 ? '#bfe8ff' : '#ffffff', false);
      s.position.set(x + (this.rnd() - 0.5) * 0.6, y, 0.3);
      const a = Math.PI * (0.25 + this.rnd() * 0.5),
        v = 3 + this.rnd() * 5;
      this.add(s, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (this.rnd() - 0.5) * 2, g: 16, life: 0, max: 0.8 + this.rnd() * 0.4, size: 0.18 + this.rnd() * 0.22, spin: 0, fade: true });
    }
  }

  magic(x: number, y: number, h: number) {
    for (let i = 0; i < 26; i++) {
      const s = this.sprite(['#fff6a8', '#b8ffb0', '#ffd0f0'][i % 3], true);
      s.position.set(x + (this.rnd() - 0.5) * 1.2, y + this.rnd() * h, 0.3 + (this.rnd() - 0.5));
      this.add(s, { vx: (this.rnd() - 0.5) * 0.8, vy: 0.8 + this.rnd() * 1.5, vz: 0, g: -0.5, life: -this.rnd() * 0.6, max: 0.9 + this.rnd() * 0.5, size: 0.2 + this.rnd() * 0.25, spin: 0, fade: true });
    }
  }

  update(dt: number) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      const o = p.s;
      if (p.life < 0) {
        o.visible = false;
        continue;
      }
      o.visible = true;
      p.vy -= p.g * dt;
      o.position.x += p.vx * dt;
      o.position.y += p.vy * dt;
      o.position.z += p.vz * dt;
      const k = p.life / p.max;
      if ((o as THREE.Sprite).isSprite) {
        const s = p.size * (0.6 + k * 0.8);
        o.scale.set(s, s, s);
        (o.material as THREE.SpriteMaterial).opacity = p.fade ? 1 - k : 1;
      } else {
        o.rotation.z += p.spin * dt;
        o.rotation.x += p.spin * 0.5 * dt;
        o.scale.setScalar(p.size);
        p.vx *= 1 - dt * 1.5;
        (o.material as THREE.MeshStandardMaterial).opacity = Math.min(1, (1 - k) * 2);
      }
      if (p.life >= p.max) {
        this.root.remove(o);
        (o.material as THREE.Material).dispose();
        this.ps.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.ps) {
      this.root.remove(p.s);
      (p.s.material as THREE.Material).dispose();
    }
    this.ps = [];
  }
}
