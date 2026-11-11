/**
 * Level validator: a bot plays every shipped level (5 worlds x 12, the 5 special levels and the daily challenge
 * pool) with the real simulation (fixed 60 Hz timestep, deterministic, at the level's real and growing speed) and
 * a level passes only if:
 *  - the bot finishes it with all 3 golden acorns, with the level's 3 hearts (not losing any) and its seeds;
 *  - at every decision point the answer crosses (and collects the decision point's golden acorn, if it has one),
 *    the "also works" plants cross but miss that acorn, and every other card really fails;
 *  - every hazard (enemy, thorns, low log, stump) is on screen at least 1 s before the sprite reaches it;
 *  - the recorded inputs replay to the same win; the run lasts 45-120 s; the speed stays at most 1.5x level 1.
 * Writes docs/levels-report.md and exits 1 if any level fails. Runs in parallel shards.
 * usage: npm run validate:levels            (all levels)
 *        tsx scripts/validate-levels.ts --tune   (try other seeds for failing generated levels and print them)
 */
import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { solve, Replay } from '../src/game/bot';
import { allLevels } from '../src/game/levels';
import { generateLevel } from '../src/game/levels/gen';
import { readability } from '../src/game/fairness';
import { newSim, step, choose } from '../src/game/sim';
import { MAX_SPEED } from '../src/game/physics';
import type { Level } from '../src/game/types';

const MIN_READ = 1.0;

export interface Result {
  id: string;
  ok: boolean;
  problems: string[];
  seconds: number;
  acorns: number;
  gems: number;
  gemsTotal: number;
  hearts: number;
  seedsUsed: number;
  seeds: number;
  speed0: number;
  speed1: number;
  minRead: number;
  hazards: number;
  dps: string[];
}

export function check(L: Level): Result {
  const p = solve(L, { width: 160, maxSeconds: 200 });
  const problems: string[] = [];
  if (!p.ok) problems.push(`not finished with 3 acorns (x ${p.final.x.toFixed(1)} of ${L.goalX.toFixed(1)}, ${p.final.acorns} acorns, ${p.final.hearts} hearts)`);
  if (p.ok && p.final.hearts < 1) problems.push('needs more hearts than the level gives');
  if (p.dps.length !== L.dps.length) problems.push(`only ${p.dps.length} of ${L.dps.length} decision points reached`);
  const dps: string[] = [];
  for (const d of p.dps) {
    const dp = L.dps[d.dp];
    const also = dp.alsoWorks ?? [];
    for (const c of d.cards) {
      if (c.kind === d.answer && !c.ok) problems.push(`decision ${d.dp + 1}: the answer (${c.kind}) fails (${c.reason})`);
      if (c.kind === d.answer && (dp.acorn ?? -1) >= 0 && !c.acorn) problems.push(`decision ${d.dp + 1}: the answer misses its golden acorn`);
      if (also.includes(c.kind) && !c.ok) problems.push(`decision ${d.dp + 1}: ${c.kind} should also cross but fails`);
      if (also.includes(c.kind) && c.acorn) problems.push(`decision ${d.dp + 1}: ${c.kind} should miss the golden acorn`);
      if (c.kind !== d.answer && !also.includes(c.kind) && c.ok) problems.push(`decision ${d.dp + 1}: wrong card ${c.kind} works`);
    }
    dps.push(
      `${dp.obstacle}${dp.obstacle === 'wall' ? ` ${dp.height} high` : ` ${dp.width} wide`}${dp.drop ? `, ${dp.drop} down` : ''}: **${d.answer}**${(dp.acorn ?? -1) >= 0 ? ' (+acorn)' : ''} — ` +
        d.cards.map((c) => `${c.kind} ${c.ok ? (c.acorn ? 'crosses +acorn' : 'crosses') : `fails (${c.reason})`}`).join(', '),
    );
  }
  // replay from scratch: the same win (determinism)
  const s = newSim(L);
  const r = new Replay(p);
  for (let i = 0; i < 60 * 300 && s.mode !== 'won' && s.mode !== 'lost'; i++) {
    if (s.mode === 'decide') {
      const k = r.choice();
      if (!k || !choose(L, s, k)) break;
    }
    step(L, s, r.input(s));
  }
  if (p.ok && (s.mode !== 'won' || s.acorns !== 3)) problems.push('replay of the plan does not reproduce the win');
  if (p.seconds < 45 || p.seconds > 120) problems.push(`length ${p.seconds.toFixed(0)} s is outside 45-120 s`);
  if (p.final.speed > MAX_SPEED + 1e-6) problems.push(`speed ${p.final.speed.toFixed(2)} above the cap`);
  const reads = p.ok ? readability(L, p) : [];
  const minRead = reads.length ? Math.min(...reads.map((x) => x.seconds)) : 99;
  for (const x of reads) if (x.seconds < MIN_READ) problems.push(`${x.what} at x ${x.x.toFixed(1)} is on screen only ${x.seconds.toFixed(2)} s before it must be dodged`);
  return {
    id: L.id,
    ok: problems.length === 0,
    problems,
    seconds: p.seconds,
    acorns: p.final.acorns,
    gems: p.final.gems,
    gemsTotal: L.pickups.filter((q) => q.kind === 'gem').length,
    hearts: p.final.hearts,
    seedsUsed: L.seeds - p.final.seeds,
    seeds: L.seeds,
    speed0: L.speed,
    speed1: p.final.speed,
    minRead,
    hazards: L.enemies.length + L.hazards.length + L.boxes.filter((b) => b.kind === 'log' || b.kind === 'stump').length,
    dps,
  };
}

const args = process.argv.slice(2);
const shardArg = args.find((a) => a.startsWith('--shard='));
if (shardArg) {
  const [i, n] = shardArg.slice(8).split('/').map(Number);
  const out = allLevels()
    .filter((_, k) => k % n === i)
    .map(check);
  process.stdout.write(JSON.stringify(out));
} else if (args.includes('--tune')) {
  // find a passing seed for every failing generated level
  const failing = args.filter((a) => /^\d-(\d+|S)$/.test(a));
  for (const id of failing) {
    const [w, n] = id.split('-');
    for (let seed = 2; seed < 60; seed++) {
      const L = generateLevel(+w, n === 'S' ? 12 : +n, seed, n === 'S' ? { special: true } : {});
      const res = check(L);
      if (res.ok) {
        console.log(`${id}: seed ${seed}`);
        break;
      }
    }
  }
} else {
  const n = Math.max(1, Math.min(8, cpus().length));
  const procs = Array.from({ length: n }, (_, i) =>
    new Promise<Result[]>((res, rej) => {
      import('node:child_process').then(({ spawn }) => {
        const c = spawn(process.execPath, ['--import', 'tsx', 'scripts/validate-levels.ts', `--shard=${i}/${n}`], { stdio: ['ignore', 'pipe', 'inherit'] });
        let buf = '';
        c.stdout.on('data', (d) => (buf += d));
        c.on('close', (code) => (code === 0 ? res(JSON.parse(buf) as Result[]) : rej(new Error(`shard ${i} failed`))));
      });
    }),
  );
  void spawnSync;
  const order = allLevels().map((l) => l.id);
  const results = (await Promise.all(procs)).flat().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const failed = results.filter((r) => !r.ok);
  const row = (r: Result) =>
    `| ${r.id} | ${r.ok ? 'ok' : '**FAIL**'} | ${r.seconds.toFixed(0)} s | ${r.speed0.toFixed(2)} → ${r.speed1.toFixed(2)} | ${r.hazards} | ${r.minRead.toFixed(2)} s | ${r.acorns}/3 | ${r.hearts}/3 | ${r.gems}/${r.gemsTotal} | ${r.seedsUsed}/${r.seeds} | ${r.dps.length} |`;
  const md = `# Level validator report

Generated by \`npm run validate:levels\` (scripts/validate-levels.ts). A beam-search bot plays every shipped level
with the real simulation (src/game/sim.ts: fixed 60 Hz timestep, no randomness), at the level's real speed (it grows
at each checkpoint flower and is capped at 1.5x level 1 = ${MAX_SPEED.toFixed(2)} units/s), using jump / hold / duck
inputs in 50 ms slices. A level passes when the bot finishes it with all 3 golden acorns, within its 3 hearts and
seeds; at every decision point the answer crosses (and collects the decision point's acorn), "also works" plants
cross but miss that acorn and every other plant fails; every hazard is on screen at least ${MIN_READ.toFixed(1)} s
before the sprite reaches it ("min. warning"); the recorded inputs replay to the same win; and the run lasts
45-120 s.

**${results.length - failed.length} of ${results.length} levels pass.**

| Level | Result | Bot time | Speed (start → end) | Hazards | Min. warning | Acorns | Hearts left | Gems | Seeds used | Decision points |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${results.map(row).join('\n')}

## Decision points

${results.map((r) => `### ${r.id}\n\n${r.dps.length ? r.dps.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'No decision points.'}${r.problems.length ? '\n\n' + r.problems.map((p) => `- **Problem:** ${p}`).join('\n') : ''}\n`).join('\n')}
`;
  writeFileSync('docs/levels-report.md', md);
  console.log(`${results.length - failed.length}/${results.length} levels pass`);
  for (const f of failed) console.error(`${f.id}: ${f.problems.join('; ')}`);
  if (failed.length) process.exit(1);
}
