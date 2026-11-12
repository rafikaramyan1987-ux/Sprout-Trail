/**
 * Tests for everything the human-limited playtest found (docs/playtest-report.md): dying costs exactly one heart,
 * bouncy mushroom chains cross by themselves, golden acorns a human can collect, the camera always shows the trail
 * ahead, and the playtester itself refuses frame-perfect play.
 */
import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../../src/game/build';
import { newSim, NO_INPUT, step, type Input, type SimState } from '../../src/game/sim';
import { solve } from '../../src/game/bot';
import { playHuman } from '../../src/game/human';
import { dpFrame, keepAhead } from '../../src/play/camera';
import * as P from '../../src/game/physics';
import type { Level } from '../../src/game/types';

const run = (L: Level, s: SimState, ticks: number, inp: (s: SimState, i: number) => Input = () => NO_INPUT) => {
  const events: string[] = [];
  for (let i = 0; i < ticks && s.mode === 'run'; i++) {
    step(L, s, inp(s, i));
    events.push(...s.events);
  }
  return events;
};
const count = (ev: string[], e: string) => ev.filter((x) => x === e).length;
/** a short level with easy golden acorns at the end (three, or fewer when the piece has its own) */
const mini = (f: (b: LevelBuilder) => void, speed = P.RUN, easy = 3) => {
  const b = new LevelBuilder('t', 1, 1, 0, 1, speed, 0);
  b.ground(10);
  f(b);
  for (let i = 0; i < easy; i++) b.ground(2).acorn(2, 0.5).ground(1);
  b.ground(10);
  return b.goal().done();
};

describe('dying costs exactly one heart (one shared path)', () => {
  const pit = () => new LevelBuilder('t', 1, 1, 0).ground(6).checkpoint().ground(4).gap(8).ground(10).goal().done();

  it('a fall costs one heart and respawns at the last checkpoint', () => {
    const L = pit();
    const s = newSim(L);
    const ev = run(L, s, 400, () => NO_INPUT);
    // the sprite keeps running into the pit: stop after the first death
    expect(count(ev, 'die')).toBeGreaterThanOrEqual(1);
    const s2 = newSim(L);
    let died = false;
    for (let i = 0; i < 400 && !died; i++) {
      step(L, s2, NO_INPUT);
      died = s2.events.includes('die');
      if (died) {
        expect(s2.events).toContain('fall');
        expect(s2.events).toContain('respawn');
      }
    }
    expect(died).toBe(true);
    expect(s2.hearts).toBe(2);
    expect(s2.x).toBeCloseTo(L.checkpoints[0].x);
    expect(s2.y).toBeCloseTo(L.checkpoints[0].y);
    expect(s2.deathX).toBeGreaterThan(10);
    expect(s2.mode).toBe('run');
  });

  it('the last heart lost to a fall ends the level', () => {
    const L = pit();
    const s = newSim(L);
    s.hearts = 1;
    const ev = run(L, s, 400);
    expect(s.mode).toBe('lost');
    expect(s.hearts).toBe(0);
    expect(count(ev, 'die')).toBe(1);
    expect(count(ev, 'lose')).toBe(1);
  });

  it('three falls in a row lose the level with exactly three hearts', () => {
    const L = pit();
    const s = newSim(L);
    const ev = run(L, s, 60 * 30);
    expect(s.mode).toBe('lost');
    expect(count(ev, 'die')).toBe(3);
  });

  it('the crocodile costs exactly one heart', () => {
    const L = mini((b) => b.checkpoint().ground(2).ropes(3, { croc: true }));
    const s = newSim(L);
    // no input: the sprite runs into the lake
    let ev: string[] = [];
    for (let i = 0; i < 600 && !ev.includes('croc'); i++) {
      step(L, s, NO_INPUT);
      ev = [...s.events];
    }
    expect(ev).toContain('croc');
    expect(ev).toContain('die');
    expect(count(ev, 'hit')).toBe(0);
    expect(s.hearts).toBe(2);
    expect(s.x).toBeCloseTo(L.checkpoints[0].x);
  });

  it('a fall during the knockback of a hit costs only that one heart in total', () => {
    // a bee over the middle of a wide pit: hit in mid-air, the sprite is knocked back and falls into the pit
    const b = new LevelBuilder('t', 1, 1, 0).ground(6).checkpoint().ground(4);
    const edge = b.x;
    const L = b.enemy('bee', 2.5, 0, 0, { y: 1.1, amp: 0 }).gap(6).ground(10).goal().done();
    const s = newSim(L);
    Object.assign(s, { x: edge + 1.9, y: 0.9, vy: 0, grounded: false });
    const ev: string[] = [];
    for (let i = 0; i < 240 && !ev.includes('die'); i++) {
      step(L, s, NO_INPUT);
      ev.push(...s.events);
    }
    expect(count(ev, 'hit')).toBe(1);
    expect(count(ev, 'die')).toBe(1);
    expect(s.hearts).toBe(2);
    expect(s.x).toBeCloseTo(L.checkpoints[0].x);
  });

  it('a wrong plant at a decision point costs the seed, not a heart', () => {
    const L = new LevelBuilder('t', 1, 1, 3).ground(6).decision('river', 5.5, ['bridge', 'vine'], 'bridge').ground(20).goal().done();
    const s = newSim(L);
    for (let i = 0; i < 600 && s.mode !== 'decide'; i++) step(L, s, NO_INPUT);
    const h = playHuman(L);
    expect(h.dps[0].cards.find((c) => c.kind === 'vine')!.ok).toBe(false);
    expect(s.hearts).toBe(3);
  });
});

describe('bouncy mushroom chains cross with no input at all', () => {
  for (const n of [2, 3, 4])
    for (const v of [P.RUN, P.MAX_SPEED])
      it(`${n} mushrooms at ${v.toFixed(1)} u/s`, () => {
        const L = mini((b) => b.shrooms(n), v);
        const s = newSim(L);
        const ev = run(L, s, 60 * 30);
        expect(s.mode).toBe('won');
        expect(count(ev, 'die')).toBe(0);
        expect(count(ev, 'bounce')).toBe(n);
        expect(s.hearts).toBe(3);
      });

  it('keeping the finger down on landing bounces a little higher, to the same place', () => {
    const L = mini((b) => b.shrooms(3));
    const plain = newSim(L);
    const held = newSim(L);
    let topPlain = -99,
      topHeld = -99;
    for (let i = 0; i < 60 * 20 && plain.mode === 'run'; i++) {
      step(L, plain, NO_INPUT);
      topPlain = Math.max(topPlain, plain.y);
    }
    for (let i = 0; i < 60 * 20 && held.mode === 'run'; i++) {
      step(L, held, { jumpPressed: false, jumpHeld: true, duckPressed: false, duckHeld: false });
      topHeld = Math.max(topHeld, held.y);
    }
    expect(plain.mode).toBe('won');
    expect(held.mode).toBe('won');
    expect(topHeld).toBeGreaterThan(topPlain + 0.2);
  });

  it('the human-limited player crosses a chain with an acorn on it and gets the acorn', () => {
    const L = mini((b) => b.shrooms(3, { acornAt: 1 }), P.RUN, 2);
    const h = playHuman(L);
    expect(h.ok).toBe(true);
    expect(h.final.acorns).toBe(3);
  });
});

describe('golden acorns a human can collect', () => {
  const human = (L: Level) => {
    const h = playHuman(L);
    const acorns = L.pickups.map((p, i) => (p.kind === 'acorn' ? i : -1)).filter((i) => i >= 0);
    return { h, all: acorns.every((i) => h.final.got[i]) && h.lucky === 0 };
  };
  for (const v of [P.RUN, P.MAX_SPEED]) {
    it(`a hanging-plank acorn (in the hop between two planks) at ${v.toFixed(1)} u/s`, () => {
      const { h, all } = human(mini((b) => b.planks(6, { acornAt: 2, sway: 0.5, gap: 2.2 }), v, 2));
      expect(h.ok).toBe(true);
      expect(all).toBe(true);
    }, 30_000);
    it(`a lily-pad acorn (in the hop to the next pad) at ${v.toFixed(1)} u/s`, () => {
      const { h, all } = human(mini((b) => b.lily(7, { acornAt: 3, sinkEvery: 2, sinkAfter: 0.4 }), v, 2));
      expect(h.ok).toBe(true);
      expect(all).toBe(true);
    }, 30_000);
  }
  it('an acorn high above the trail leaves room to land before the next pit', () => {
    const { h, all } = human(mini((b) => b.ground(2).acorn(2.5, 3.4).ground(8).gap(2.4).ground(6), P.MAX_SPEED, 2));
    expect(h.ok).toBe(true);
    expect(all).toBe(true);
  }, 30_000);
  it('a ledge acorn near the far end of the ledge', () => {
    const { h, all } = human(mini((b) => b.ground(1).ledge(2.5, 2.6, 5).acorn(5.6, 3.6).ground(11), P.MAX_SPEED, 2));
    expect(h.ok).toBe(true);
    expect(all).toBe(true);
  }, 30_000);
});

describe('the camera always shows the trail ahead', () => {
  it('a decision point shot already shows viewAhead past the exit', () => {
    for (const v of [P.RUN, P.MAX_SPEED]) {
      const f = dpFrame(100, 108, v);
      expect(f.right).toBeGreaterThanOrEqual(108 + P.viewAhead(v));
      expect(f.left).toBeLessThan(100);
    }
  });
  it('keepAhead moves a lagging camera so that viewAhead is on screen, and never moves one that is ahead', () => {
    const need = P.viewAhead(P.MAX_SPEED);
    const x = 50;
    const camX = keepAhead(45, 0.5, 12, x, need);
    expect(camX + 0.5 * 12).toBeCloseTo(x + need);
    expect(keepAhead(80, 0.3, 20, x, need)).toBe(80);
  });
});

describe('the human-limited playtester', () => {
  it('refuses a jump that needs frame-perfect timing (the bot still makes it)', () => {
    // the widest pit the frame-perfect bot can still clear at level-1 speed
    let widest = 0;
    for (let w = 4.0; w <= 7.0; w += 0.1) {
      const L = mini((b) => b.gap(w));
      if (solve(L, { width: 60 }).ok) widest = w;
      else break;
    }
    expect(widest).toBeGreaterThan(4);
    expect(playHuman(mini((b) => b.gap(widest))).finished).toBe(false);
    expect(playHuman(mini((b) => b.gap(widest - 1.2))).ok).toBe(true);
  }, 60_000);

  it('the recorded human run replays to the same win', () => {
    const L = mini((b) => b.gap(2.4).ground(6).stump(0.9).ground(6).lowLog(3).ground(6));
    const h = playHuman(L);
    expect(h.ok).toBe(true);
    const s = newSim(L);
    let k = 0;
    for (let i = 0; i < 60 * 60 && s.mode === 'run'; i++) step(L, s, h.inputs[k++] ?? NO_INPUT);
    expect(s.mode).toBe('won');
    expect(s.acorns).toBe(3);
  });
});
