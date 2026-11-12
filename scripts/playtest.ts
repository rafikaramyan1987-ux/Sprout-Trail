/**
 * Playtest, simulation part: the human-limited playtester (src/game/human.ts) plays every shipped level (5 worlds x
 * 12, the Golden Groves and the daily pool) on the real simulation at the level's real speed and records, per level:
 * finished or not and where it got stuck, hearts lost, golden acorns a human can collect, hazards on screen less
 * than 1 s before they must be dodged, decision cards that behave wrongly, and what dying costs (death probes: from
 * the human run, about 1 s before every pit and lake, the finger is lifted and the sprite runs on by itself).
 * Writes playtest-out/sim-<tag>.json and playtest-out/plans/<id>.json (replayed in the browser by
 * scripts/playtest-browser.ts).
 * usage: npm run playtest [-- --tag=after] [ids...]   (exits 1 if any level has a problem, unless --report-only)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { allLevels, levelById } from '../src/game/levels';
import { playHuman, whatIsAt, HUMAN } from '../src/game/human';
import { pitEdges, readability } from '../src/game/fairness';
import { choose, cloneSim, newSim, NO_INPUT, step, type Input, type SimState } from '../src/game/sim';
import { Replay } from '../src/game/bot';
import type { Level } from '../src/game/types';

export interface Problem {
  cause: string;
  text: string;
}
export interface SimResult {
  id: string;
  pieces: string[];
  ok: boolean;
  finished: boolean;
  goalX: number;
  maxX: number;
  failAt: string;
  stuck: string[];
  acorns: number;
  missedAcorns: string[];
  heartsLost: number;
  seeds: number;
  seedsUsed: number;
  seconds: number;
  presses: number;
  minRead: number;
  deaths: { x: number; what: string; how: string; hearts: string }[];
  problems: Problem[];
  ms: number;
}

const encode = (inputs: Input[]) => inputs.map((i) => String.fromCharCode(65 + (+i.jumpPressed | (+i.jumpHeld << 1) | (+i.duckPressed << 2) | (+i.duckHeld << 3)))).join('');

/** replays a plan, calling `at` before every tick */
function replay(L: Level, plan: { inputs: Input[]; choices: string[] }, at?: (s: SimState) => boolean) {
  const s = newSim(L);
  const r = new Replay(plan as never);
  for (let i = 0; i < 60 * 300 && s.mode !== 'won' && s.mode !== 'lost'; i++) {
    if (at && at(s)) break;
    if (s.mode === 'decide') {
      const k = r.choice();
      if (!k || !choose(L, s, k)) break;
    }
    step(L, s, r.input(s));
  }
  return s;
}

function check(L: Level): SimResult {
  const t0 = Date.now();
  const h = playHuman(L);
  const problems: Problem[] = [];
  const where = (x: number) => `x ${x.toFixed(1)} (${whatIsAt(L, x)})`;
  if (!h.finished) problems.push({ cause: whatIsAt(L, h.maxX), text: `cannot be finished by a human: stuck at ${where(h.maxX)}: ${h.stuck.map((p) => p.why).join('; ') || 'no safe move'}` });
  const missed: string[] = [];
  L.pickups.forEach((p, i) => {
    if (p.kind === 'acorn' && !h.final.got[i]) missed.push(`acorn at ${where(p.x)}, ${p.y.toFixed(1)} high`);
  });
  if (h.finished && missed.length) for (const m of missed) problems.push({ cause: 'golden acorn not collectable', text: `${m} cannot be collected with human timing` });
  if (h.finished && h.lucky) problems.push({ cause: 'golden acorn not collectable', text: `${h.lucky} golden acorn(s) only with lucky timing (missed when pressed 0.1 s early or late) at ${h.luckyAt.map(where).join(', ')}` });
  if (h.heartsLost > 0) problems.push({ cause: 'unavoidable damage', text: `the human run loses ${h.heartsLost} heart(s)` });
  for (const d of h.dps) {
    const dp = L.dps[d.dp];
    for (const c of d.cards) {
      if (c.kind === d.answer && !c.ok) problems.push({ cause: 'decision point', text: `decision ${d.dp + 1}: the answer (${c.kind}) fails (${c.reason})` });
      if (c.kind !== d.answer && !(dp.alsoWorks ?? []).includes(c.kind) && c.ok) problems.push({ cause: 'decision point', text: `decision ${d.dp + 1}: wrong card ${c.kind} works` });
    }
  }
  // determinism: the plan replays to the same end
  const plan = { inputs: h.inputs, choices: h.choices };
  const end = replay(L, plan);
  if (h.finished && (end.mode !== 'won' || end.acorns !== h.final.acorns)) problems.push({ cause: 'determinism', text: 'the recorded human run does not replay to the same end' });
  // everything to dodge is on screen for at least 1 s
  let minRead = 99;
  if (h.finished) {
    for (const r of readability(L, plan)) {
      minRead = Math.min(minRead, r.seconds);
      if (r.seconds < 1) problems.push({ cause: 'hazard visible < 1 s', text: `${r.what} at ${where(r.x)} is on screen only ${r.seconds.toFixed(2)} s before it must be dodged` });
    }
  }
  // death probes: about 1 s before each pit / lake, stop pressing
  const deaths: SimResult['deaths'] = [];
  const spots = [...pitEdges(L), ...L.water.filter((w) => w.croc).map((w) => w.x0)].sort((a, b) => a - b);
  const reached = h.finished ? L.goalX : h.maxX;
  for (const x of spots) {
    if (x > reached) break;
    let snap: SimState | null = null;
    replay(L, plan, (s) => {
      if (s.mode === 'run' && s.x >= x - s.speed * 1.0) {
        snap = cloneSim(s);
        return true;
      }
      return false;
    });
    if (!snap) continue;
    const s = snap as SimState;
    const h0 = s.hearts;
    let how = '';
    for (let i = 0; i < 60 * 6 && s.mode === 'run'; i++) {
      step(L, s, NO_INPUT);
      if (s.events.includes('fall') || s.events.includes('croc') || (s.events as string[]).includes('die') || s.events.includes('lose')) {
        how = s.events.includes('croc') ? 'crocodile' : 'fell';
        break;
      }
    }
    if (!how) continue;
    const what = whatIsAt(L, x);
    deaths.push({ x, what, how, hearts: `${h0} → ${s.hearts}${s.mode === 'lost' ? ' (lost)' : ''}` });
    if (s.hearts !== h0 - 1 && !(h0 === 1 && s.mode === 'lost')) problems.push({ cause: 'dying costs no heart', text: `${how === 'fell' ? 'falling' : 'the crocodile'} at ${where(x)} costs ${h0 - s.hearts} hearts (${h0} → ${s.hearts})` });
  }
  mkdirSync('playtest-out/plans', { recursive: true });
  writeFileSync(`playtest-out/plans/${L.id}.json`, JSON.stringify({ id: L.id, inputs: encode(h.inputs), choices: h.choices, finished: h.finished, acorns: h.final.acorns, hearts: h.final.hearts, seconds: h.seconds }));
  return {
    id: L.id,
    pieces: L.pieces,
    ok: h.ok && problems.length === 0,
    finished: h.finished,
    goalX: L.goalX,
    maxX: h.finished ? L.goalX : h.maxX,
    failAt: h.finished ? '' : where(h.maxX),
    stuck: h.stuck.map((p) => `${p.why} (x ${p.x.toFixed(1)}, ${p.n}x)` as string),
    acorns: h.final.acorns - h.lucky,
    missedAcorns: missed,
    heartsLost: h.heartsLost,
    seeds: L.seeds,
    seedsUsed: L.seeds - h.final.seeds,
    seconds: h.seconds,
    presses: h.presses.length,
    minRead,
    deaths,
    problems,
    ms: Date.now() - t0,
  };
}

const args = process.argv.slice(2);
const shard = args.find((a) => a.startsWith('--shard='));
const ids = args.filter((a) => !a.startsWith('--'));
const tag = args.find((a) => a.startsWith('--tag='))?.slice(6) ?? 'latest';
const levels = ids.length ? ids.map((id) => levelById(id)!) : allLevels();
if (shard) {
  const [i, n] = shard.slice(8).split('/').map(Number);
  process.stdout.write(JSON.stringify(levels.filter((_, k) => k % n === i).map(check)));
} else {
  const n = Math.max(1, Math.min(8, cpus().length, levels.length));
  const { spawn } = await import('node:child_process');
  const parts = await Promise.all(
    Array.from(
      { length: n },
      (_, i) =>
        new Promise<SimResult[]>((res, rej) => {
          const c = spawn(process.execPath, ['--import', 'tsx', 'scripts/playtest.ts', `--shard=${i}/${n}`, ...ids], { stdio: ['ignore', 'pipe', 'inherit'] });
          let buf = '';
          c.stdout.on('data', (d) => (buf += d));
          c.on('close', (code) => (code === 0 ? res(JSON.parse(buf) as SimResult[]) : rej(new Error(`shard ${i} failed`))));
        }),
    ),
  );
  const order = levels.map((l) => l.id);
  const results = parts.flat().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  mkdirSync('playtest-out', { recursive: true });
  writeFileSync(`playtest-out/sim-${tag}.json`, JSON.stringify({ human: HUMAN, results }, null, 1));
  const bad = results.filter((r) => !r.ok);
  console.log(`${results.length - bad.length}/${results.length} levels pass the human-limited playtest`);
  for (const r of bad) console.log(`${r.id}: ${r.problems.map((p) => p.text).join(' | ')}`);
  if (bad.length && !args.includes('--report-only')) process.exit(1);
}
