/**
 * After a lost heart (respawn) or the rewarded "continue with 1 heart" (revive), everything from the checkpoint on is
 * back in its first state: collapsing bridges whole (Bug 2), the boar chase starting again behind the sprite (Bug 3),
 * sunk platforms risen, no rope held. The boar is never in front of the sprite. (The full sweep over every level is
 * scripts/death-check.ts, `npm run check:deaths`.)
 */
import { describe, expect, it, vi } from 'vitest';
import { Replay, solve } from '../../src/game/bot';
import { levelById } from '../../src/game/levels';
import { bridgeGone, choose, cloneSim, newSim, NO_INPUT, revive, step, type SimState } from '../../src/game/sim';
import type { Level } from '../../src/game/types';

vi.setConfig({ testTimeout: 180_000 });
const plans = new Map<string, ReturnType<typeof solve>>();
/** the bot's run through a level up to the first tick where `cond` holds */
function playUntil(L: Level, cond: (s: SimState) => boolean) {
  let plan = plans.get(L.id);
  if (!plan) plans.set(L.id, (plan = solve(L)));
  expect(plan.ok).toBe(true);
  const s = newSim(L);
  const rp = new Replay(plan);
  for (let t = 0; t < 60 * 300 && !cond(s); t++) {
    if (s.mode === 'decide') choose(L, s, rp.choice()!);
    else step(L, s, rp.input(s));
  }
  expect(cond(s)).toBe(true);
  return s;
}
/** drop the sprite into a pit right here */
function fall(L: Level, s0: SimState, lastHeart = false) {
  const s = cloneSim(s0);
  if (lastHeart) s.hearts = 1;
  s.rope = -1;
  s.grounded = false;
  s.y = L.killY - 0.5;
  step(L, s, NO_INPUT);
  return s;
}
const finishable = (L: Level, s: SimState) => solve(L, { from: s, needAcorns: 0, width: 48 }).ok;
const anyGone = (L: Level, s: SimState) => L.boxes.some((b, i) => b.kind === 'bridge' && bridgeGone(L, s, i));

describe('Bug 2: a collapsing bridge is whole again after a death', () => {
  const L = levelById('1-4')!;
  const zi = L.zones.findIndex((z) => z.kind === 'collapse');
  const z = L.zones[zi];
  const after = (s: SimState) => s.mode === 'run' && s.grounded && s.x > z.x1 + 0.5;

  it('respawn: the bridge is whole, collapses again when crossed, and the level can be finished', () => {
    const s0 = playUntil(L, after);
    expect(s0.zoneX[zi]).toBeGreaterThan(-1e8);
    expect(anyGone(L, s0)).toBe(true);
    const s = fall(L, s0);
    expect(s.events).toContain('respawn');
    expect(s.x).toBeLessThan(z.x0);
    expect(s.zoneX[zi]).toBe(-1e9);
    expect(anyGone(L, s)).toBe(false);
    expect(finishable(L, s)).toBe(true);
  });

  it('revive: the same after the last heart and "continue with 1 heart"', () => {
    const s = fall(L, playUntil(L, after), true);
    expect(s.mode).toBe('lost');
    revive(L, s);
    expect(s.mode).toBe('run');
    expect(s.zoneX[zi]).toBe(-1e9);
    expect(anyGone(L, s)).toBe(false);
    expect(finishable(L, s)).toBe(true);
  });
});

describe('Bug 3: the boar starts again behind the sprite, and never gets in front of it', () => {
  const L = levelById('1-7')!;
  const z = L.zones.find((q) => q.kind === 'chase')!;
  const inChase = (s: SimState) => s.mode === 'run' && s.grounded && !Number.isNaN(s.boarX) && !s.boarDone && s.x > (z.x0 + z.x1) / 2;

  it('respawn and revive inside the chase reset it; it starts again behind the sprite', () => {
    const s0 = playUntil(L, inChase);
    for (const last of [false, true]) {
      const s = fall(L, s0, last);
      if (last) revive(L, s);
      expect(s.mode).toBe('run');
      expect(Number.isNaN(s.boarX)).toBe(true);
      expect(s.boarDone).toBe(false);
      // run on to the chase: the boar appears behind the sprite and stays there
      for (let i = 0; i < 60 * 20 && s.mode === 'run' && Number.isNaN(s.boarX); i++) step(L, s, NO_INPUT);
      if (!Number.isNaN(s.boarX)) expect(s.boarX).toBeLessThan(s.x);
    }
  });

  it('a hit by the boar knocks both back; the boar stays behind the sprite all through the knockback', () => {
    const s = cloneSim(playUntil(L, (q) => inChase(q) && q.invuln <= 0));
    s.boarX = s.x - 0.4;
    step(L, s, NO_INPUT);
    expect(s.events).toContain('hit');
    for (let i = 0; i < 60 && s.mode === 'run'; i++) {
      expect(s.boarX).toBeLessThan(s.x);
      step(L, s, NO_INPUT);
    }
  });

  it('the boar never overtakes an invulnerable sprite (it stays on its heels)', () => {
    const s = cloneSim(playUntil(L, inChase));
    s.invuln = 2;
    s.boarX = s.x + 0.3;
    step(L, s, NO_INPUT);
    expect(s.boarX).toBeLessThanOrEqual(s.x - 0.5 + 1e-9);
  });
});

describe('every other stateful obstacle is reset too', () => {
  it('revive drops the rope, the flight and the glide (it used to keep them: back on the rope at the checkpoint)', () => {
    const L = levelById('1-7')!;
    const s = cloneSim(playUntil(L, (q) => q.rope >= 0));
    s.hearts = 0;
    s.mode = 'lost';
    revive(L, s);
    expect(s.rope).toBe(-1);
    expect(s.flyVX).toBe(0);
    expect(s.gliding).toBe(false);
    expect(s.x).toBe(s.cpX);
  });

  it('sunk platforms ahead of the checkpoint have risen again', () => {
    const L = levelById('3-4')!;
    const i = L.movers.findIndex((m) => m.sinkAfter > 0);
    const m = L.movers[i];
    const s0 = playUntil(L, (q) => q.mode === 'run' && q.grounded && q.x > m.x1 + 1);
    const s = cloneSim(s0);
    s.moverD[i] = 3;
    const r = fall(L, s);
    if (m.x1 + m.amp > r.cpX) expect(r.moverD[i]).toBe(0);
  });

  it('a bridge or a chase completely behind the checkpoint stays as it is', () => {
    const L = levelById('1-4')!;
    const zi = L.zones.findIndex((z) => z.kind === 'collapse');
    const s = cloneSim(playUntil(L, (q) => q.mode === 'run' && q.grounded && q.x > L.zones[zi].x1 + 0.5));
    s.cpX = L.zones[zi].x1 + 0.2;
    s.cpY = 0;
    const r = fall(L, s);
    expect(r.zoneX[zi]).toBe(s.zoneX[zi]);
  });
});
