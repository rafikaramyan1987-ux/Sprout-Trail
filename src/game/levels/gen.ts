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
import type { HandHint, Level, PlantKind, SetPiece } from '../types';

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

/** the first level of a world introduces its new hazard / plant with a sign */
const TEACH: Record<number, { sign: string; hand?: HandHint; hazard?: Hz; recipe?: Recipe }[]> = {
  2: [{ sign: 'tut.bee', hazard: 'beeHigh' }, { sign: 'tut.leaf', recipe: 'cliff' }, { sign: 'tut.acornChoice', recipe: 'riverAcorn' }],
  3: [{ sign: 'tut.snail', hazard: 'snail' }, { sign: 'tut.tree', recipe: 'wideRiver' }, { sign: 'tut.tree', recipe: 'cliffTree' }],
  4: [{ sign: 'tut.roll', hazard: 'roller' }, { sign: 'tut.log', recipe: 'shortThorns' }, { sign: 'tut.acornChoice', recipe: 'shortThornsAcorn' }],
  5: [{ sign: 'tut.double', recipe: 'wall' }, { sign: 'tut.fog', hazard: 'beeLow' }, { sign: 'tut.double', recipe: 'riverAcorn' }],
};

/**
 * The signature moment of every level (no two levels in a row share it). Each set piece is introduced once with a
 * sign (the first level it appears in), then remixed. Levels 1-2 of world 1 are hand-made (levels/w1.ts).
 */
export const SCHEDULE: SetPiece[][] = [
  ['planks', 'shrooms', 'ropes', 'logs', 'collapse', 'glide', 'chase', 'planks', 'ropes', 'shrooms', 'logs', 'chase'],
  ['cave', 'waterfall', 'planks', 'ropes', 'chase', 'cave', 'glide', 'logs', 'waterfall', 'collapse', 'shrooms', 'ropes'],
  ['shrooms', 'cave', 'ropes', 'planks', 'glide', 'waterfall', 'logs', 'chase', 'shrooms', 'collapse', 'cave', 'ropes'],
  ['wind', 'logs', 'wind', 'chase', 'planks', 'wind', 'glide', 'ropes', 'collapse', 'wind', 'waterfall', 'chase'],
  ['lily', 'ropes', 'lily', 'cave', 'logs', 'lily', 'wind', 'chase', 'planks', 'lily', 'glide', 'ropes'],
];
export const SPECIAL_PIECES: SetPiece[][] = [
  ['ropes', 'shrooms', 'chase'],
  ['cave', 'ropes', 'waterfall'],
  ['shrooms', 'glide', 'cave'],
  ['wind', 'collapse', 'chase'],
  ['lily', 'ropes', 'wind'],
];
const ALL_PIECES: SetPiece[] = ['planks', 'shrooms', 'ropes', 'logs', 'collapse', 'glide', 'chase', 'cave', 'waterfall', 'wind', 'lily'];
/** the world a set piece is first allowed in */
const PIECE_WORLD: Record<SetPiece, number> = { planks: 1, shrooms: 1, ropes: 1, logs: 1, collapse: 1, glide: 1, chase: 1, cave: 2, waterfall: 2, wind: 4, lily: 5 };

/** the scenery variants of each world (four each); a level starts in one and wanders into the next */
export const VARIANTS: string[][] = [
  ['meadow', 'sunset', 'rain', 'lake'],
  ['pines', 'roots', 'glow', 'falls'],
  ['caps', 'canyon', 'pastel', 'grotto'],
  ['golden', 'ridge', 'dusk', 'drizzle'],
  ['marsh', 'lagoon', 'moon', 'mangrove'],
];

/** the first level (in play order) each set piece appears in: it gets a sign there */
export function firstAppearance(piece: SetPiece): string {
  if (piece === 'planks') return '1-1';
  if (piece === 'shrooms') return '1-2';
  for (let w = 0; w < SCHEDULE.length; w++) for (let n = 0; n < 12; n++) if (SCHEDULE[w][n] === piece) return `${w + 1}-${n + 1}`;
  return '';
}

/** overall difficulty 0..1: world 1 levels 1-2 are the tutorial, then it rises through the whole game */
export function difficulty(world: number, n: number) {
  const gi = (world - 1) * 12 + (n - 1);
  if (gi < 2) return 0.04 * (gi + 1);
  return Math.min(1, 0.3 + (0.7 * (gi - 2)) / 57);
}

/** seconds of play of a level */
export function targetSeconds(world: number, n: number, special = false) {
  return Math.min(58, 42 + (world - 1) * 3 + (n - 1) * 0.9 - (special ? 10 : 0));
}

export function levelSpeed(world: number, n: number) {
  const gi = (world - 1) * 12 + (n - 1);
  return Math.min(MAX_SPEED * 0.9, RUN * (1 + (0.3 * gi) / 59));
}

export interface GenOpts {
  special?: boolean;
  daily?: boolean;
  id?: string;
}

export function generateLevel(world: number, n: number, seed: number, opts: GenOpts = {}): Level {
  const r = rng(seed * 977 + world * 131 + n * 17);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const lesson = !opts.special && !opts.daily && n <= 3 ? TEACH[world]?.[n - 1] : undefined;
  const id = opts.id ?? (opts.special ? `${world}-S` : `${world}-${n}`);
  const d = opts.special ? Math.min(1, difficulty(world, 12) + 0.03) : opts.daily ? difficulty(world, 7) : difficulty(world, n);
  const ramp = 0.035 + 0.02 * d;
  let v = opts.special ? levelSpeed(world, 12) : levelSpeed(world, opts.daily ? 7 : n);
  // the set pieces: the scheduled main one, plus a different second one from the middle of the game on
  const prevMain = n > 1 ? SCHEDULE[world - 1][n - 2] : world > 1 ? SCHEDULE[world - 2][11] : undefined;
  const avail = ALL_PIECES.filter((p) => PIECE_WORLD[p] <= world);
  let pieces: SetPiece[];
  if (opts.special) pieces = [...SPECIAL_PIECES[world - 1]];
  else if (opts.daily) {
    const a = avail[(seed * 7) % avail.length];
    pieces = [a, avail.filter((p) => p !== a)[(seed * 3) % (avail.length - 1)]];
  } else {
    const main = SCHEDULE[world - 1][n - 1];
    pieces = [main];
    if (d > 0.3) {
      const second = shuffle(avail.filter((p) => p !== main && p !== prevMain && p !== 'cave'))[0];
      if (second) pieces.push(second);
    }
  }
  const nDps = opts.special ? 3 : lesson?.recipe ? 2 : d < 0.25 ? 2 : 2 + (d > 0.5 ? 1 : 0) + (d > 0.85 ? 1 : 0);
  const recipes = unlocked(WORLD_RECIPES, world);
  const hazards = unlocked(WORLD_HAZARDS, world);
  const newRecipes = WORLD_RECIPES[world - 1];
  const newHazards = WORLD_HAZARDS[world - 1];

  // decision point recipes: the lesson's first; world 1 level 3 teaches the vine ladder and the mushroom
  const dpList: Recipe[] = [];
  for (let i = 0; i < nDps; i++) {
    if (i === 0 && lesson?.recipe) dpList.push(lesson.recipe);
    else if (world === 1 && n === 3) dpList.push(i === 0 ? 'wall' : 'thorns');
    else {
      let rec = newRecipes.length && r() < 0.5 ? pick(newRecipes) : pick(recipes);
      if (rec === dpList[i - 1]) rec = pick(recipes);
      dpList.push(rec);
    }
  }
  // at most one golden acorn comes from a plant choice, one from the main set piece
  let seen = 0;
  for (let i = 0; i < dpList.length; i++) if (dpList[i].endsWith('Acorn') && ++seen > 1) dpList[i] = 'gap';
  const pieceAcorn = ['planks', 'ropes', 'logs', 'lily', 'shrooms', 'waterfall'].includes(pieces[0]);
  let acornsLeft = 3 - seen - (pieceAcorn ? 1 : 0);
  const twoInARow = world >= 5 ? 0.6 : lesson?.sign === 'tut.double' ? 1 : 0;
  // fewer seeds as the game goes on: one spare seed early, none later
  const seeds = nDps + (d < 0.4 ? 1 : 0);

  const b = new LevelBuilder(id, world, n, seeds, seed, v, ramp);
  b.level.pieces = pieces;
  b.level.difficulty = d;
  if (opts.special) b.level.special = true;
  if (opts.daily) b.level.daily = true;
  // the journey: a level starts in one scenery variant and wanders into the next ones
  const vars = VARIANTS[world - 1];
  const v0 = opts.daily ? seed % 4 : opts.special ? 3 : (n - 1 + world) % 4;
  const journey = [vars[v0], vars[(v0 + 1) % 4], ...(d > 0.45 ? [vars[(v0 + 2) % 4]] : [])];
  b.scene(journey[0]);

  const total = targetSeconds(world, n, opts.special);
  const sections = nDps + 1;
  const secTime = total / sections;
  const water = world === 5 || r() < 0.4;
  const spacing = () => Math.max(0.6, 1.3 - d * 0.75 + r() * 0.25);
  const space = (sec: number) => {
    const len = Math.max(2.5, sec * v);
    if (r() < 0.55 && len > 4) b.gems(Math.min(6, Math.floor(len / 1.2)), 0.6, 0.7, 1.1);
    b.ground(len);
  };
  const pool: Hz[] = hazards;
  const weighted = (exclude: Hz[] = []): Hz => {
    let h: Hz;
    if (lesson?.hazard && r() < 0.45) h = lesson.hazard;
    else if (newHazards.length && r() < 0.3) h = pick(newHazards);
    else h = pick(pool);
    return exclude.includes(h) ? pick(pool.filter((x) => !exclude.includes(x))) : h;
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
  /** a stretch of hazards; `exclude` keeps some out (no gaps in a chase) */
  const hazardRun = (count: number, exclude: Hz[] = []) => {
    for (let i = 0; i < count; i++) {
      let h = weighted(exclude);
      if (h === lastHz && r() < 0.6) h = weighted(exclude);
      placeHazard(h);
      if (r() < 0.2 + d * 0.6) {
        b.ground(Math.max(1.5, (0.55 + r() * 0.2) * v));
        placeHazard(weighted([...exclude, 'roller', 'step']));
      }
      space(spacing());
    }
  };
  let signed = new Set<string>();
  /** the set pieces, built at the cursor (with a sign the first time one appears in the game) */
  const piece = (p: SetPiece, main: boolean) => {
    const k = Math.round(d * 10);
    if (main && firstAppearance(p) === id && !signed.has(p)) {
      b.sign(`piece.${p}`, p === 'glide' ? 'hold' : p === 'ropes' ? 'tap' : undefined, 1).ground(4);
      signed.add(p);
    }
    const acorn = main && pieceAcorn;
    switch (p) {
      case 'planks':
        b.planks(4 + Math.min(4, Math.floor(k / 2)), { sway: d > 0.25 ? 0.25 + 0.4 * d : 0, sink: world >= 2 && d > 0.3 ? 0.65 - 0.25 * d : 0, acornAt: acorn ? 2 : undefined, gap: 1.6 + 0.6 * d });
        break;
      case 'ropes':
        b.ropes(2 + Math.min(2, Math.floor(k / 3)), { acorn });
        break;
      case 'logs':
        b.logs(3 + Math.min(3, Math.floor(k / 3)), { croc: d > 0.2, drift: 0.5 + 0.6 * d, acornAt: acorn ? 1 : undefined });
        break;
      case 'lily':
        b.lily(5 + Math.min(4, Math.floor(k / 2)), { sinkEvery: d > 0.8 ? 1 : 2, sinkAfter: 0.6 - 0.25 * d, acornAt: acorn ? 3 : undefined });
        break;
      case 'shrooms':
        b.shrooms(2 + Math.min(2, Math.floor(k / 3)), { acornAt: acorn ? 0 : undefined });
        break;
      case 'collapse':
        b.collapse(12 + Math.round(12 * d));
        break;
      case 'glide':
        b.glide(12 + Math.round(6 * d));
        break;
      case 'waterfall':
        b.waterfall(acorn);
        break;
      case 'chase': {
        b.ground(2);
        const x0 = b.x;
        hazardRun(3 + Math.round(2 * d), ['gap', 'stream', 'roller', 'step', 'beeHigh']);
        b.ground(3);
        b.zone('chase', x0, b.x, { y: b.y });
        b.ground(4);
        break;
      }
      case 'cave': {
        b.ground(2);
        const x0 = b.x;
        hazardRun(4 + Math.round(3 * d));
        b.zone('cave', x0, b.x);
        break;
      }
      case 'wind': {
        const x0 = b.x;
        const dir = r() < 0.5 ? 1 : -1;
        hazardRun(4 + Math.round(2 * d), ['roller', 'beeHigh', 'lowLog']);
        b.zone('wind', x0, b.x, { dir, strength: 1.6 + 1.2 * d, period: 2.6, duty: 0.5, phase: r() * 2 });
        break;
      }
    }
    // a run-out after the set piece (a flight off a rope or a mushroom is fast)
    b.gems(3, 1, 0.7, 1.2).ground(4 + v * 0.8);
  };
  const placePieceAcornFallback = () => {
    acornsLeft++;
  };
  void placePieceAcornFallback;

  const runSection = (sec: number, first: boolean, acorns: number, piecesHere: SetPiece[], mainHere: boolean) => {
    const startX = b.x;
    if (first) {
      b.ground(6).gems(5, 1, 0.7, 1.2).ground(6);
      if (lesson?.hazard) b.sign(lesson.sign, lesson.hand, 1).ground(4);
    } else space(1.2);
    const slots = Math.max(acorns + piecesHere.length + 1, Math.round(sec / (2.5 - 0.9 * d)));
    const acornAt = new Set<number>();
    while (acornAt.size < acorns) acornAt.add(Math.floor(r() * slots));
    const pieceAt = new Map<number, SetPiece>();
    piecesHere.forEach((p, i) => {
      let at = Math.floor(slots * (0.25 + 0.3 * i));
      while (acornAt.has(at) || pieceAt.has(at)) at++;
      pieceAt.set(at, p);
    });
    let lastCp = b.x;
    const pending = () => [...acornAt, ...pieceAt.keys()].some((k) => k >= slotNow);
    let slotNow = 0;
    for (let slot = 0; (b.x - startX) / v < sec || pending(); slot++) {
      slotNow = slot;
      const p = pieceAt.get(slot);
      if (p) {
        cp();
        lastCp = b.x;
        b.ground(2);
        piece(p, mainHere && p === pieces[0]);
      } else if (acornAt.has(slot)) placeAcorn();
      else hazardRun(1);
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

  // which section gets which set piece and how many acorns: the main piece in the middle of the level
  const perSection = Array.from({ length: sections }, () => 0);
  for (let i = 0; i < Math.max(0, acornsLeft); i++) perSection[(i * 2 + 1) % sections]++;
  const mainSec = Math.min(sections - 1, Math.max(0, Math.floor(sections / 2)));
  const piecesIn: SetPiece[][] = Array.from({ length: sections }, () => []);
  piecesIn[mainSec].push(pieces[0]);
  pieces.slice(1).forEach((p, i) => piecesIn[(mainSec + 1 + i) % sections].push(p));
  let di = 0;
  for (let sct = 0; sct < sections; sct++) {
    // the scenery changes along the way
    const jv = Math.min(journey.length - 1, Math.floor((sct * journey.length) / sections));
    b.scene(journey[jv]);
    runSection(secTime, sct === 0, perSection[sct], piecesIn[sct], sct === mainSec);
    if (di < nDps) {
      cp();
      b.ground(3);
      if (lesson?.recipe && di === 0) b.sign(lesson.sign, 'choose', 0).ground(2);
      decide(dpList[di++]);
      if (di < nDps && sct + 1 < sections - 1 && r() < twoInARow) {
        // two obstacles in a row: the next decision point right after this one
        b.ground(3);
        decide(dpList[di++]);
      }
      b.gems(4, 1.5, 0.7, 1).ground(6);
    }
  }
  while (di < nDps) {
    cp();
    b.ground(3);
    decide(dpList[di++]);
    b.gems(4, 1.5, 0.7, 1).ground(6);
  }
  // top up to three golden acorns on the last stretch (high above the trail: hold to jump higher)
  for (let k = b.level.pickups.filter((p) => p.kind === 'acorn').length; k < 3; k++) {
    b.ground(2).acorn(2.5, 3.4).ground(4);
    space(spacing());
  }
  cp();
  b.gems(6, 0, 0.7, 1).ground(8);
  const level = b.goal().done();
  // exactly three golden acorns: extra ones (not from a plant choice) become gems
  const dpAcorns = new Set(level.dps.map((x) => x.acorn ?? -1));
  let count = level.pickups.filter((p) => p.kind === 'acorn').length;
  for (let i = level.pickups.length - 1; i >= 0 && count > 3; i--)
    if (level.pickups[i].kind === 'acorn' && !dpAcorns.has(i)) {
      level.pickups[i].kind = 'gem';
      count--;
    }
  if (count !== 3) throw new Error(`${level.id}: ${count} golden acorns`);
  return level;
}
