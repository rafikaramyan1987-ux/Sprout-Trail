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
      if (t.seen < 0 && near - s.x <= P.viewAhead(s.speed)) t.seen = s.et;
      if (t.met < 0 && near - (s.x + P.W / 2) <= 0.3) t.met = s.et;
    });
  }
  return threats.filter((t) => t.met >= 0).map((t) => ({ what: t.what, x: t.x, seconds: (t.met - Math.max(0, t.seen)) * P.DT }));
}
