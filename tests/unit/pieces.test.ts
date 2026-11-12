import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../../src/game/build';
import { bridgeGone, gustOn, moverOffset, newSim, NO_INPUT, step, type Input, type SimState } from '../../src/game/sim';
import { solve } from '../../src/game/bot';
import * as P from '../../src/game/physics';
import type { Level } from '../../src/game/types';

const press: Input = { jumpPressed: true, jumpHeld: true, duckPressed: false, duckHeld: false };
const hold: Input = { jumpPressed: false, jumpHeld: true, duckPressed: false, duckHeld: false };
const run = (L: Level, s: SimState, ticks: number, inp: (s: SimState, i: number) => Input = () => NO_INPUT) => {
  for (let i = 0; i < ticks && s.mode === 'run'; i++) step(L, s, inp(s, i));
};
const mini = (f: (b: LevelBuilder) => void, speed = P.RUN) => {
  const b = new LevelBuilder('t', 1, 1, 0, 1, speed, 0);
  b.ground(10);
  f(b);
  // three easy golden acorns at the end (the bot only counts a win with all three)
  b.ground(2).acorn(2, 0.5).ground(3).acorn(2, 0.5).ground(3).acorn(2, 0.5).ground(10);
  return b.goal().done();
};

describe('hanging planks', () => {
  it('a sinking plank goes down after the sprite has stood on it, and comes back up', () => {
    const L = mini((b) => b.planks(3, { sink: 0.4 }));
    const s = newSim(L);
    const m = L.movers[0];
    Object.assign(s, { x: (m.x0 + m.x1) / 2, y: m.y, grounded: false, vy: 0 });
    s.speed = 0.01; // stand still on it
    run(L, s, 2);
    expect(s.on).toBe(0);
    run(L, s, 60);
    expect(s.moverD[0]).toBeGreaterThan(0.3);
    expect(s.y).toBeLessThan(m.y - 0.3);
    s.x = 2;
    s.y = 0;
    run(L, s, 240);
    expect(s.moverD[0]).toBe(0);
  });
  it('a swaying plank carries the sprite with it', () => {
    const L = mini((b) => b.planks(3, { sway: 0.6 }));
    const s = newSim(L);
    const m = L.movers[1];
    Object.assign(s, { x: (m.x0 + m.x1) / 2 + moverOffset(m, 0), y: m.y, grounded: false });
    s.speed = 0;
    run(L, s, 2);
    const x0 = s.x;
    const o0 = moverOffset(m, s.et);
    run(L, s, 20);
    expect(s.on).toBe(1);
    expect(s.x - x0).toBeCloseTo(moverOffset(m, s.et) - o0, 1);
  });
});

describe('ropes and the crocodile', () => {
  const L = mini((b) => b.ropes(2));
  it('the sprite grabs a rope in the air, swings until a tap, then flies on', () => {
    const r = L.ropes[0];
    const s = newSim(L);
    Object.assign(s, { x: r.x - 0.2, y: r.y - 4, vx: 4, vy: 0, grounded: false });
    run(L, s, 1);
    expect(s.rope).toBe(0);
    run(L, s, 90);
    expect(s.rope).toBe(0); // no tap, still swinging
    expect(Math.hypot(s.x - r.x, s.y + 1 - r.y)).toBeCloseTo(s.ropeL, 1);
    run(L, s, 1, () => press);
    expect(s.rope).toBe(-1);
    expect(s.flyVX).not.toBe(0);
  });
  it('falling into the crocodile lake costs a heart and returns to the last checkpoint', () => {
    const w = L.water[0];
    const s = newSim(L);
    Object.assign(s, { x: (w.x0 + w.x1) / 2, y: 2, grounded: false, vy: 0 });
    let croc = false;
    for (let i = 0; i < 120 && !croc; i++) {
      step(L, s, NO_INPUT);
      croc = s.events.includes('croc');
    }
    expect(croc).toBe(true);
    expect(s.hearts).toBe(2);
    expect(s.x).toBeCloseTo(s.cpX);
  });
  it('a plain pit costs a heart too (every death goes the same way)', () => {
    const L2 = mini((b) => b.gap(8));
    const s = newSim(L2);
    for (let i = 0; i < 400 && !s.events.includes('die'); i++) step(L2, s, NO_INPUT);
    expect(s.events).toContain('fall');
    expect(s.hearts).toBe(2);
  });
});

describe('logs, lily pads, bouncy mushrooms', () => {
  it('drifting logs move deterministically with the world clock', () => {
    const L = mini((b) => b.logs(3));
    expect(moverOffset(L.movers[0], 100)).toBeCloseTo(moverOffset(L.movers[0], 100));
    expect(moverOffset(L.movers[0], 0)).not.toBeCloseTo(moverOffset(L.movers[0], 40));
  });
  it('some lily pads sink, stepping stones never do', () => {
    const L = mini((b) => b.lily(6, { sinkEvery: 1 }));
    expect(L.movers.some((m) => m.kind === 'lily' && m.sinkAfter > 0)).toBe(true);
    expect(L.movers.filter((m) => m.kind === 'stone').every((m) => m.sinkAfter === 0)).toBe(true);
  });
  it('landing on a big mushroom launches the sprite high', () => {
    const L = mini((b) => b.shrooms(2));
    const m = L.movers[0];
    const s = newSim(L);
    Object.assign(s, { x: (m.x0 + m.x1) / 2, y: m.y + 0.5, grounded: false, vy: -2 });
    let bounced = false;
    for (let i = 0; i < 30 && !bounced; i++) {
      step(L, s, NO_INPUT);
      bounced = s.events.includes('bounce');
    }
    expect(bounced).toBe(true);
    expect(s.vy).toBeCloseTo(m.bounce!, 0);
  });
});

describe('wind, collapsing bridge, chase, glide', () => {
  it('a gust pushes a jump forward (or back) while it blows', () => {
    const L = mini((b) => b.wind(40, 1, { strength: 2, period: 2, phase: 0 }).ground(40));
    const z = L.zones[0];
    let on = -1,
      off = -1;
    for (let et = 0; et < 200 && (on < 0 || off < 0); et++) {
      if (gustOn(z, et)) on = on < 0 ? et : on;
      else off = off < 0 ? et : off;
    }
    const jumpAt = (et: number) => {
      const s = newSim(L);
      Object.assign(s, { x: z.x0 + 5, et, vy: 5, grounded: false });
      step(L, s, NO_INPUT);
      return s.vx;
    };
    expect(jumpAt(on - 1)).toBeCloseTo(L.speed + 2, 5);
    expect(jumpAt(off - 1)).toBeCloseTo(L.speed, 5);
  });
  it('an old bridge breaks behind the sprite and the run speeds up', () => {
    const L = mini((b) => b.collapse(16));
    const z = L.zones[0];
    const s = newSim(L);
    run(L, s, 400, (q) => (q.x > z.x0 + 10 ? NO_INPUT : NO_INPUT));
    const first = L.boxes.findIndex((b) => b.kind === 'bridge');
    // replay to the middle of the bridge
    const s2 = newSim(L);
    let maxV = 0;
    for (let i = 0; i < 400 && s2.x < z.x0 + 8; i++) {
      step(L, s2, NO_INPUT);
      if (s2.x > z.x0 + 1) maxV = Math.max(maxV, s2.vx);
    }
    expect(bridgeGone(L, s2, first)).toBe(true);
    expect(maxV).toBeCloseTo(Math.min(P.MAX_SPEED, L.speed * P.BOOST), 5);
    expect(s.mode).not.toBe('lost');
  });
  it('the boar catches a sprite that is held up, and gives up at the fence', () => {
    const L = mini((b) => {
      b.chase(30);
      b.ground(6).level.boxes.push({ x0: b.x, x1: b.x + 1, y0: 0, y1: 3, kind: 'stump' });
      b.ground(30);
    });
    const s = newSim(L);
    run(L, s, 600);
    expect(s.hearts).toBeLessThan(3); // stood against the tall stump: bumped
    const L2 = mini((b) => b.chase(30).ground(40));
    const s2 = newSim(L2);
    run(L2, s2, 900);
    expect(s2.hearts).toBe(3);
    expect(s2.boarDone).toBe(true);
    expect(s2.boarX).toBeCloseTo(L2.zones[0].x1 - 1.2);
  });
  it('dandelion seeds: holding the finger glides, letting go falls', () => {
    const L = mini((b) => b.glide(14));
    const z = L.zones[0];
    const fall = (inp: Input) => {
      const s = newSim(L);
      Object.assign(s, { x: z.x0 + 6, y: 2, grounded: false, vy: -3 });
      run(L, s, 30, () => inp);
      return s.vy;
    };
    expect(fall(hold)).toBeCloseTo(-P.GLIDE_FALL, 5);
    expect(fall(NO_INPUT)).toBeLessThan(-P.GLIDE_FALL * 3);
  });
});

describe('every set piece can be beaten by the level bot, at level-1 speed and at the speed cap', () => {
  const pieces: [string, (b: LevelBuilder) => void][] = [
    ['planks', (b) => b.planks(5, { sway: 0.5, sink: 0.45 })],
    ['ropes', (b) => b.ropes(4)],
    ['logs', (b) => b.logs(4, { croc: true })],
    ['lily', (b) => b.lily(7, { sinkEvery: 1 })],
    ['shrooms', (b) => b.shrooms(3)],
    ['wind', (b) => b.wind(30, -1).ground(4).gap(2.4).ground(5).stump(0.9).gap(2.4).ground(6)],
    ['collapse', (b) => b.collapse(20)],
    ['chase', (b) => b.chase(40).ground(6).stump(0.9).ground(6).lowLog(3).ground(4).stump(0.9).ground(8)],
    ['cave', (b) => b.cave(30).ground(4).stump(0.9).ground(4).gap(2.4).ground(8)],
    ['waterfall', (b) => b.waterfall(true)],
    ['glide', (b) => b.glide(16)],
  ];
  for (const [name, f] of pieces)
    for (const v of [P.RUN, P.MAX_SPEED])
      it(`${name} at ${v.toFixed(1)} u/s`, () => {
        const L = mini(f, v);
        const p = solve(L);
        expect(p.final.mode).toBe('won');
        expect(p.final.hearts).toBe(3);
      }, 30_000);
});
