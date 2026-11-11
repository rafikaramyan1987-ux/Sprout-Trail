/**
 * Phase C review screenshots (docs/phase-c/): every set piece and several scenery variants, from real play (the level
 * bot drives the game). usage: npx tsx scripts/phase-c-shots.ts [baseUrl]   (serve dist-web first)
 */
import { mkdirSync } from 'node:fs';
import { Driver } from './driver';
import { levelById } from '../src/game/levels';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = 'docs/phase-c';
mkdirSync(out, { recursive: true });

function cond(id: string, what: string) {
  const L = levelById(id)!;
  const zone = (k: string) => L.zones.find((q) => q.kind === k)!;
  const mover = (k: string) => L.movers.find((m) => m.kind === k)!;
  switch (what) {
    case 'start': return 'true';
    case 'rope': return 's.mode === "run" && window.__game.sim().rope >= 0';
    case 'logs': return `s.x > ${mover('log').x0 - 1}`;
    case 'lily': return `s.x > ${mover('lily').x0 + 2}`;
    case 'shroom': return `s.x > ${mover('shroom').x0 + 1}`;
    case 'planks': return `s.x > ${mover('plank').x0 + 3}`;
    default: return `s.x > ${zone(what).x0 + 6}`;
  }
}

const shots: [number, number, string, string, number, string][] = [
  [390, 844, '1-3', 'start', 0.6, 'phone-1-3-title-card'],
  [390, 844, '1-3', 'rope', 0.15, 'phone-1-3-rope-swings'],
  [390, 844, '1-7', 'chase', 0.8, 'phone-1-7-boar-chase'],
  [390, 844, '2-1', 'cave', 0.4, 'phone-2-1-dark-cave'],
  [1280, 720, '1-1', 'planks', 0.3, 'desktop-1-1-hanging-planks'],
  [1280, 720, '1-2', 'shroom', 0.3, 'desktop-1-2-bounce-mushrooms-rain'],
  [1280, 720, '1-4', 'logs', 0.3, 'desktop-1-4-floating-logs'],
  [1280, 720, '1-5', 'collapse', 0.6, 'desktop-1-5-collapsing-bridge'],
  [1280, 720, '1-6', 'glide', 0.6, 'desktop-1-6-dandelion-glide'],
  [1280, 720, '2-2', 'waterfall', 0.4, 'desktop-2-2-waterfall'],
  [1280, 720, '4-1', 'wind', 0.3, 'desktop-4-1-wind'],
  [1280, 720, '5-1', 'lily', 0.3, 'desktop-5-1-lily-pads-moonlit'],
];
let d: Driver | null = null;
let size = '';
for (const [w, h, id, what, after, file] of shots) {
  if (size !== `${w}x${h}`) {
    await d?.close();
    d = await Driver.open(base, w, h, 1);
    size = `${w}x${h}`;
  }
  await d!.startBot(id, false, 0.6);
  await d!.skipUntil(cond(id, what));
  await d!.play(after);
  await d!.shot(`${out}/${file}.png`);
}
await d?.close();
