/**
 * All levels: 5 worlds of 12 levels plus one special level each, and the daily challenge pool. World 1's first
 * three levels are hand-made (the Phase A tutorial); every other level is generated from the seed listed in
 * seeds.ts (each one is validated by the level bot in CI).
 */
import type { Level } from '../types';
import { WORLD1 } from './w1';
import { generateLevel } from './gen';
import { DAILY_SEEDS, LEVEL_SEEDS, SPECIAL_SEEDS } from './seeds';

export const WORLDS = 5;
export const PER_WORLD = 12;

const cache = new Map<string, Level>();
function memo(id: string, make: () => Level) {
  let l = cache.get(id);
  if (!l) cache.set(id, (l = make()));
  return l;
}

export function level(world: number, n: number): Level {
  if (world === 1 && n <= WORLD1.length) return WORLD1[n - 1];
  return memo(`${world}-${n}`, () => generateLevel(world, n, LEVEL_SEEDS[`${world}-${n}`] ?? 1));
}

export function specialLevel(world: number): Level {
  return memo(`${world}-S`, () => generateLevel(world, 12, SPECIAL_SEEDS[world - 1] ?? 1, { special: true }));
}

/** the daily challenge of a day (days since 2026-01-01) */
export function dailyLevel(day: number): Level {
  const i = ((day % DAILY_SEEDS.length) + DAILY_SEEDS.length) % DAILY_SEEDS.length;
  const world = (i % WORLDS) + 1;
  return memo(`daily-${i}`, () => generateLevel(world, 8, DAILY_SEEDS[i], { daily: true, id: `daily-${i}` }));
}

/** the main path in play order (specials and dailies are separate) */
export const LEVEL_IDS: string[] = [];
for (let w = 1; w <= WORLDS; w++) for (let n = 1; n <= PER_WORLD; n++) LEVEL_IDS.push(`${w}-${n}`);

export function levelById(id: string): Level | null {
  const m = /^(\d)-(\d+|S)$/.exec(id);
  if (m) return m[2] === 'S' ? specialLevel(+m[1]) : level(+m[1], +m[2]);
  const d = /^daily-(\d+)$/.exec(id);
  return d ? dailyLevel(+d[1]) : null;
}

export function nextLevel(id: string): Level | null {
  const i = LEVEL_IDS.indexOf(id);
  return i >= 0 && i + 1 < LEVEL_IDS.length ? levelById(LEVEL_IDS[i + 1]) : null;
}

/** every level that ships (for the validator) */
export function allLevels(): Level[] {
  const out = LEVEL_IDS.map((id) => levelById(id)!);
  for (let w = 1; w <= WORLDS; w++) out.push(specialLevel(w));
  for (let i = 0; i < DAILY_SEEDS.length; i++) out.push(dailyLevel(i));
  return out;
}
