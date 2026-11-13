/**
 * Death check: no soft-lock after a lost heart, in any level.
 *
 * The level bot plays every shipped level (5 worlds x 12, the 5 Golden Groves and the whole daily challenge pool: the
 * daily generator with each of its 30 seeds) with the real simulation. Right after every stateful obstacle it loses one
 * heart on purpose: it first lets the sprite run on without input into whatever comes next (the next gap, the
 * crocodile, the boar); if nothing kills it within a few seconds the sprite is dropped into a pit right there. In the
 * boar chase it also lets the boar hit it. Each death is checked twice: as a normal death (respawn) and as the last
 * heart followed by the rewarded "continue with 1 heart" (revive). After each one:
 *  - the sprite is back at the right checkpoint (the last flag or solved decision point before the death);
 *  - every stateful obstacle from that checkpoint on is in its original state: collapsing bridges whole, the boar
 *    chase not running (it starts again behind the sprite), sinking lily pads / logs risen, no rope held, rolling
 *    acorns a full view ahead waiting again;
 *  - the level is still finishable from there (the bot plays it to the goal), and while it does the boar is never in
 *    front of the sprite, nothing kills the sprite again and again, and it never gets stuck.
 * The bot's normal run through each level is checked the same way (finishable, boar always behind).
 * Writes docs/death-check-report.md and exits 1 on any problem. Runs in parallel shards.
 * usage: npm run check:deaths   [--only=<id,id>]
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { Replay, solve } from '../src/game/bot';
import { allLevels } from '../src/game/levels';
import { playHuman } from '../src/game/human';
import { bridgeGone, choose, cloneSim, newSim, NO_INPUT, revive, step, type Input, type SimState } from '../src/game/sim';
import type { Level, PlantKind } from '../src/game/types';

export interface Check {
  /** obstacle label */
  what: string;
  /** how the heart was lost */
  how: string;
  /** respawn or revive */
  via: 'respawn' | 'revive';
  ok: boolean;
  problems: string[];
}
export interface LevelResult {
  id: string;
  obstacles: string[];
  baseOk: boolean;
  problems: string[];
  checks: Check[];
}

/** a stateful obstacle and the moment right after it (or, for `during`, the moment inside it) to lose a heart */
interface Spot {
  what: string;
  /** the death happens at the first tick of the baseline run where this holds */
  at: (s: SimState) => boolean;
  /** let the boar hit instead of a fall */
  boarHit?: boolean;
  done?: boolean;
}

const T = (s: number) => Math.round(s * 60);

function spotsOf(L: Level): Spot[] {
  const out: Spot[] = [];
  const run = (s: SimState) => s.mode === 'run' && s.grounded && s.rope < 0;
  L.zones.forEach((z, i) => {
    if (z.kind === 'collapse') out.push({ what: `collapsing bridge #${i} (x ${z.x0.toFixed(0)}-${z.x1.toFixed(0)})`, at: (s) => run(s) && s.x > z.x1 + 0.5 });
    if (z.kind === 'chase') {
      out.push({ what: `boar chase: hit by the boar`, boarHit: true, at: (s) => run(s) && !Number.isNaN(s.boarX) && !s.boarDone && s.x > z.x0 + 4 && s.invuln <= 0 });
      out.push({ what: `boar chase: death inside the chase`, at: (s) => run(s) && !Number.isNaN(s.boarX) && !s.boarDone && s.x > (z.x0 + z.x1) / 2 });
      out.push({ what: `boar chase: death right after it`, at: (s) => run(s) && s.x > z.x1 + 0.5 });
    }
    if (z.kind === 'wind') out.push({ what: `wind gusts #${i}`, at: (s) => run(s) && s.x > z.x1 + 0.5 });
    if (z.kind === 'glide') out.push({ what: `dandelion glide #${i}`, at: (s) => run(s) && s.x > z.x1 + 0.5 });
  });
  // movers in groups (a row of lily pads, a mushroom chain, floating logs, hanging planks, stepping stones)
  const ms = L.movers.map((m, i) => ({ m, i })).sort((a, b) => a.m.x0 - b.m.x0);
  for (let k = 0; k < ms.length; ) {
    let e = k;
    while (e + 1 < ms.length && ms[e + 1].m.kind === ms[k].m.kind && ms[e + 1].m.x0 - ms[e].m.x1 < 7) e++;
    const end = Math.max(...ms.slice(k, e + 1).map((q) => q.m.x1 + q.m.amp));
    const sinks = ms.slice(k, e + 1).some((q) => q.m.sinkAfter > 0);
    out.push({ what: `${ms[k].m.kind}${sinks ? ' (sinking)' : ''} x${e - k + 1} (x ${ms[k].m.x0.toFixed(0)}-${end.toFixed(0)})`, at: (s) => run(s) && s.x > end + 0.5 });
    k = e + 1;
  }
  // ropes in groups: a death while hanging on one, and right after them
  const rs = L.ropes.map((r, i) => ({ r, i })).sort((a, b) => a.r.x - b.r.x);
  for (let k = 0; k < rs.length; ) {
    let e = k;
    while (e + 1 < rs.length && rs[e + 1].r.x - rs[e].r.x < 9) e++;
    const ids = new Set(rs.slice(k, e + 1).map((q) => q.i));
    const end = rs[e].r.x;
    out.push({ what: `rope x${e - k + 1} (x ${rs[k].r.x.toFixed(0)}): death while hanging`, at: (s) => s.mode === 'run' && ids.has(s.rope) });
    out.push({ what: `rope x${e - k + 1} (x ${rs[k].r.x.toFixed(0)}): death right after`, at: (s) => run(s) && s.x > end + 4 });
    k = e + 1;
  }
  L.enemies.forEach((en, i) => {
    if (en.kind === 'roller') out.push({ what: `rolling acorn #${i}`, at: (s) => run(s) && s.rollAt[i] >= 0 && s.x > en.x0 + 1 });
    else if (en.kind === 'beetle') out.push({ what: `beetle #${i}`, at: (s) => run(s) && s.x > Math.max(en.x0, en.x1) + 1 });
  });
  L.dps.forEach((d, i) => out.push({ what: `decision point #${i} (${d.answer})`, at: (s) => run(s) && !!s.solved[i] && s.x > d.exitX + 1 }));
  return out;
}

/** the checkpoint the sprite must go back to after dying in state `d` */
function expectedCp(L: Level, d: SimState) {
  let x = L.startX;
  if (d.cp >= 0) x = L.checkpoints[d.cp].x;
  L.dps.forEach((dp, i) => {
    if (d.solved[i] && dp.exitX <= d.x + 0.01) x = Math.max(x, dp.exitX);
  });
  return x;
}

/** lose a heart from `s0`: run on without input into what comes next, else drop into a pit right here */
function loseHeart(L: Level, s0: SimState, boarHit: boolean, lastHeart: boolean): { s: SimState; how: string; deathX: number; dead: SimState } | null {
  if (boarHit) {
    const s = cloneSim(s0);
    if (lastHeart) s.hearts = 1;
    s.boarX = s.x - 0.4;
    step(L, s, NO_INPUT);
    if (!s.events.includes('hit')) return null;
    return { s, how: 'the boar hit it', deathX: s.x, dead: s };
  }
  const tryRun = cloneSim(s0);
  if (lastHeart) tryRun.hearts = 1;
  const h0 = tryRun.hearts;
  for (let i = 0; i < T(5) && tryRun.mode === 'run'; i++) {
    const before = cloneSim(tryRun);
    step(L, tryRun, NO_INPUT);
    const died = (tryRun.events as string[]).includes('die');
    if (died) {
      const what = tryRun.events.includes('croc') ? 'ran on into the crocodile lake' : 'ran on into the next gap';
      return { s: tryRun, how: what, deathX: tryRun.deathX, dead: before };
    }
    // a hit that does not kill is not the death we want; a hit on the last heart is (it loses the level)
    if (tryRun.hearts < h0 && (tryRun.mode as string) !== 'lost') break;
    if ((tryRun.mode as string) === 'lost') return { s: tryRun, how: 'ran on into an enemy', deathX: tryRun.x, dead: before };
  }
  const s = cloneSim(s0);
  if (lastHeart) s.hearts = 1;
  s.rope = -1;
  s.hurtAir = false;
  s.grounded = false;
  s.vy = -1;
  s.y = L.killY - 0.5;
  const dead = cloneSim(s0);
  step(L, s, NO_INPUT);
  if (!(s.events as string[]).includes('die')) return null;
  return { s, how: 'dropped into a pit right there', deathX: s0.x, dead };
}

/** the boar is never in front of the sprite */
const boarAhead = (s: SimState) => !Number.isNaN(s.boarX) && !s.boarDone && s.boarX > s.x + 1e-6;

/** play a plan from `s0`; problems seen on the way (boar in front, deaths) */
function replayFrom(L: Level, s0: SimState, plan: { inputs: Input[]; choices: PlantKind[] }) {
  const s = cloneSim(s0);
  const rp = new Replay(plan);
  const problems: string[] = [];
  let deaths = 0;
  for (let t = 0; t < T(400) && s.mode !== 'won' && s.mode !== 'lost'; t++) {
    if (s.mode === 'decide') {
      const k = rp.choice();
      if (!k || !choose(L, s, k)) break;
      continue;
    }
    step(L, s, rp.input(s));
    if ((s.events as string[]).includes('die')) deaths++;
    if (boarAhead(s) && !problems.some((p) => p.startsWith('boar'))) problems.push(`boar in front of the sprite at x ${s.x.toFixed(1)}`);
  }
  if (s.mode !== 'won') problems.push(`replay did not finish (${s.mode} at x ${s.x.toFixed(1)})`);
  if (deaths > 0) problems.push(`${deaths} more death(s) on the way`);
  return { s, problems };
}

function checkAfter(L: Level, spot: Spot, d: SimState, via: 'respawn' | 'revive', lost: { s: SimState; how: string; deathX: number }): Check {
  const problems: string[] = [];
  const r = lost.s;
  if (spot.boarHit) {
    // a hit without a death: the boar falls back and stays behind the sprite
    if (r.mode === 'lost') {
      revive(L, r);
      if ((r.mode as string) !== 'run') problems.push('revive did not bring the sprite back');
    }
    if (boarAhead(r)) problems.push(`boar in front after the hit (boar ${r.boarX.toFixed(1)}, sprite ${r.x.toFixed(1)})`);
  } else {
    if (via === 'revive') {
      if (r.mode !== 'lost') problems.push(`the last heart did not lose the level (${r.mode})`);
      revive(L, r);
    }
    const cp = expectedCp(L, d);
    if (r.mode !== 'run') problems.push(`not running after the ${via} (${r.mode})`);
    if (Math.abs(r.x - cp) > 1e-6 || Math.abs(r.cpX - cp) > 1e-6) problems.push(`back at x ${r.x.toFixed(1)}, expected the checkpoint at x ${cp.toFixed(1)}`);
    if (r.x > lost.deathX + 0.01) problems.push(`checkpoint x ${r.x.toFixed(1)} is after the death at x ${lost.deathX.toFixed(1)}`);
    L.zones.forEach((z, i) => {
      if (z.kind === 'collapse' && z.x1 > r.cpX) {
        const gone = L.boxes.some((b, k) => b.kind === 'bridge' && bridgeGone(L, r, k));
        if (r.zoneX[i] > -1e8 || gone) problems.push(`collapsing bridge #${i} still broken`);
      }
      if (z.kind === 'chase' && z.x1 - 1.2 > r.cpX && (!Number.isNaN(r.boarX) || r.boarDone)) problems.push(`boar chase not reset (boar at ${r.boarX.toFixed(1)}, done ${r.boarDone})`);
    });
    L.movers.forEach((m, i) => {
      if (m.x1 + m.amp > r.cpX && r.moverD[i] !== 0) problems.push(`${m.kind} #${i} still sunk ${r.moverD[i].toFixed(2)}`);
    });
    if (r.rope >= 0) problems.push(`still on rope #${r.rope}`);
    if (r.flyVX !== 0 || r.gliding || r.climbing || r.on >= 0) problems.push('flight / glide / climb / ride state left over');
  }
  if (boarAhead(r)) problems.push('boar in front of the sprite right after');
  // still finishable from here, without the boar ever in front
  if (r.mode === 'run') {
    // a narrow search first (fast); a wider one before calling it a problem (a glide needs exact timing)
    let plan = solve(L, { from: r, needAcorns: 0, width: 48, maxSeconds: 300 });
    for (const width of [160, 400]) if (!plan.ok) plan = solve(L, { from: r, needAcorns: 0, width, maxSeconds: 300 });
    if (!plan.ok) {
      // the human-limited playtester (the level validator's player) from the same state
      const h = playHuman(L, { from: r, needAcorns: 0, maxSeconds: 300 });
      if (h.ok) plan = { ...plan, ok: true, inputs: h.inputs, choices: h.choices, final: h.final };
    }
    if (!plan.ok) problems.push(`cannot finish the level from here (the bot got to x ${plan.final.x.toFixed(1)} of ${L.goalX.toFixed(0)})`);
    else problems.push(...replayFrom(L, r, plan).problems);
  }
  return { what: spot.what, how: lost.how, via, ok: problems.length === 0, problems };
}

export function checkLevel(L: Level): LevelResult {
  const spots = spotsOf(L);
  const res: LevelResult = { id: L.id, obstacles: [...new Set(spots.map((s) => s.what.replace(/ #\d+| x\d+|\s*\(x [^)]*\)|: .*$/g, '')))], baseOk: false, problems: [], checks: [] };
  // the normal run: the beam-search bot, a wider search, or else the human-limited playtester's run (the validator's)
  let plan: { ok: boolean; inputs: Input[]; choices: PlantKind[]; final: SimState } = solve(L);
  if (!plan.ok) plan = solve(L, { width: 400 });
  if (!plan.ok) {
    const h = playHuman(L);
    if (h.ok) plan = { ok: true, inputs: h.inputs, choices: h.choices, final: h.final };
  }
  if (!plan.ok) {
    res.problems.push(`the bot cannot finish the level with all 3 golden acorns (got to x ${plan.final.x.toFixed(1)})`);
    return res;
  }
  const base = replayFrom(L, newSim(L), plan);
  res.problems.push(...base.problems.map((p) => `normal run: ${p}`));
  res.baseOk = base.problems.length === 0;
  // walk the normal run; at each obstacle's moment, branch off and lose a heart
  const s = newSim(L);
  const rp = new Replay(plan);
  for (let t = 0; t < T(400) && s.mode !== 'won' && s.mode !== 'lost'; t++) {
    if (s.mode === 'decide') {
      const k = rp.choice();
      if (!k || !choose(L, s, k)) break;
      continue;
    }
    step(L, s, rp.input(s));
    for (const spot of spots) {
      if (spot.done || !spot.at(s)) continue;
      spot.done = true;
      for (const via of ['respawn', 'revive'] as const) {
        const lost = loseHeart(L, s, !!spot.boarHit, via === 'revive');
        if (!lost) {
          res.checks.push({ what: spot.what, how: 'could not lose a heart here', via, ok: false, problems: ['no death / hit happened'] });
          continue;
        }
        res.checks.push(checkAfter(L, spot, lost.dead, via, lost));
      }
    }
  }
  for (const spot of spots) if (!spot.done) res.checks.push({ what: spot.what, how: 'never reached', via: 'respawn', ok: false, problems: ['the normal run never reached this obstacle'] });
  for (const c of res.checks) if (!c.ok) res.problems.push(`${c.what} (${c.via}, ${c.how}): ${c.problems.join('; ')}`);
  return res;
}

/* ------------------------------------------------------------------ runner */

const args = process.argv.slice(2);
const shardArg = args.find((a) => a.startsWith('--shard='));
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const levels = allLevels().filter((L) => !only || only.includes(L.id));

if (shardArg) {
  const [i, n] = shardArg.slice(8).split('/').map(Number);
  const out = levels.filter((_, k) => k % n === i).map(checkLevel);
  process.stdout.write(JSON.stringify(out));
} else {
  const n = Math.max(1, Math.min(levels.length, cpus().length));
  const t0 = Date.now();
  const parts = await Promise.all(
    Array.from(
      { length: n },
      (_, i) =>
        new Promise<LevelResult[]>((res, rej) => {
          const c = spawn(process.execPath, ['--import', 'tsx', 'scripts/death-check.ts', `--shard=${i}/${n}`, ...(only ? [`--only=${only.join(',')}`] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
          let buf = '';
          c.stdout.on('data', (d) => (buf += d));
          c.on('close', (code) => (code === 0 ? res(JSON.parse(buf) as LevelResult[]) : rej(new Error(`shard ${i} failed`))));
        }),
    ),
  );
  const order = levels.map((L) => L.id);
  const all = parts.flat().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const bad = all.filter((r) => r.problems.length);
  const checks = all.reduce((k, r) => k + r.checks.length, 0);
  const name = (id: string) => (/^daily-/.test(id) ? `daily (${id})` : id.endsWith('-S') ? `${id[0]} / Golden Grove` : `${id.split('-')[0]} / ${id.split('-')[1]}`);
  const lines = [
    '# Death check: every level, a heart lost after every stateful obstacle',
    '',
    'Generated by `npm run check:deaths` (`scripts/death-check.ts`, CI job `levels`). The level bot plays each level; right',
    'after every stateful obstacle it loses one heart on purpose (it runs on into the next gap / the crocodile, or drops',
    'into a pit right there; in a boar chase it also lets the boar hit it), once as a normal death (respawn) and once as',
    'the last heart followed by the rewarded "continue with 1 heart" (revive). Each time the sprite must be back at the',
    'right checkpoint, every stateful obstacle from there on must be in its original state (bridges whole, the boar chase',
    'starting again behind the sprite, lily pads / logs risen, no rope held), and the bot must still finish the level',
    'from there with the boar never in front of the sprite and no further death.',
    '',
    `**${all.length} levels, ${checks} death checks: ${bad.length ? `${bad.length} level(s) with problems` : 'all passed'}.**`,
    '',
    '| World / level | Stateful obstacles | Death checks | Result |',
    '| --- | --- | --- | --- |',
    ...all.map((r) => `| ${name(r.id)} | ${r.obstacles.join(', ') || '-'} | ${r.checks.filter((c) => c.ok).length}/${r.checks.length} | ${r.problems.length ? 'problem' : 'passed'} |`),
    '',
  ];
  if (bad.length) {
    lines.push('## Problems', '');
    for (const r of bad) for (const p of r.problems) lines.push(`- ${r.id}: ${p}`);
    lines.push('');
  }
  writeFileSync('docs/death-check-report.md', lines.join('\n'));
  for (const r of bad) for (const p of r.problems) console.log(`FAIL ${r.id}: ${p}`);
  console.log(`${all.length} levels, ${checks} death checks, ${bad.length} level(s) with problems (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(bad.length ? 1 : 0);
}
