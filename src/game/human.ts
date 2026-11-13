/**
 * The "player-real" playtester: plays a level with only what a human has, on the real simulation at the level's
 * real speed.
 *
 * - Inputs: tap (jump, finger down 0.1 s), full jump (finger down 0.45 s), glide (keep the finger down until
 *   landing), swipe down (duck), and picking a seed card at a decision point. Nothing else.
 * - Timing tolerance: every press is also played 0.05 s and 0.1 s early and late, and taps / holds with the
 *   finger lifted 0.1 s earlier or later. A press is only used when every one of those variants survives (no
 *   heart lost, no fall, no crocodile) and collects the same golden acorns, so nothing needs frame-perfect timing.
 * - Reaction time: at least 0.25 s between two presses, 0.2 s after the finger was lifted, and 0.25 s after
 *   anything the player has to react to (a hit, a respawn, the end of a crossing).
 * - No hidden state: the plan only depends on the level as it is drawn; the level validator separately checks
 *   that everything the player must dodge is on screen at least 1 s before it has to be dodged.
 *
 * The search is a beam search over these human actions on a 0.1 s grid. A level passes only if the playtester
 * finishes it with all three golden acorns within its hearts and seeds.
 */
import * as P from './physics';
import { cloneSim, newSim, NO_INPUT, step, zoneAt, type Input, type SimState } from './sim';
import { tryCard, type DpReport } from './bot';
import type { Level, PlantKind } from './types';

export const HUMAN = {
  /** seconds between presses / after a surprise */
  reaction: 0.25,
  /** every press and release can be this much early or late (s) */
  jitter: 0.1,
  /** a tap keeps the finger down this long (s) */
  tap: 0.1,
  /** a full jump keeps the finger down this long (s) */
  hold: 0.45,
  /** the finger is lifted again at least this long before the next press (s) */
  lift: 0.2,
};

const SLICE = 6;
const T = (s: number) => Math.round(s * 60);
const REACT = T(HUMAN.reaction);
const JIT = T(HUMAN.jitter);
const LIFT = T(HUMAN.lift);
const TAP = T(HUMAN.tap);
const HOLD = T(HUMAN.hold);
const GLIDE_MAX = T(3);

export type Press = 'tap' | 'hold' | 'glide' | 'swipe';

interface Node {
  s: SimState;
  /** ticks of the last press start / finger lift / surprise */
  lp: number;
  lr: number;
  react: number;
  inputs: Input[];
  choice: PlantKind[] | null;
  press: { kind: Press; tick: number; x: number } | null;
  parent: Node | null;
  presses: number;
  checked: boolean;
  /** golden acorns this run only got with lucky timing (a human cannot count on them) */
  lucky: number;
  luckyAt: number[];
}

export interface Prune {
  x: number;
  why: string;
  /** how many rejected runs had this reason (summaries) */
  n?: number;
}

export interface HumanResult {
  ok: boolean;
  /** finished, maybe without all acorns */
  finished: boolean;
  inputs: Input[];
  choices: PlantKind[];
  presses: { kind: Press; tick: number; x: number }[];
  final: SimState;
  dps: DpReport[];
  seconds: number;
  heartsLost: number;
  /** golden acorns of the final run that need lucky timing (not counted), and where they are */
  lucky: number;
  luckyAt: number[];
  /** furthest x a human-safe run reached */
  maxX: number;
  /** why the runs that got furthest were rejected */
  stuck: Prune[];
}

/** the inputs of one press, tick by tick (`len` ticks of finger down, then up) */
function pressInputs(kind: Press, len: number): Input[] {
  const out: Input[] = [];
  for (let i = 0; i < len; i++) {
    if (kind === 'swipe') out.push({ jumpPressed: false, jumpHeld: false, duckPressed: i === 0, duckHeld: true });
    else out.push({ jumpPressed: i === 0, jumpHeld: true, duckPressed: false, duckHeld: false });
  }
  return out;
}
const pressLen = (kind: Press) => (kind === 'tap' ? TAP : kind === 'hold' ? HOLD : kind === 'swipe' ? TAP : GLIDE_MAX);

const bad = (s: SimState) => s.events.includes('fall') || s.events.includes('croc') || (s.events as string[]).includes('die') || s.mode === 'lost';

/**
 * Plays a press from state `s` (in run mode): `wait` ticks of nothing, then the press with the finger down for
 * `len` ticks (a glide lifts the finger on landing), then nothing until the sprite has settled (stands, hangs on a
 * rope, reaches a decision point or the goal) or `horizon` ticks are over. Returns the outcome.
 */
function playPress(level: Level, s0: SimState, kind: Press, wait: number, len: number, horizon: number) {
  const s = cloneSim(s0);
  const h0 = s.hearts;
  let died = '';
  let t = 0;
  const run = (inp: Input) => {
    step(level, s, s.mode === 'run' ? inp : NO_INPUT);
    if (bad(s) && !died) died = s.events.includes('croc') ? 'crocodile' : s.mode === 'lost' ? 'out of hearts' : 'fell';
    if (s.hearts < h0 && !died) died = 'hit';
    t++;
  };
  for (let i = 0; i < wait && !died && s.mode === 'run'; i++) run(NO_INPUT);
  const inp = pressInputs(kind, len);
  let landed = 0;
  for (let i = 0; i < len && !died && s.mode === 'run'; i++) {
    run(inp[i]);
    if (kind === 'glide' && i > 6 && (s.grounded || s.rope >= 0)) break;
  }
  while (!died && s.mode === 'run' && t < horizon) {
    run(NO_INPUT);
    if (s.grounded || s.rope >= 0) landed++;
    else landed = 0;
    if (landed >= 2) break;
  }
  return { s, died };
}

/**
 * A press is human-safe when every early / late / shorter / longer variant survives (returns why not, or ''); `lucky`
 * is set when a golden acorn it collects is missed by some of the variants.
 */
function robust(level: Level, before: SimState, kind: Press, nominal: SimState, out: { lucky: boolean }): string {
  const len = pressLen(kind);
  const horizon = len + T(2);
  const base = playPress(level, before, kind, JIT, len, horizon + JIT);
  if (base.died) return base.died;
  const need = Math.max(base.s.acorns, nominal.acorns);
  const variants: [number, number][] = [
    [0, len],
    [JIT / 2, len],
    [JIT + JIT / 2, len],
    [2 * JIT, len],
  ];
  if (kind === 'tap') variants.push([JIT, 2], [JIT, TAP + JIT]);
  if (kind === 'hold') variants.push([JIT, HOLD - JIT], [JIT, HOLD + JIT]);
  for (const [w, l] of variants) {
    const v = playPress(level, before, kind, w, l, horizon + JIT);
    if (v.died) return `${v.died} when pressed ${w < JIT ? 'early' : w > JIT ? 'late' : l < len ? 'shorter' : 'longer'}`;
    // a variant that landed earlier runs on (no input) to where the nominal run settled before acorns are compared
    for (let i = 0; i < 60 && v.s.acorns < need && v.s.x < base.s.x + 0.05 && v.s.mode === 'run'; i++) {
      step(level, v.s, NO_INPUT);
      if (bad(v.s)) break;
    }
    if (v.s.acorns < need) out.lucky = true;
  }
  return '';
}

/** golden acorns a human can count on */
const sure = (n: Node) => n.s.acorns - n.lucky;
function score(n: Node) {
  const s = n.s;
  return s.x + sure(n) * 60 + s.gems * 0.3 - (3 - s.hearts) * 40 - n.presses * 0.1;
}

/** something to duck under or an enemy is close ahead */
function duckable(level: Level, x: number) {
  const far = x + 9;
  return level.enemies.some((e) => Math.max(e.x0, e.x1) > x - 2 && Math.min(e.x0, e.x1) < far) || level.boxes.some((b) => b.kind === 'log' && b.x1 > x - 1 && b.x0 < far);
}

export function playHuman(
  level: Level,
  opts: {
    width?: number;
    maxSeconds?: number;
    /** start from this state (e.g. right after a respawn) instead of the level start */
    from?: SimState;
    /** golden acorns the run must have at the goal (default 3) */
    needAcorns?: number;
  } = {},
): HumanResult {
  const width = opts.width ?? 48;
  const s0 = opts.from ? cloneSim(opts.from) : newSim(level);
  const need = opts.needAcorns ?? 3;
  const maxTicks = s0.tick + T(opts.maxSeconds ?? 240);
  const dps: DpReport[] = [];
  const start: Node = { s: s0, lp: -999, lr: -999, react: 0, inputs: [], choice: null, press: null, parent: null, presses: 0, checked: true, lucky: 0, luckyAt: [] };
  let beam: Node[] = [start];
  let won: Node | null = null;
  let finished: Node | null = null;
  let best = start;
  let maxX = start.s.x;
  let stuck: Prune[] = [];
  const prunes: Prune[] = [];
  const robustCache = new Map<string, { why: string; lucky: boolean }>();

  while (beam.length && !won) {
    const kids: Node[] = [];
    for (const n of beam) {
      const s0 = n.s;
      if (s0.mode === 'decide') {
        const dp = level.dps[s0.dp];
        let rep = dps.find((r) => r.dp === s0.dp);
        if (!rep) {
          rep = { dp: s0.dp, answer: dp.answer, cards: dp.cards.map((k) => tryCard(level, s0, k).res) };
          dps.push(rep);
        }
        const good = rep.cards.find((c) => c.ok && c.kind === dp.answer) ?? rep.cards.find((c) => c.ok && c.acorn) ?? rep.cards.find((c) => c.ok);
        if (!good) {
          prunes.push({ x: s0.x, why: `decision ${s0.dp + 1}: no seed card crosses` });
          continue;
        }
        const s = tryCard(level, s0, good.kind).s;
        if (s.mode !== 'run' && s.mode !== 'won') continue;
        kids.push({ s, lp: n.lp, lr: n.lr, react: s.tick, inputs: [], choice: [good.kind], press: null, parent: n, presses: n.presses, checked: true, lucky: n.lucky, luckyAt: n.luckyAt });
        continue;
      }
      // wait a slice
      {
        const s = cloneSim(s0);
        const inputs: Input[] = [];
        let react = n.react;
        let died = '';
        let px = s.x;
        for (let i = 0; i < SLICE && s.mode === 'run'; i++) {
          inputs.push(NO_INPUT);
          px = s.x;
          step(level, s, NO_INPUT);
          if (s.events.includes('hit')) react = s.tick;
          if (bad(s)) {
            died = s.events.includes('croc') ? 'crocodile' : 'fell';
            break;
          }
        }
        if (died) prunes.push({ x: px, why: died });
        else kids.push({ s, lp: n.lp, lr: n.lr, react, inputs, choice: null, press: null, parent: n, presses: n.presses, checked: true, lucky: n.lucky, luckyAt: n.luckyAt });
      }
      // press something
      const t0 = s0.tick;
      if (t0 < n.lp + REACT || t0 < n.lr + LIFT || t0 < n.react + REACT || !n.parent || n.parent.s.tick !== t0 - SLICE || n.parent.s.mode !== 'run') continue;
      const kinds: Press[] = ['tap', 'hold'];
      if (zoneAt(level, 'glide', s0.x + P.viewAhead(s0.speed) / 2) >= 0 || zoneAt(level, 'glide', s0.x) >= 0) kinds.push('glide');
      if (duckable(level, s0.x)) kinds.push('swipe');
      for (const kind of kinds) {
        const s = cloneSim(s0);
        const inputs: Input[] = [];
        const pin = pressInputs(kind, pressLen(kind));
        let react = n.react;
        let died = false;
        let i = 0;
        let px = s.x;
        for (; i < pin.length && s.mode === 'run'; i++) {
          inputs.push(pin[i]);
          px = s.x;
          step(level, s, pin[i]);
          if (s.events.includes('hit')) react = s.tick;
          if (bad(s)) {
            died = true;
            break;
          }
          if (kind === 'glide' && i > 6 && (s.grounded || s.rope >= 0)) {
            i++;
            break;
          }
        }
        // back onto the slice grid
        while (!died && (s.tick - t0) % SLICE && s.mode === 'run') {
          inputs.push(NO_INPUT);
          px = s.x;
          step(level, s, NO_INPUT);
          if (s.events.includes('hit')) react = s.tick;
          if (bad(s)) died = true;
        }
        if (died) {
          prunes.push({ x: px, why: s.events.includes('croc') ? 'crocodile' : 'fell' });
          continue;
        }
        kids.push({ s, lp: t0, lr: t0 + i, react, inputs, choice: null, press: { kind, tick: t0, x: s0.x }, parent: n, presses: n.presses + 1, checked: false, lucky: n.lucky, luckyAt: n.luckyAt });
      }
    }
    // keep the best, checking the timing tolerance of presses lazily; part of the beam goes to the runs that got
    // furthest for each combination of golden acorns, so no way of collecting them is crowded out by another
    const seen = new Map<string, Node>();
    const byScore = [...kids].sort((a, b) => score(b) - score(a));
    // per combination of golden acorns collected (and how many were lucky), the runs that got furthest
    const prog = (n: Node) => n.s.x - (3 - n.s.hearts) * 40;
    const acornIx = level.pickups.map((p, i) => (p.kind === 'acorn' ? i : -1)).filter((i) => i >= 0);
    const combo = (n: Node) => acornIx.reduce((m, i, b) => m | (n.s.got[i] << b), 0) * 4 + Math.min(3, n.lucky);
    const byCombo = new Map<number, Node[]>();
    for (const k of kids) {
      const c = combo(k);
      if (!byCombo.has(c)) byCombo.set(c, []);
      byCombo.get(c)!.push(k);
    }
    const groups = [...byCombo.values()].map((g) => g.sort((p, q) => prog(q) - prog(p)));
    const order: Node[] = [];
    const gi = groups.map(() => 0);
    for (let i = 0; i < byScore.length || groups.some((g, a) => gi[a] < g.length); ) {
      for (let q = 0; q < 3 && i < byScore.length; q++) order.push(byScore[i++]);
      for (let a = 0; a < groups.length; a++) if (gi[a] < groups[a].length) order.push(groups[a][gi[a]++]);
    }
    const next: Node[] = [];
    const taken = new Set<Node>();
    for (const k of order) {
      if (next.length >= width) break;
      if (taken.has(k)) continue;
      taken.add(k);
      const s = k.s;
      const key = `${Math.round(s.x * 5)}:${Math.round(s.y * 5)}:${Math.round(s.vy / 2)}:${s.grounded ? 1 : 0}:${s.acorns}:${k.lucky}:${s.hearts}:${s.rope}:${s.rope >= 0 ? Math.round(s.ropeA * 6) : ''}:${Math.round(s.flyVX)}:${s.gliding ? 1 : 0}:${s.ducking ? 1 : 0}:${Math.min(3, Math.ceil((k.lr + LIFT - s.tick) / SLICE))}`;
      if (seen.has(key)) continue;
      if (!k.checked) {
        const before = k.parent!.parent!.s; // the state one slice before the press (for early presses)
        const ck = `${k.press!.kind}:${before.tick}:${Math.round(before.x * 50)}:${Math.round(before.y * 50)}:${Math.round(before.vy * 10)}:${before.acorns}:${before.rope}:${Math.round(before.ropeA * 50)}`;
        let res = robustCache.get(ck);
        if (res === undefined) {
          const o = { lucky: false };
          res = { why: robust(level, before, k.press!.kind, k.s, o), lucky: o.lucky };
          robustCache.set(ck, res);
        }
        const why = res.why;
        if (res.lucky) k.lucky++;
        if (res.lucky) k.luckyAt = [...k.parent!.luckyAt, k.press!.x];
        k.checked = true;
        if (why) {
          prunes.push({ x: k.press!.x, why: `${k.press!.kind}: ${why}` });
          continue;
        }
      }
      if (s.mode === 'won') {
        if (sure(k) >= need) {
          won = k;
          break;
        }
        if (!finished || score(k) > score(finished)) finished = k;
        continue;
      }
      seen.set(key, k);
      next.push(k);
    }
    beam = next;
    for (const k of beam) {
      if (k.s.x > maxX + 0.5) {
        maxX = k.s.x;
        stuck = [];
      }
      if (score(k) > score(best)) best = k;
    }
    if (prunes.length) {
      for (const p of prunes) if (p.x > maxX - 4 && stuck.length < 400) stuck.push(p);
      prunes.length = 0;
    }
    if (beam[0] && beam[0].s.tick > maxTicks) break;
  }
  const end = won ?? finished ?? best;
  const chain: Node[] = [];
  for (let n: Node | null = end; n; n = n.parent) chain.push(n);
  chain.reverse();
  // the inputs a replay consumes: the run-mode ticks only (crossings take no input)
  const runInputs: Input[] = [];
  const choices: PlantKind[] = [];
  const presses: HumanResult['presses'] = [];
  for (const n of chain) {
    if (n.choice) choices.push(...n.choice);
    if (n.press) presses.push(n.press);
    runInputs.push(...n.inputs);
  }
  return {
    ok: !!won,
    finished: !!(won ?? finished),
    inputs: runInputs,
    choices,
    presses,
    final: end.s,
    dps: dps.sort((a, b) => a.dp - b.dp),
    seconds: end.s.tick / 60,
    heartsLost: 3 - end.s.hearts,
    lucky: end.lucky,
    luckyAt: end.luckyAt,
    maxX: won ? end.s.x : maxX,
    stuck: summarize(stuck),
  };
}

/** the most common reasons among the rejected runs near the furthest point */
function summarize(p: Prune[]): Prune[] {
  const m = new Map<string, Prune & { n: number }>();
  for (const q of p) {
    const k = q.why;
    const o = m.get(k);
    if (o) {
      o.n++;
      o.x = Math.max(o.x, q.x);
    } else m.set(k, { ...q, n: 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 4);
}

/** what is at this x of the level (for reports) */
export function whatIsAt(level: Level, x: number): string {
  const near: string[] = [];
  for (const z of level.zones) if (x >= z.x0 - 2 && x <= z.x1 + 2) near.push(z.kind === 'collapse' ? 'collapsing bridge' : z.kind === 'chase' ? 'boar chase' : z.kind === 'glide' ? 'dandelion glide' : z.kind);
  const mv = level.movers.filter((m) => x >= m.x0 - m.amp - 4 && x <= m.x1 + m.amp + 7);
  if (mv.length) near.push(`${mv[0].kind === 'shroom' ? 'bouncy mushrooms' : mv[0].kind === 'plank' ? 'hanging planks' : mv[0].kind === 'log' ? 'floating logs' : 'lily pads / stones'}`);
  if (level.ropes.some((r) => x >= r.x - 6 && x <= r.x + 6)) near.push('rope swings');
  for (const e of level.enemies) if (x >= Math.min(e.x0, e.x1) - 3 && x <= Math.max(e.x0, e.x1) + 2) near.push(e.kind === 'roller' ? 'rolling acorn' : e.kind);
  for (const h of level.hazards) if (x >= h.x0 - 3 && x <= h.x1 + 1) near.push('thorns');
  for (const b of level.boxes) if ((b.kind === 'log' || b.kind === 'stump') && x >= b.x0 - 3 && x <= b.x1 + 1) near.push(b.kind === 'log' ? 'low log' : 'stump');
  for (const d of level.dps) if (x >= d.stopX - 3 && x <= d.exitX + 1) near.push(`decision point (${d.obstacle})`);
  if (!near.length) {
    const grounds = level.boxes.filter((b) => b.kind === 'ground' || b.kind === 'wall').sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < grounds.length; i++) if (grounds[i].x0 - grounds[i - 1].x1 > 0.5 && x >= grounds[i - 1].x1 - 3 && x <= grounds[i].x0 + 1) near.push(`pit ${(grounds[i].x0 - grounds[i - 1].x1).toFixed(1)} wide`);
  }
  return [...new Set(near)].join(', ') || 'open trail';
}
