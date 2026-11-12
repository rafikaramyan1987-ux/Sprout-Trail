/** Procedural canvas textures (no image downloads): soil, bark, soft glow, light ray, sign board. */
import * as THREE from 'three';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    cache.set(key, (t = make()));
    // kept for the whole session: a finished level's scene disposal leaves it alone (render/dispose.ts)
    t.userData.shared = true;
  }
  return t;
}

/** warm soil with layered bands, pebbles and roots; tiles every 4 world units */
export function soilTexture(base = '#9a6a43', dark = '#6f4a2e', light = '#b98457') {
  return cached(`soil${base}`, () => {
    const [c, g] = canvas(256, 256);
    const r = rng(7);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    // soft horizontal strata
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? dark : light;
      g.globalAlpha = 0.18;
      const y = i * 30 + r() * 10;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x / 40 + i) * 5);
      g.lineTo(256, y + 14);
      for (let x = 256; x >= 0; x -= 32) g.lineTo(x, y + 14 + Math.sin(x / 30 + i * 2) * 4);
      g.fill();
    }
    g.globalAlpha = 1;
    // pebbles (drawn wrapped so the texture tiles)
    for (let i = 0; i < 70; i++) {
      const x = r() * 256,
        y = r() * 256,
        rx = 2 + r() * 6,
        ry = rx * (0.6 + r() * 0.3);
      g.fillStyle = r() < 0.5 ? dark : light;
      g.globalAlpha = 0.55;
      for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
        g.beginPath();
        g.ellipse(x + dx, y + dy, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // little roots near the top
    g.strokeStyle = '#5a3a22';
    g.lineCap = 'round';
    g.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      g.lineWidth = 1.5 + r() * 2;
      g.beginPath();
      let x = r() * 256,
        y = r() * 40;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 30;
        y += 8 + r() * 12;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    return tex(c);
  });
}

/** bark: vertical grooves */
export function barkTexture(base = '#7b5236') {
  return cached(`bark${base}`, () => {
    const [c, g] = canvas(128, 256);
    const r = rng(3);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = r() < 0.5 ? 'rgba(60,35,20,0.55)' : 'rgba(170,120,80,0.35)';
      g.lineWidth = 2 + r() * 4;
      g.beginPath();
      let x = r() * 128;
      g.moveTo(x, -10);
      for (let y = 0; y <= 266; y += 24) {
        x += (r() - 0.5) * 8;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return tex(c);
  });
}

/** tree rings for cut log ends and stump tops */
export function ringsTexture() {
  return cached('rings', () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#d9a86c';
    g.fillRect(0, 0, 128, 128);
    for (let i = 10; i > 0; i--) {
      g.strokeStyle = i % 2 ? 'rgba(150,95,50,0.6)' : 'rgba(190,130,75,0.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(64 + Math.sin(i) * 2, 64, i * 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#7b5236';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.stroke();
    return tex(c, false);
  });
}

/** soft round glow (particles, halos) */
export function glowTexture() {
  return cached('glow', () => {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return tex(c, false);
  });
}

/** a god ray: bright at the top, fading down and to the sides */
export function rayTexture() {
  return cached('ray', () => {
    const [c, g] = canvas(64, 256);
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(255,248,220,0.9)');
    v.addColorStop(1, 'rgba(255,248,220,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-in';
    const h = g.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.5, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h;
    g.fillRect(0, 0, 64, 256);
    return tex(c, false);
  });
}

/** a wooden sign board with one short line of text */
export function signTexture(text: string) {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#b07a48';
  g.beginPath();
  g.roundRect(8, 8, 496, 240, 36);
  g.fill();
  g.strokeStyle = '#7a4d2a';
  g.lineWidth = 10;
  g.stroke();
  g.globalAlpha = 0.18;
  g.strokeStyle = '#5a3a20';
  g.lineWidth = 3;
  for (let y = 40; y < 240; y += 38) {
    g.beginPath();
    g.moveTo(30, y);
    g.bezierCurveTo(180, y + 8, 330, y - 8, 482, y + 3);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#fff7e6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 72;
  const font = (s: number) => `700 ${s}px Fredoka, Nunito, "Trebuchet MS", sans-serif`;
  g.font = font(size);
  const words = text.split(' ');
  // wrap to at most 2 lines, shrinking to fit
  let lines: string[] = [text];
  for (; size > 30; size -= 4) {
    g.font = font(size);
    if (g.measureText(text).width <= 440) {
      lines = [text];
      break;
    }
    let best: string[] | null = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '),
        b = words.slice(i).join(' ');
      if (g.measureText(a).width <= 440 && g.measureText(b).width <= 440 && size <= 62) best = [a, b];
    }
    if (best) {
      lines = best;
      break;
    }
  }
  g.shadowColor = 'rgba(70,40,15,0.7)';
  g.shadowOffsetY = 4;
  const lh = size * 1.1;
  lines.forEach((l, i) => g.fillText(l, 256, 128 + (i - (lines.length - 1) / 2) * lh));
  const t = tex(c, false);
  return t;
}
