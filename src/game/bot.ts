/**
 * The level bot: a beam search over real inputs (jump / hold / duck in 50 ms slices) running the real simulation.
 * It finds a run that finishes the level with all three golden acorns, and at every decision point it tries every
 * seed card to prove that the answer works and the other cards fail. Used by the level validator (CI), the unit
 * tests, the preview video and the autoplay demo.
 */
import { choose, cloneSim, newSim, NO_INPUT, step, type FailReason, type Input, type SimState } from './sim';
import type { Level, PlantKind } from './types';

const CHUNK = 3;
type Act = 0 | 1 | 2; // release, jump/hold, duck

interface Node {
  s: SimState;
  prev: Act;
  /** inputs of the run-mode ticks of this slice */
  inputs: Input[];
  choice: PlantKind[] | null;
  parent: Node | null;
  /** button presses so far (fewer is more natural) */
  presses: number;
}

export interface CardResult {
  kind: PlantKind;
  ok: boolean;
  reason: FailReason;
  /** seconds from planting until the crossing ended */
  time: number;
}
export interface DpReport {
  dp: number;
  answer: PlantKind;
  cards: CardResult[];
}
export interface Plan {
  ok: boolean;
  /** inputs for every tick that starts in run mode, in order */
  inputs: Input[];
  /** plants to choose at each stop at a decision point, in order */
  choices: PlantKind[];
  final: SimState;
  dps: DpReport[];
  /** seconds of play */
  seconds: number;
}

function inputFor(a: Act, prev: Act, first: boolean): Input {
  return {
    jumpPressed: a === 1 && (prev !== 1 || false) && first,
    jumpHeld: a === 1,
    duckPressed: a === 2 && prev !== 2 && first,
    duckHeld: a === 2,
  };
}

/** run a crossing with one plant from the decision state; returns the result and the state after it */
export function tryCard(level: Level, s0: SimState, kind: PlantKind): { res: CardResult; s: SimState } {
  const s = cloneSim(s0);
  const t0 = s.tick;
  choose(level, s, kind);
  let reason: FailReason = '';
  for (let i = 0; i < 60 * 30; i++) {
    step(level, s, NO_INPUT);
    if (s.mode === 'fail' && !reason) reason = s.failReason;
    if (s.mode === 'run' || s.mode === 'decide' || s.mode === 'won') break;
  }
  return { res: { kind, ok: s.mode === 'run' || s.mode === 'won', reason, time: (s.tick - t0) / 60 }, s };
}

function score(s: SimState, presses = 0) {
  return s.x + s.acorns * 60 + s.gems * 0.4 - (3 - s.hearts) * 40 - presses * 0.15;
}
const nscore = (n: Node) => score(n.s, n.presses);

export function solve(level: Level, opts: { width?: number; maxSeconds?: number; wrongFirst?: boolean } = {}): Plan {
  const width = opts.width ?? 160;
  const maxTicks = (opts.maxSeconds ?? 240) * 60;
  const dps: DpReport[] = [];
  let beam: Node[] = [{ s: newSim(level), prev: 0, inputs: [], choice: null, parent: null, presses: 0 }];
  let won: Node | null = null;
  let best: Node = beam[0];
  while (beam.length && !won) {
    const out = new Map<string, Node>();
    for (const n of beam) {
      if (n.s.mode === 'decide') {
        const dp = level.dps[n.s.dp];
        let rep = dps.find((r) => r.dp === n.s.dp);
        if (!rep) {
          rep = { dp: n.s.dp, answer: dp.answer, cards: dp.cards.map((k) => tryCard(level, n.s, k).res) };
          dps.push(rep);
        }
        const good = rep.cards.find((c) => c.ok && c.kind === dp.answer) ?? rep.cards.find((c) => c.ok);
        if (!good) continue;
        const seq: PlantKind[] = [];
        let s = n.s;
        if (opts.wrongFirst) {
          const bad = rep.cards.find((c) => !c.ok);
          if (bad && s.seeds > 1) {
            s = tryCard(level, s, bad.kind).s;
            seq.push(bad.kind);
          }
        }
        s = tryCard(level, s, good.kind).s;
        seq.push(good.kind);
        const child: Node = { s, prev: 0, inputs: [], choice: seq, parent: n, presses: n.presses };
        out.set(`dp${n.s.dp}:${s.acorns}:${s.gems}:${s.hearts}`, child);
        continue;
      }
      for (const a of [0, 1, 2] as Act[]) {
        const s = cloneSim(n.s);
        const inputs: Input[] = [];
        let fell = false;
        for (let i = 0; i < CHUNK && s.mode === 'run'; i++) {
          const inp = inputFor(a, n.prev, i === 0);
          inputs.push(inp);
          step(level, s, inp);
          if (s.events.includes('fall')) fell = true;
        }
        if (fell || s.mode === 'lost') continue;
        const child: Node = { s, prev: a, inputs, choice: null, parent: n, presses: n.presses + (a !== 0 && a !== n.prev ? 1 : 0) + (a === 2 ? 0.4 : a === 1 ? 0.05 : 0) };
        if (s.mode === 'won' && s.acorns >= 3) {
          won = child;
          break;
        }
        if (s.mode === 'won') continue;
        const key = `${Math.round(s.x * 6)}:${Math.round(s.y * 6)}:${Math.round(s.vy / 2)}:${s.holding ? 1 : 0}:${s.ducking ? 1 : 0}:${s.acorns}:${s.hearts}:${a}`;
        const old = out.get(key);
        if (!old || nscore(old) < nscore(child)) out.set(key, child);
      }
      if (won) break;
    }
    const next = [...out.values()].sort((p, q) => nscore(q) - nscore(p));
    beam = next.slice(0, width);
    if (beam[0] && nscore(beam[0]) > nscore(best)) best = beam[0];
    if (beam[0] && beam[0].s.tick > maxTicks) break;
  }
  const end = won ?? best;
  const inputs: Input[] = [];
  const choices: PlantKind[] = [];
  const chain: Node[] = [];
  for (let n: Node | null = end; n; n = n.parent) chain.push(n);
  chain.reverse();
  for (const n of chain) {
    if (n.choice) choices.push(...n.choice);
    inputs.push(...n.inputs);
  }
  return { ok: !!won, inputs, choices, final: end.s, dps: dps.sort((a, b) => a.dp - b.dp), seconds: end.s.tick / 60 };
}

/** replays a plan against a live simulation, tick by tick */
export class Replay {
  private i = 0;
  private c = 0;
  constructor(readonly plan: Pick<Plan, 'inputs' | 'choices'>) {}
  /** the input for the next tick (only consumed in run mode) */
  input(s: SimState): Input {
    if (s.mode !== 'run') return NO_INPUT;
    return this.plan.inputs[this.i++] ?? NO_INPUT;
  }
  /** the plant to pick now that the sprite stands at a decision point */
  choice(): PlantKind | null {
    return this.plan.choices[this.c++] ?? null;
  }
}
