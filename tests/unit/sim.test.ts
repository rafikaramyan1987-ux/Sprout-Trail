import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../../src/game/build';
import { newSim, step, choose, NO_INPUT, cloneSim, type Input } from '../../src/game/sim';
import { solve, tryCard } from '../../src/game/bot';
import { allLevels, level } from '../../src/game/levels';
import { generateLevel, levelSpeed } from '../../src/game/levels/gen';
import { MAX_SPEED, RUN, viewAhead } from '../../src/game/physics';
import { readability } from '../../src/game/fairness';

const LEVELS = [level(1, 1), level(1, 2), level(1, 3)];

const flat = () => new LevelBuilder('t', 1, 1, 0).ground(300).goal().done();
const jump = (held: number) => (i: number): Input => ({ jumpPressed: i === 0, jumpHeld: i < held, duckPressed: false, duckHeld: false });

function peak(held: number) {
  const L = flat();
  const s = newSim(L);
  let top = 0;
  for (let i = 0; i < 120; i++) {
    step(L, s, jump(held)(i));
    top = Math.max(top, s.y);
  }
  return top;
}

describe('physics', () => {
  it('the sprite runs by itself', () => {
    const L = flat();
    const s = newSim(L);
    for (let i = 0; i < 60; i++) step(L, s, NO_INPUT);
    expect(s.x - L.startX).toBeGreaterThan(4);
    expect(s.grounded).toBe(true);
  });
  it('holding jump jumps higher than a tap', () => {
    const tap = peak(1);
    const hold = peak(30);
    expect(tap).toBeGreaterThan(1.3);
    expect(tap).toBeLessThan(2);
    expect(hold).toBeGreaterThan(tap + 1);
  });
  it('ducking slides under a low log; standing is blocked', () => {
    const L = new LevelBuilder('t', 1, 1, 0).ground(4).lowLog(3, 1, 20).goal().done();
    const a = newSim(L);
    for (let i = 0; i < 200; i++) step(L, a, NO_INPUT);
    expect(a.x).toBeLessThan(L.boxes.find((b) => b.kind === 'log')!.x0);
    const b = newSim(L);
    for (let i = 0; i < 200; i++) step(L, b, { jumpPressed: false, jumpHeld: false, duckPressed: false, duckHeld: true });
    expect(b.x).toBeGreaterThan(L.boxes.find((x) => x.kind === 'log')!.x1);
  });
  it('is deterministic', () => {
    const L = LEVELS[0];
    const run = () => {
      const s = newSim(L);
      for (let i = 0; i < 900; i++) step(L, s, jump(i % 50 < 10 ? 8 : 0)(i % 50));
      return [s.x, s.y, s.gems, s.hearts];
    };
    expect(run()).toEqual(run());
  });
  it('falling costs a heart and returns to the last checkpoint', () => {
    const L = new LevelBuilder('t', 1, 1, 0).ground(6).checkpoint().ground(4).gap(8).ground(10).goal().done();
    const s = newSim(L);
    let fell = false;
    for (let i = 0; i < 400 && !fell; i++) {
      step(L, s, NO_INPUT);
      fell = s.events.includes('fall');
    }
    expect(fell).toBe(true);
    expect(s.x).toBeCloseTo(L.checkpoints[0].x);
    expect(s.hearts).toBe(2);
  });
});

describe('decision points', () => {
  const L = new LevelBuilder('t', 1, 1, 3).ground(6).decision('river', 5.5, ['bridge', 'vine', 'mushroom'], 'bridge').ground(20).goal().done();
  const atDp = () => {
    const s = newSim(L);
    for (let i = 0; i < 600 && s.mode !== 'decide'; i++) step(L, s, NO_INPUT);
    return s;
  };
  it('the sprite stops by itself in front of the obstacle', () => {
    const s = atDp();
    expect(s.mode).toBe('decide');
    expect(s.x).toBeCloseTo(L.dps[0].stopX);
  });
  it('a wrong plant fails, costs a seed and lets the player choose again', () => {
    const s = atDp();
    const r = tryCard(L, s, 'vine');
    expect(r.res.ok).toBe(false);
    expect(r.s.mode).toBe('decide');
    expect(r.s.seeds).toBe(2);
    expect(r.s.hearts).toBe(3);
  });
  it('the right plant crosses', () => {
    const s = atDp();
    expect(tryCard(L, s, 'bridge').res.ok).toBe(true);
  });
  it('cannot plant without seeds or a card that is not offered', () => {
    const s = cloneSim(atDp());
    expect(choose(L, s, 'leaf')).toBe(false);
    s.seeds = 0;
    expect(choose(L, s, 'bridge')).toBe(false);
  });
});

describe('levels', () => {
  for (const L of LEVELS)
    it(`${L.id} is solvable with all 3 acorns, and only the answer works at each decision point`, () => {
      const p = solve(L);
      expect(p.ok).toBe(true);
      expect(p.final.acorns).toBe(3);
      expect(p.dps.length).toBe(L.dps.length);
      for (const d of p.dps) for (const c of d.cards) expect(c.ok).toBe(c.kind === d.answer);
    }, 60_000);
  it('every level has 3 golden acorns', () => {
    for (const L of LEVELS) expect(L.pickups.filter((p) => p.kind === 'acorn').length).toBe(3);
  });
});

describe('speed', () => {
  it('starts faster in later worlds and never above 1.5x level 1', () => {
    expect(levelSpeed(1, 1)).toBeCloseTo(RUN);
    expect(levelSpeed(3, 1)).toBeGreaterThan(levelSpeed(2, 1));
    for (const L of allLevels()) expect(L.speed).toBeLessThanOrEqual(MAX_SPEED);
    expect(MAX_SPEED).toBeCloseTo(RUN * 1.5);
  });
  it('grows at each checkpoint flower and is capped', () => {
    const b = new LevelBuilder('t', 1, 1, 0, 1, 6.8, 0.05).ground(10);
    for (let i = 0; i < 4; i++) b.checkpoint().ground(10);
    const L = b.goal().done();
    const s = newSim(L);
    for (let i = 0; i < 60 * 15 && s.mode === 'run'; i++) step(L, s, NO_INPUT);
    expect(s.speed).toBeCloseTo(MAX_SPEED);
  });
  it('the camera look-ahead gives more than 1 s at every speed', () => {
    for (let v = RUN; v <= MAX_SPEED; v += 0.1) expect(viewAhead(v) / v).toBeGreaterThan(1.2);
  });
});

describe('generated levels', () => {
  it('are deterministic', () => {
    expect(JSON.stringify(generateLevel(3, 7, 5))).toBe(JSON.stringify(generateLevel(3, 7, 5)));
  });
  it('have exactly 3 golden acorns and later levels have more hazards', () => {
    for (const L of allLevels()) expect(L.pickups.filter((p) => p.kind === 'acorn').length).toBe(3);
    const count = (L: ReturnType<typeof level>) => L.enemies.length + L.hazards.length + L.boxes.filter((b) => b.kind === 'log' || b.kind === 'stump').length;
    expect(count(level(2, 12))).toBeGreaterThan(count(level(2, 2)));
  });
  it('a world-4 level is beatable and every hazard is on screen at least 1 s before it is reached', () => {
    const L = level(4, 6);
    const p = solve(L);
    expect(p.ok).toBe(true);
    expect(p.final.hearts).toBeGreaterThan(0);
    for (const r of readability(L, p)) expect(r.seconds).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
