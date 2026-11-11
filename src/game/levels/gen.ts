/**
 * Level generator: builds a level of a world from a seed, following the difficulty curve.
 * - Levels 1-3 of each world teach one new thing each (a wooden sign introduces it) and stay gentle: few hazards,
 *   wide spacing, a slow speed ramp (+2 % per checkpoint).
 * - Levels 4-12 combine everything the world has unlocked: more hazards, tighter spacing (down to ~0.8 s between
 *   hazards), 2-4 decision points, +5 % speed at each checkpoint. Each world starts a little faster.
 * - The speed never goes above 1.5x level 1 (physics.MAX_SPEED); decision points are always a full stop.
 * Every generated level is played by the level bot in CI (scripts/validate-levels.ts); the seed table
 * (levels/seeds.ts) only lists seeds that pass.
 */
import { LevelBuilder } from '../build';
import { MAX_SPEED, RUN } from '../physics';
import type { HandHint, Level, PlantKind } from '../types';

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

type Hz = 'stump' | 'gap' | 'stream' | 'lowLog' | 'thorns' | 'beetle' | 'snail' | 'beeHigh' | 'beeLow' | 'roller' | 'step' | 'beetles';
type Recipe = 'river' | 'gap' | 'wall' | 'thorns' | 'cliff' | 'riverAcorn' | 'lowWallAcorn' | 'wideRiver' | 'shortThorns' | 'shortThornsAcorn' | 'cliffTree';

/** what each world adds (hazards, decision point recipes) */
const WORLD_HAZARDS: Hz[][] = [
  ['stump', 'gap', 'stream', 'lowLog', 'thorns', 'beetle', 'step'],
  ['beeHigh', 'beeLow'],
  ['snail', 'beetles'],
  ['roller'],
  [],
];
const WORLD_RECIPES: Recipe[][] = [
  ['river', 'wall', 'thorns', 'gap'],
  ['cliff', 'riverAcorn', 'lowWallAcorn'],
  ['wideRiver', 'cliffTree'],
  ['shortThorns', 'shortThornsAcorn'],
  [],
];
const unlocked = <T,>(table: T[][], world: number) => table.slice(0, world).flat();

/** the teaching level of a world introduces this (sign key + what it unlocks first) */
const TEACH: Record<number, { sign: string; hand?: HandHint; hazard?: Hz; recipe?: Recipe }[]> = {
  2: [{ sign: 'tut.bee', hazard: 'beeHigh' }, { sign: 'tut.leaf', recipe: 'cliff' }, { sign: 'tut.acornChoice', recipe: 'riverAcorn' }],
  3: [{ sign: 'tut.snail', hazard: 'snail' }, { sign: 'tut.tree', recipe: 'wideRiver' }, { sign: 'tut.tree', recipe: 'cliffTree' }],
  4: [{ sign: 'tut.roll', hazard: 'roller' }, { sign: 'tut.log', recipe: 'shortThorns' }, { sign: 'tut.acornChoice', recipe: 'shortThornsAcorn' }],
  5: [{ sign: 'tut.double', recipe: 'wall' }, { sign: 'tut.fog', hazard: 'beeLow' }, { sign: 'tut.double', recipe: 'riverAcorn' }],
};

/** seconds of play of a level (about 50 s early, up to ~105 s at the end of the game) */
export function targetSeconds(world: number, n: number, special = false) {
  return Math.min(78, 42 + (world - 1) * 5 + (n - 1) * 1.8 + (special ? 4 : 0));
}

export function levelSpeed(world: number, n: number) {
  return Math.min(MAX_SPEED * 0.92, RUN * (1 + 0.05 * (world - 1) + 0.006 * (n - 1)));
}

export interface GenOpts {
  special?: boolean;
  daily?: boolean;
  id?: string;
}

export function generateLevel(world: number, n: number, seed: number, opts: GenOpts = {}): Level {
  const r = rng(seed * 977 + world * 131 + n * 17);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const teach = !opts.special && !opts.daily && n <= 3;
  const lesson = teach ? TEACH[world]?.[n - 1] : undefined;
  // 0..1 within the world, and overall
  const dw = opts.special ? 1 : opts.daily ? 0.7 : teach ? 0.05 * n : (n - 3) / 9;
  const d = Math.min(1, dw * 0.75 + ((world - 1) / 4) * 0.35);
  const ramp = teach ? 0.02 : 0.05;
  let v = levelSpeed(world, opts.daily ? 8 : n);
  const nDps = opts.special ? 4 : teach ? (lesson?.recipe ? 2 : 1) : 2 + (d > 0.45 ? 1 : 0) + (d > 0.8 ? 1 : 0);
  const recipes = unlocked(WORLD_RECIPES, world);
  const hazards = unlocked(WORLD_HAZARDS, world);
  const newRecipes = WORLD_RECIPES[world - 1];
  const newHazards = WORLD_HAZARDS[world - 1];

  // decision point recipes: the lesson's first, then new ones of this world more often
  const dpList: Recipe[] = [];
  for (let i = 0; i < nDps; i++) {
    if (i === 0 && lesson?.recipe) dpList.push(lesson.recipe);
    else {
      let rec = newRecipes.length && r() < 0.5 ? pick(newRecipes) : pick(recipes);
      if (rec === dpList[i - 1]) rec = pick(recipes);
      dpList.push(rec);
    }
  }
  // at most two golden acorns come from plant choices
  let seen = 0;
  for (let i = 0; i < dpList.length; i++) if (dpList[i].endsWith('Acorn') && ++seen > 2) dpList[i] = 'gap';
  let acornsLeft = 3 - Math.min(2, seen);
  const twoInARow = world >= 5 && !teach ? 0.6 : lesson?.sign === 'tut.double' ? 1 : 0;
  const seeds = nDps + (world === 1 ? 2 : 1);

  const id = opts.id ?? (opts.special ? `${world}-S` : `${world}-${n}`);
  const b = new LevelBuilder(id, world, n, seeds, seed, v, ramp);
  if (opts.special) b.level.special = true;
  if (opts.daily) b.level.daily = true;

  const total = targetSeconds(world, n, opts.special);
  const sections = nDps + 1;
  const secTime = total / sections;
  const water = world === 5 || r() < 0.4;
  // hazard spacing in seconds: wide while teaching, tight late in the world
  const spacing = () => (teach ? 1.7 + r() * 0.5 : Math.max(0.75, 1.35 - d * 0.7 + r() * 0.35));
  const space = (sec: number) => {
    const len = Math.max(2.5, sec * v);
    if (r() < 0.55 && len > 4) b.gems(Math.min(6, Math.floor(len / 1.2)), 0.6, 0.7, 1.1);
    b.ground(len);
  };
  const pool: Hz[] = teach ? ([...(lesson?.hazard ? [lesson.hazard, lesson.hazard] : []), 'stump', 'gap', 'lowLog', 'beetle'] as Hz[]).filter((h) => hazards.includes(h)) : hazards;
  const weighted = (): Hz => {
    if (lesson?.hazard && r() < 0.45) return lesson.hazard;
    if (!teach && newHazards.length && r() < 0.3) return pick(newHazards);
    return pick(pool);
  };
  let lastHz: Hz | '' = '';

  const placeHazard = (h: Hz) => {
    switch (h) {
      case 'stump':
        b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 1);
        break;
      case 'gap':
      case 'stream': {
        const w = 2.2 + r() * 0.6;
        b.ground(1).arc(4, -0.4, w + 0.8, 1.5).gap(w, h === 'stream' || water).ground(1.5);
        break;
      }
      case 'lowLog':
        b.gems(3, 1.5, 0.45, 1).lowLog(2.5 + r() * 1.2, 1, 1);
        break;
      case 'thorns': {
        const w = 1.3 + r() * 0.6;
        b.ground(1).arc(3, 0, w, 1.4, 1.2).thorns(w, 0.8).ground(1.5);
        break;
      }
      case 'beetle':
        b.beetle(2.5, 3 + r(), 1.2 + r() * 0.4).ground(6);
        break;
      case 'beetles':
        b.beetle(2, 2.5, 1.3).beetle(6.5, 2.5, 1.5).ground(10);
        break;
      case 'snail':
        b.enemy('snail', 2.5, 1.5, 0.6).arc(3, 1.8, 2.2, 1.2, 1.2).ground(5.5);
        break;
      case 'beeHigh':
        b.enemy('bee', 3, 1.2, 1.1, { y: 1.4, amp: 0.25, phase: r() * 6 }).gems(3, 2.5, 0.45, 1).ground(6);
        break;
      case 'beeLow':
        b.enemy('bee', 3, 1.0, 1.0, { y: 0.4, amp: 0.2, phase: r() * 6 }).arc(3, 2.2, 2, 1.2, 1.4).ground(6);
        break;
      case 'roller':
        // flat run: the acorn waits far ahead and rolls in once it is on screen
        b.enemy('roller', 13, 0, 0).gems(4, 1, 0.7, 1.2).ground(14);
        break;
      case 'step':
        if (b.y < 2 && r() < 0.6) b.ground(1).up(1).ground(4);
        else if (b.y > 0.5) b.ground(1).down(1).ground(4);
        else b.ground(5);
        break;
    }
    lastHz = h;
  };
  const placeAcorn = () => {
    const k = r();
    if (k < 0.34) {
      // high above the trail: hold to jump higher
      b.ground(2).acorn(2.5, 3.4).ground(5);
    } else if (k < 0.67) {
      b.ground(1).ledge(2.5, 2.6, 4).acorn(4.5, 3.6).gems(3, 3, 3.2, 1).ground(10);
    } else {
      b.acorn(2.6, 0.4).lowLog(3.2, 1, 1);
    }
    acornsLeft--;
  };

  const cp = () => {
    b.checkpoint(0);
    v = Math.min(MAX_SPEED, v * (1 + ramp));
  };
  const runSection = (sec: number, first: boolean, acorns: number) => {
    const startX = b.x;
    if (first) {
      b.ground(6).gems(5, 1, 0.7, 1.2).ground(8);
      if (lesson?.hazard) b.sign(lesson.sign, lesson.hand, 1).ground(4);
    } else space(1.2);
    const slots = Math.max(acorns, Math.round(sec / 3.2));
    const acornAt = new Set<number>();
    while (acornAt.size < acorns) acornAt.add(Math.floor(r() * slots));
    let lastCp = b.x;
    for (let slot = 0; slot < slots || (b.x - startX) / v < sec; slot++) {
      if (acornAt.has(slot)) placeAcorn();
      else {
        let h = weighted();
        if (h === lastHz && r() < 0.6) h = weighted();
        placeHazard(h);
        // tight combinations later on: a second hazard right after the first
        if (!teach && r() < 0.15 + d * 0.55) {
          b.ground(Math.max(1.5, (0.55 + r() * 0.2) * v));
          let h2 = weighted();
          if (h2 === 'roller' || h2 === 'step') h2 = pick(pool.filter((x) => x !== 'roller' && x !== 'step'));
          placeHazard(h2);
        }
      }
      space(spacing());
      if (b.x - lastCp > 24 * v) {
        cp();
        lastCp = b.x;
      }
    }
  };

  const decide = (rec: Recipe) => {
    const R: Record<Recipe, () => void> = {
      river: () => b.decision('river', 5.5, shuffle(['bridge', 'vine', world >= 2 ? 'leaf' : 'vine']), 'bridge'),
      gap: () => b.decision('gap', 5.5, shuffle(['bridge', 'vine', world >= 2 ? 'leaf' : 'vine']), 'bridge'),
      wall: () => b.decision('wall', 5, shuffle(['bridge', 'vine', 'mushroom', ...(world >= 3 ? (['tree'] as PlantKind[]) : [])]), 'vine'),
      thorns: () => b.arc(5, 1.5, 5, 2.4, 1.5).decision('thorns', 5, shuffle(['bridge', 'mushroom', 'vine', ...(world >= 2 ? (['leaf'] as PlantKind[]) : [])]), 'mushroom'),
      cliff: () => b.decision('cliff', 13, shuffle(['leaf', 'bridge', 'mushroom']), 'leaf', { drop: 4 }),
      cliffTree: () => b.decision('cliff', 13, shuffle(['leaf', 'tree', 'bridge']), 'leaf', { drop: 4 }),
      riverAcorn: () => b.decision('river', 5.5, shuffle(['bridge', 'mushroom', 'vine']), 'mushroom', { alsoWorks: ['bridge'], acornAt: [2.8, 3.6] }),
      lowWallAcorn: () => b.decision('wall', 3, shuffle(['vine', 'mushroom', 'leaf']), 'vine', { alsoWorks: ['mushroom'], acornAt: [-0.5, 5.6] }),
      wideRiver: () => b.decision('river', 8.5, shuffle(['bridge', 'tree', 'mushroom']), 'tree'),
      shortThorns: () => b.decision('thorns', 3.4, shuffle(['log', 'bridge', 'tree', 'vine']), 'log', { thornH: 0.8 }),
      shortThornsAcorn: () => b.decision('thorns', 3.4, shuffle(['log', 'mushroom', 'bridge']), 'mushroom', { thornH: 0.8, alsoWorks: ['log'], acornAt: [1.7, 3.5] }),
    };
    R[rec]();
  };
  function shuffle<T>(a: T[]): T[] {
    const out = [...new Set(a)];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // spread the remaining acorns over the run sections
  const perSection = Array.from({ length: sections }, () => 0);
  for (let i = 0; i < acornsLeft; i++) perSection[(i * 2 + 1) % sections]++;
  let di = 0;
  for (let sct = 0; sct < sections && (sct === 0 || di < nDps || sct === sections - 1); sct++) {
    runSection(secTime, sct === 0, perSection[sct]);
    if (di < nDps) {
      cp();
      b.ground(3);
      if (lesson?.recipe && di === 0) b.sign(lesson.sign, 'choose', 0).ground(2);
      decide(dpList[di++]);
      if (di < nDps && r() < twoInARow) {
        // two obstacles in a row: the next decision point right after this one
        b.ground(3);
        decide(dpList[di++]);
        perSection[sct + 1] += perSection[sct + 2] ?? 0;
        if (sct + 2 < sections) perSection[sct + 2] = 0;
      }
      b.gems(4, 1.5, 0.7, 1).ground(6);
      if (di >= nDps) {
        // the last run to the goal
        runSection(secTime, false, perSection.slice(sct + 1).reduce((a, x) => a + x, 0));
        break;
      }
    }
  }
  cp();
  b.gems(6, 0, 0.7, 1).ground(8);
  const level = b.goal().done();
  const nAcorns = level.pickups.filter((p) => p.kind === 'acorn').length;
  if (nAcorns !== 3) throw new Error(`${level.id}: ${nAcorns} golden acorns`);
  return level;
}
