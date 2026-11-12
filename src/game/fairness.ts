/**
 * Fairness check used by the level validator: replays a bot run and measures, for every hazard (enemies, thorns,
 * low logs, stumps), how long it was on screen before the sprite reached it. The camera always shows
 * `viewAhead(speed)` units ahead of the sprite (render/stage + play camera), so "on screen" means its near edge is
 * within that distance at the current run speed.
 */
import * as P from './physics';
import { choose, ENEMY_SIZE, enemyX, newSim, step } from './sim';
import { Replay, type Plan } from './bot';
import type { Level } from './types';

export interface Readable {
  what: string;
  x: number;
  /** seconds between appearing on screen and the sprite reaching it */
  seconds: number;
}

export function readability(level: Level, plan: Pick<Plan, 'inputs' | 'choices'>): Readable[] {
  type T = { what: string; x: number; near: (et: number, rollAt: number) => number; seen: number; met: number };
  const threats: T[] = [];
  level.enemies.forEach((e, i) =>
    threats.push({ what: e.kind, x: e.x0, near: (et, ra) => (i >= 0 ? enemyX(e, et, ra) - ENEMY_SIZE[e.kind].w / 2 : 0), seen: -1, met: -1 }),
  );
  for (const h of level.hazards) threats.push({ what: 'thorns', x: h.x0, near: () => h.x0, seen: -1, met: -1 });
  for (const b of level.boxes) if (b.kind === 'log' || b.kind === 'stump') threats.push({ what: b.kind === 'log' ? 'low log' : 'stump', x: b.x0, near: () => b.x0, seen: -1, met: -1 });
  // set pieces: the crocodile's lake, wind, a collapsing bridge, sinking platforms (the boar comes from behind and
  // only catches a sprite that is held up, so it is not something to see ahead)
  for (const w of level.water) if (w.croc) threats.push({ what: 'crocodile lake', x: w.x0, near: () => w.x0, seen: -1, met: -1 });
  for (const z of level.zones) if (z.kind === 'wind' || z.kind === 'collapse') threats.push({ what: z.kind === 'wind' ? 'wind' : 'collapsing bridge', x: z.x0, near: () => z.x0, seen: -1, met: -1 });
  // pits and gaps to jump (not the decision points' obstacles: the sprite stops there by itself)
  for (const x of pitEdges(level)) threats.push({ what: 'pit', x, near: () => x, seen: -1, met: -1 });
  for (const m of level.movers) if (m.sinkAfter > 0) threats.push({ what: `sinking ${m.kind}`, x: m.x0, near: () => m.x0 - m.amp, seen: -1, met: -1 });
  // decision point obstacles are excluded: the sprite stops in front of them by itself
  const s = newSim(level);
  const r = new Replay(plan);
  for (let i = 0; i < 60 * 300 && s.mode !== 'won' && s.mode !== 'lost'; i++) {
    if (s.mode === 'decide') {
      const k = r.choice();
      if (!k || !choose(level, s, k)) break;
    }
    const inp = r.input(s);
    step(level, s, inp);
    if (s.mode !== 'run') continue;
    level.enemies.forEach((_, i) => void i);
    threats.forEach((t, i) => {
      const ra = i < level.enemies.length ? s.rollAt[i] : -1;
      const near = t.near(s.et, ra);
      if (t.seen < 0 && near - s.x <= P.viewAhead(Math.max(s.speed, s.vx))) t.seen = s.et;
      if (t.met < 0 && near - (s.x + P.W / 2) <= 0.3) t.met = s.et;
    });
  }
  return threats.filter((t) => t.met >= 0).map((t) => ({ what: t.what, x: t.x, seconds: (t.met - Math.max(0, t.seen)) * P.DT }));
}

/** the near edges of pits the sprite has to jump over (ground ends, the next ground starts more than 0.5 later) */
export function pitEdges(level: Level): number[] {
  const g = level.boxes.filter((b) => b.kind === 'ground' || b.kind === 'wall').sort((a, b) => a.x0 - b.x0);
  const out: number[] = [];
  for (let i = 1; i < g.length; i++) {
    const x = g[i - 1].x1;
    if (g[i].x0 - x <= 0.5) continue;
    if (level.dps.some((d) => x >= d.stopX - 0.5 && x <= d.exitX)) continue;
    out.push(x);
  }
  return out;
}
