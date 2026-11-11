/**
 * The deterministic game simulation: fixed timestep, no randomness, no DOM. The renderer, the bot and the level
 * validator all run this exact code, so a level the validator solves is a level the player can solve.
 */
import * as P from './physics';
import type { Box, DecisionPoint, EnemyDef, EnemyKind, Level, PlantKind } from './types';

export type Mode = 'run' | 'decide' | 'grow' | 'cross' | 'fail' | 'won' | 'lost';
export type FailReason = '' | 'splash' | 'thorns' | 'bonk' | 'fall';
export type SimEvent =
  | 'jump'
  | 'land'
  | 'gem'
  | 'acorn'
  | 'hit'
  | 'stomp'
  | 'fall'
  | 'dpStop'
  | 'plant'
  | 'cross'
  | 'success'
  | 'fail'
  | 'bounce'
  | 'climb'
  | 'hop'
  | 'checkpoint'
  | 'win'
  | 'lose'
  | 'duck'
  | 'roll'
  | 'glide'
  | 'speed';

export interface Input {
  jumpPressed: boolean;
  jumpHeld: boolean;
  duckPressed: boolean;
  duckHeld: boolean;
}
export const NO_INPUT: Input = { jumpPressed: false, jumpHeld: false, duckPressed: false, duckHeld: false };

export interface Plant {
  dp: number;
  kind: PlantKind;
  x: number;
  y: number;
  /** tick it was planted */
  at: number;
}

export interface SimState {
  tick: number;
  /** world clock for enemies: runs only while the sprite runs (paused at decision points) */
  et: number;
  mode: Mode;
  modeT: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  holding: boolean;
  holdT: number;
  duckT: number;
  ducking: boolean;
  climbing: boolean;
  hopped: boolean;
  bounced: boolean;
  knockT: number;
  hearts: number;
  invuln: number;
  /** current run speed (grows at checkpoints, capped) */
  speed: number;
  /** rolling acorns: the world tick they started rolling at (-1: still waiting) */
  rollAt: Float64Array;
  gliding: boolean;
  logHop: boolean;
  seeds: number;
  gems: number;
  acorns: number;
  /** per pickup: collected */
  got: Uint8Array;
  enemyDead: Uint8Array;
  /** per decision point: crossed */
  solved: Uint8Array;
  cp: number;
  cpX: number;
  cpY: number;
  dp: number;
  plants: Plant[];
  failReason: FailReason;
  wrong: number;
  stuckT: number;
  bestX: number;
  /** speed of the last landing (for squash / dust) */
  landV: number;
  events: SimEvent[];
  /** index of the last pickup / enemy an event refers to */
  lastPickup: number;
  lastEnemy: number;
}

/** spatial index: the boxes overlapping each 4-unit column */
interface Index {
  cell: number;
  boxes: number[][];
  pickups: number[][];
}
const CELL = 4;
const indexCache = new WeakMap<Level, Index>();
function index(level: Level): Index {
  let ix = indexCache.get(level);
  if (ix) return ix;
  const n = Math.ceil((level.goalX + 40) / CELL) + 2;
  ix = { cell: CELL, boxes: Array.from({ length: n }, () => []), pickups: Array.from({ length: n }, () => []) };
  level.boxes.forEach((b, i) => {
    for (let c = Math.max(0, Math.floor(b.x0 / CELL)); c <= Math.min(n - 1, Math.floor(b.x1 / CELL)); c++) ix!.boxes[c].push(i);
  });
  level.pickups.forEach((p, i) => ix!.pickups[Math.max(0, Math.min(n - 1, Math.floor(p.x / CELL)))].push(i));
  indexCache.set(level, ix);
  return ix;
}

export function newSim(level: Level): SimState {
  return {
    tick: 0,
    et: 0,
    mode: 'run',
    modeT: 0,
    x: level.startX,
    y: level.startY,
    vx: 0,
    vy: 0,
    grounded: true,
    coyote: 0,
    buffer: 0,
    holding: false,
    holdT: 0,
    duckT: 0,
    ducking: false,
    climbing: false,
    hopped: false,
    bounced: false,
    knockT: 0,
    hearts: 3,
    invuln: 0,
    speed: level.speed,
    rollAt: new Float64Array(level.enemies.length).fill(-1),
    gliding: false,
    logHop: false,
    seeds: level.seeds,
    gems: 0,
    acorns: 0,
    got: new Uint8Array(level.pickups.length),
    enemyDead: new Uint8Array(level.enemies.length),
    solved: new Uint8Array(level.dps.length),
    cp: -1,
    cpX: level.startX,
    cpY: level.startY,
    dp: -1,
    plants: [],
    failReason: '',
    wrong: 0,
    stuckT: 0,
    bestX: level.startX,
    landV: 0,
    events: [],
    lastPickup: -1,
    lastEnemy: -1,
  };
}

export function cloneSim(s: SimState): SimState {
  return {
    ...s,
    got: s.got.slice(),
    enemyDead: s.enemyDead.slice(),
    rollAt: s.rollAt.slice(),
    solved: s.solved.slice(),
    plants: s.plants.map((p) => ({ ...p })),
    events: [],
  };
}

/** enemy centre x at a world tick (rollers: `rollAt` is the tick they started rolling, -1 = waiting) */
export function enemyX(e: EnemyDef, tick: number, rollAt = -1) {
  if (e.kind === 'roller') return rollAt < 0 ? e.x0 : e.x0 - (tick - rollAt) * P.DT * P.ROLL_SPEED;
  const len = e.x1 - e.x0;
  if (len <= 0) return e.x0;
  const d = (tick * P.DT * e.speed) % (2 * len);
  return d < len ? e.x0 + d : e.x1 - (d - len);
}
/** the bottom of the enemy's hitbox at a world tick */
export function enemyY(e: EnemyDef, tick: number) {
  if (e.kind !== 'bee') return e.y;
  return e.y + (e.amp ?? 0) * Math.sin(tick * P.DT * e.speed * 2 + (e.phase ?? 0));
}
export const ENEMY_SIZE: Record<EnemyKind, { w: number; h: number; stomp: boolean }> = {
  beetle: { w: 0.9, h: 0.7, stomp: true },
  snail: { w: 1.0, h: 0.85, stomp: false },
  bee: { w: 0.7, h: 0.6, stomp: false },
  roller: { w: 0.8, h: 0.8, stomp: true },
};

function plantBoxes(level: Level, s: SimState): Box[] {
  const out: Box[] = [];
  for (const p of s.plants) {
    if (p.kind === 'bridge') out.push({ x0: p.x, x1: p.x + P.BRIDGE_LEN, y0: p.y - 0.3, y1: p.y, kind: 'plank', oneWay: true });
    if (p.kind === 'tree') out.push({ x0: p.x, x1: p.x + P.TREE_LEN, y0: p.y - 0.4, y1: p.y, kind: 'plank', oneWay: true });
    if (p.kind === 'log') out.push({ x0: p.x, x1: p.x + P.LOG_LEN, y0: p.y + 0.2, y1: p.y + P.LOG_TOP, kind: 'plank', oneWay: true });
  }
  void level;
  return out;
}

function forBoxes(level: Level, s: SimState, x0: number, x1: number, fn: (b: Box) => void) {
  const ix = index(level);
  const c0 = Math.max(0, Math.floor(x0 / CELL));
  const c1 = Math.min(ix.boxes.length - 1, Math.floor(x1 / CELL));
  let seen: Set<number> | null = null;
  for (let c = c0; c <= c1; c++) {
    for (const i of ix.boxes[c]) {
      if (c1 > c0) {
        seen ??= new Set();
        if (seen.has(i)) continue;
        seen.add(i);
      }
      fn(level.boxes[i]);
    }
  }
  if (s.plants.length) for (const b of plantBoxes(level, s)) fn(b);
}

const height = (s: SimState) => (s.ducking ? P.H_DUCK : P.H_STAND);

function canStand(level: Level, s: SimState) {
  let ok = true;
  const x0 = s.x - P.W / 2,
    x1 = s.x + P.W / 2;
  forBoxes(level, s, x0, x1, (b) => {
    if (b.oneWay) return;
    if (x1 > b.x0 && x0 < b.x1 && s.y + P.H_STAND > b.y0 + 1e-4 && s.y < b.y1 - 1e-4) ok = false;
  });
  return ok;
}

/** the next decision point the sprite has not crossed yet */
export function nextDp(level: Level, s: SimState): number {
  for (let i = 0; i < level.dps.length; i++) if (!s.solved[i]) return i;
  return -1;
}

function hit(s: SimState) {
  if (s.invuln > 0 || s.mode !== 'run') return;
  s.hearts--;
  s.invuln = P.INVULN;
  s.vy = 7;
  s.grounded = false;
  s.knockT = 0.25;
  s.holding = false;
  s.events.push('hit');
  if (s.hearts <= 0) {
    s.mode = 'lost';
    s.modeT = 0;
    s.events.push('lose');
  }
}

function startFail(s: SimState, reason: FailReason) {
  s.mode = 'fail';
  s.modeT = 0;
  s.failReason = reason;
  s.climbing = false;
  s.events.push('fail');
}

function overWater(level: Level, x: number) {
  return level.water.some((w) => x >= w.x0 && x <= w.x1);
}

/** where each plant grows, relative to the start of the obstacle */
export function plantX(kind: PlantKind, dp: DecisionPoint) {
  if (kind === 'bridge' || kind === 'tree') return dp.anchorX - 0.3;
  if (kind === 'log') return dp.anchorX - 0.4;
  if (kind === 'mushroom') return dp.anchorX - 0.8;
  return dp.anchorX - 0.05;
}

/** plant a seed at the current decision point; false if not possible */
export function choose(level: Level, s: SimState, kind: PlantKind): boolean {
  if (s.mode !== 'decide' || s.dp < 0 || s.seeds <= 0) return false;
  const dp = level.dps[s.dp];
  if (!dp.cards.includes(kind)) return false;
  s.seeds--;
  s.plants.push({ dp: s.dp, kind, x: plantX(kind, dp), y: dp.y, at: s.tick });
  s.mode = 'grow';
  s.modeT = 0;
  s.events.push('plant');
  return true;
}

export function currentPlant(s: SimState): Plant | null {
  const p = s.plants[s.plants.length - 1];
  return p && p.dp === s.dp ? p : null;
}

export function step(level: Level, s: SimState, inp: Input) {
  s.events.length = 0;
  s.tick++;
  s.modeT += P.DT;
  if (s.mode === 'won' || s.mode === 'lost' || s.mode === 'decide') return;
  if (s.mode === 'grow') {
    if (s.modeT >= P.GROW_TIME) {
      s.mode = 'cross';
      s.modeT = 0;
      s.stuckT = 0;
      s.bestX = s.x;
      s.hopped = false;
      s.bounced = false;
      s.gliding = false;
      s.logHop = false;
      s.events.push('cross');
    }
    return;
  }
  if (s.mode === 'fail') {
    if (s.failReason === 'splash' || s.failReason === 'fall') {
      s.vy = Math.max(s.vy - P.GRAVITY * P.DT, -6);
      s.y += s.vy * P.DT;
      s.x += s.vx * 0.3 * P.DT;
    }
    if (s.modeT >= P.FAIL_TIME) {
      const dp = level.dps[s.dp];
      s.plants.pop();
      s.wrong++;
      s.x = dp.stopX;
      s.y = dp.y;
      s.vx = s.vy = 0;
      s.grounded = true;
      s.ducking = false;
      s.mode = 'decide';
      s.modeT = 0;
      s.failReason = '';
    }
    return;
  }
  s.et++;
  const crossing = s.mode === 'cross';
  const dp: DecisionPoint | null = crossing ? level.dps[s.dp] : null;
  const plant = crossing ? currentPlant(s) : null;
  const jumpPressed = !crossing && inp.jumpPressed;
  const jumpHeld = !crossing && inp.jumpHeld;
  const duckPressed = !crossing && inp.duckPressed;
  const duckHeld = !crossing && inp.duckHeld;

  s.invuln = Math.max(0, s.invuln - P.DT);
  s.knockT = Math.max(0, s.knockT - P.DT);
  s.buffer = jumpPressed ? P.JUMP_BUFFER : Math.max(0, s.buffer - P.DT);
  s.coyote = s.grounded ? P.COYOTE : Math.max(0, s.coyote - P.DT);

  // duck: a swipe ducks for a moment; in the air it dives down
  if (duckPressed) {
    s.duckT = P.DUCK_TIME;
    if (!s.grounded) s.vy = Math.min(s.vy, -14);
    s.events.push('duck');
  }
  if (duckHeld && s.grounded) s.duckT = Math.max(s.duckT, P.DT * 2);
  s.duckT = Math.max(0, s.duckT - P.DT);
  if (s.duckT > 0) s.ducking = true;
  else if (s.ducking && canStand(level, s)) s.ducking = false;

  // jump (buffered, with coyote time)
  if (s.buffer > 0 && (s.grounded || s.coyote > 0) && !s.climbing && (!s.ducking || canStand(level, s))) {
    s.vy = P.JUMP_V;
    s.grounded = false;
    s.coyote = 0;
    s.buffer = 0;
    s.holding = true;
    s.holdT = 0;
    s.ducking = false;
    s.duckT = 0;
    s.events.push('jump');
  }
  if (!jumpHeld) s.holding = false;

  // horizontal speed: the sprite runs by itself
  const next = crossing ? -1 : nextDp(level, s);
  if (s.climbing) s.vx = 0;
  else if (s.knockT > 0) s.vx = -3;
  else if (s.bounced && !s.grounded) s.vx = P.MUSHROOM_VX;
  else {
    let v = crossing ? P.RUN : s.speed;
    if (next >= 0) {
      const d = level.dps[next].stopX - s.x;
      if (d < P.DP_SLOW) v *= Math.max(0.25, Math.min(1, d / P.DP_SLOW));
    }
    s.vx = v;
  }

  // vertical speed
  if (s.climbing) s.vy = P.CLIMB_V;
  else {
    const g = s.holding && s.vy > 0 && s.holdT < P.HOLD_MAX ? P.GRAVITY * P.HOLD_G : P.GRAVITY;
    s.vy = Math.max(s.vy - g * P.DT, -P.FALL_MAX);
  }
  // big leaf: glide down slowly once off the ground
  if (crossing && plant?.kind === 'leaf' && !s.grounded && s.vy < 0) {
    if (!s.gliding) s.events.push('glide');
    s.gliding = true;
    s.vy = Math.max(s.vy, -P.LEAF_FALL);
  }
  // log: hop up onto it
  if (crossing && plant?.kind === 'log' && !s.logHop && s.grounded && s.x >= plant.x - 0.9) {
    s.logHop = true;
    s.vy = 9;
    s.grounded = false;
    s.events.push('hop');
  }
  s.holdT += P.DT;

  // move x, then resolve against solid boxes
  const h = height(s);
  s.x += s.vx * P.DT;
  {
    const x0 = s.x - P.W / 2,
      x1 = s.x + P.W / 2;
    forBoxes(level, s, x0 - 0.1, x1 + 0.1, (b) => {
      if (b.oneWay) return;
      if (s.x + P.W / 2 > b.x0 && s.x - P.W / 2 < b.x1 && s.y + h > b.y0 + 1e-4 && s.y < b.y1 - 1e-4) {
        if (s.vx > 0) s.x = b.x0 - P.W / 2;
        else if (s.vx < 0) s.x = b.x1 + P.W / 2;
      }
    });
  }
  // an unsolved decision point holds the sprite back like an invisible fence
  if (next >= 0 && s.x > level.dps[next].stopX) s.x = level.dps[next].stopX;

  // vine: climb up, hop off the top
  if (crossing && plant?.kind === 'vine' && !s.climbing && !s.hopped) {
    const top = plant.y + P.VINE_H;
    if (s.x >= plant.x - 0.45 && s.y < top - 0.1) {
      s.climbing = true;
      s.x = plant.x - 0.45;
      s.vx = 0;
      s.events.push('climb');
    }
  }
  if (s.climbing && plant && s.y >= plant.y + P.VINE_H) {
    s.climbing = false;
    s.hopped = true;
    s.vy = P.VINE_HOP_V;
    s.vx = P.RUN;
    s.events.push('hop');
  }

  // move y
  const prevY = s.y;
  const wasGrounded = s.grounded;
  s.y += s.vy * P.DT;
  s.grounded = false;
  {
    const x0 = s.x - P.W / 2,
      x1 = s.x + P.W / 2;
    forBoxes(level, s, x0, x1, (b) => {
      if (!(x1 > b.x0 && x0 < b.x1)) return;
      if (s.vy <= 0 && prevY >= b.y1 - 1e-3 && s.y < b.y1) {
        s.landV = -s.vy;
        s.y = b.y1;
        s.vy = 0;
        s.grounded = true;
      } else if (!b.oneWay && s.vy > 0 && s.y + h > b.y0 && prevY + h <= b.y0 + 1e-3) {
        s.y = b.y0 - h;
        s.vy = 0;
        s.holding = false;
      } else if (!b.oneWay && s.vy <= 0 && Math.abs(s.y - b.y1) < 1e-3) {
        s.grounded = true;
      }
    });
  }
  if (s.climbing) s.grounded = false;
  if (s.grounded && !wasGrounded) {
    s.events.push('land');
    s.bounced = false;
  }

  // mushroom: bounce
  if (crossing && plant?.kind === 'mushroom' && s.vy <= 0 && !s.climbing) {
    if (s.x + P.W / 2 >= plant.x - 0.55 && s.x - P.W / 2 <= plant.x + 0.55 && s.y <= plant.y + P.MUSHROOM_TOP + 0.05) {
      s.vy = P.MUSHROOM_V;
      s.bounced = true;
      s.grounded = false;
      s.events.push('bounce');
    }
  }

  // hazards
  for (const z of level.hazards) {
    if (s.x + P.W / 2 > z.x0 + 0.1 && s.x - P.W / 2 < z.x1 - 0.1 && s.y < z.y1 - 0.05 && s.y + h > z.y0) {
      if (crossing) return startFail(s, 'thorns');
      hit(s);
    }
  }

  // enemies
  if (!crossing)
    level.enemies.forEach((e, i) => {
      if (s.enemyDead[i]) return;
      if (e.kind === 'roller' && s.rollAt[i] < 0) {
        // starts rolling when it is a full view ahead of the sprite (on screen)
        if (e.x0 - s.x <= P.viewAhead(s.speed)) {
          s.rollAt[i] = s.et;
          s.lastEnemy = i;
          s.events.push('roll');
        } else return;
      }
      const sz = ENEMY_SIZE[e.kind];
      const ex = enemyX(e, s.et, s.rollAt[i]);
      const ey = enemyY(e, s.et);
      if (s.x + P.W / 2 > ex - sz.w / 2 && s.x - P.W / 2 < ex + sz.w / 2 && s.y < ey + sz.h && s.y + h > ey) {
        if (sz.stomp && s.vy < 0 && prevY >= ey + sz.h * 0.45) {
          s.enemyDead[i] = 1;
          s.vy = P.STOMP_BOUNCE;
          s.holding = jumpHeld;
          s.holdT = 0;
          s.lastEnemy = i;
          s.events.push('stomp');
        } else hit(s);
      }
    });
  if ((s.mode as Mode) === 'lost') return;

  // pickups
  {
    const ix = index(level);
    const c = Math.floor(s.x / CELL);
    for (let k = Math.max(0, c - 1); k <= Math.min(ix.pickups.length - 1, c + 1); k++)
      for (const i of ix.pickups[k]) {
        if (s.got[i]) continue;
        const p = level.pickups[i];
        if (Math.abs(p.x - s.x) < 0.7 && Math.abs(p.y - (s.y + h / 2)) < h / 2 + 0.45) {
          s.got[i] = 1;
          s.lastPickup = i;
          if (p.kind === 'gem') {
            s.gems++;
            s.events.push('gem');
          } else {
            s.acorns++;
            s.events.push('acorn');
          }
        }
      }
  }

  // fell
  if (s.y < level.killY) {
    if (crossing) return startFail(s, overWater(level, s.x) ? 'splash' : 'fall');
    s.x = s.cpX;
    s.y = s.cpY;
    s.vx = s.vy = 0;
    s.grounded = true;
    s.invuln = 1;
    s.ducking = false;
    s.duckT = 0;
    s.events.push('fall');
    return;
  }
  // crossing: falling into the river / gap counts before reaching killY
  if (crossing && dp && s.y < dp.y - (dp.drop ?? 0) - 1.6) return startFail(s, overWater(level, s.x) ? 'splash' : 'fall');

  if (crossing && dp) {
    if (s.x >= dp.exitX && s.grounded) {
      s.solved[s.dp] = 1;
      s.cpX = dp.exitX;
      s.cpY = s.y;
      s.mode = 'run';
      s.modeT = 0;
      s.events.push('success');
      return;
    }
    if (s.x > s.bestX + 0.02 || s.climbing) {
      s.bestX = Math.max(s.bestX, s.x);
      s.stuckT = 0;
    } else {
      s.stuckT += P.DT;
      if (s.stuckT > P.STUCK_TIME) return startFail(s, 'bonk');
    }
    return;
  }

  // reached a decision point
  if (next >= 0 && s.grounded && s.x >= level.dps[next].stopX - 0.02) {
    s.x = level.dps[next].stopX;
    s.dp = next;
    s.mode = 'decide';
    s.modeT = 0;
    s.vx = 0;
    s.ducking = false;
    s.duckT = 0;
    s.events.push('dpStop');
    return;
  }

  // checkpoints (each one speeds the run up a little) and the goal
  for (let i = s.cp + 1; i < level.checkpoints.length; i++) {
    if (s.x >= level.checkpoints[i].x) {
      s.cp = i;
      s.cpX = level.checkpoints[i].x;
      s.cpY = level.checkpoints[i].y;
      s.events.push('checkpoint');
      const v = Math.min(P.MAX_SPEED, s.speed * (1 + level.ramp));
      if (v > s.speed + 1e-9) s.events.push('speed');
      s.speed = v;
    } else break;
  }
  if (s.x >= level.goalX) {
    s.mode = 'won';
    s.modeT = 0;
    s.events.push('win');
  }
}

/** stars: 1 for finishing, +1 for all three golden acorns, +1 for not wasting a seed */
export function stars(level: Level, s: SimState) {
  if (s.mode !== 'won') return 0;
  return 1 + (s.acorns >= 3 ? 1 : 0) + (s.seeds >= level.seeds - level.dps.length ? 1 : 0);
}

/** "Watch an ad: continue with 1 heart": back to the last checkpoint with one heart */
export function revive(s: SimState) {
  if (s.mode !== 'lost') return;
  s.hearts = 1;
  s.mode = 'run';
  s.modeT = 0;
  s.x = s.cpX;
  s.y = s.cpY;
  s.vx = s.vy = 0;
  s.grounded = true;
  s.invuln = 2;
  s.knockT = 0;
  s.ducking = false;
  s.duckT = 0;
}

/** "Watch an ad: +2 seeds" */
export function addSeeds(s: SimState, n: number) {
  s.seeds += n;
}
