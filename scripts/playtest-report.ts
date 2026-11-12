/**
 * Writes docs/playtest-report.md from the playtest results kept in docs/playtest/:
 * sim-before.json / browser-before.json (the game before the fixes, v1.1.0) and, once they exist,
 * sim-after.json / browser-after.json (after the fixes).
 * usage: tsx scripts/playtest-report.ts        (after scripts/playtest.ts and scripts/playtest-browser.ts; see
 *        scripts/playtest-save.ts for copying their output into docs/playtest/)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { SimResult } from './playtest';
import type { BrowserResult } from './playtest-browser';

const dir = 'docs/playtest';
const load = <T>(f: string): T | null => (existsSync(`${dir}/${f}`) ? (JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as T) : null);
const simB = load<{ human: Record<string, number>; results: SimResult[] }>('sim-before.json')!;
const simA = load<{ human: Record<string, number>; results: SimResult[] }>('sim-after.json');
const brB = load<BrowserResult[]>('browser-before.json') ?? [];
const brA = load<BrowserResult[]>('browser-after.json');
const H = simB.human;

/** one problem, with the cause it is grouped under */
interface Found {
  id: string;
  where: 'sim' | 'desktop' | 'phone';
  cause: string;
  text: string;
}

/** the cause a problem is grouped under */
function causeOf(text: string, simCause = ''): string {
  if (/costs no heart|costs 0 hearts/.test(text)) return 'Dying costs no heart (bug A)';
  if (/bouncy mushrooms/.test(text) && /cannot be finished|not won/.test(text)) return 'Bouncy mushroom chain cannot be crossed (bug B)';
  if (/hanging planks/.test(text) && /acorn/.test(text)) return 'Golden acorn over hanging planks needs lucky timing';
  if (/lily/.test(text) && /acorn/.test(text)) return 'Golden acorn on a sinking lily pad needs lucky timing';
  if (/acorn/.test(text)) return 'Golden acorn a human cannot collect';
  if (/loses \d heart/.test(text)) return 'The only human-safe route takes damage';
  if (/viewAhead|late:|off screen for [12] ticks/.test(text)) return 'Camera shows too little of the trail ahead (after decision points, during rope flights)';
  if (/end screen/.test(text)) return 'Lifting the finger after the finish presses an end-screen button';
  if (/off screen/.test(text)) return 'Sprite off screen';
  if (/HUD/.test(text)) return 'HUD does not match the game';
  if (/page error|crashed/.test(text)) return 'Page error';
  if (/not won|cannot be finished/.test(text)) return 'Level cannot be finished';
  return simCause || 'Other';
}

const TOUCH = 'Touch jumps start 70 ms (4 frames) after the finger touches: human-timed runs fail on phones';
function collect(sim: SimResult[], br: BrowserResult[]): Found[] {
  const out: Found[] = [];
  for (const r of sim) for (const p of r.problems) out.push({ id: r.id, where: 'sim', cause: causeOf(p.text, p.cause), text: p.text });
  for (const r of br)
    for (const p of r.problems) {
      const s = sim.find((q) => q.id === r.id);
      const stuck = s && !s.finished;
      let cause = causeOf(p);
      let text = p;
      // a level the sim already shows unfinishable is not finished in the browser either (same cause); what happens
      // once its run is over (the sprite running into the pit again and again) belongs to that cause too
      if (stuck && /^not won|off screen|ended differently/.test(p)) {
        cause = causeOf(`cannot be finished (${s.failAt})`);
        text = /^not won/.test(p) ? `not won either (${s.failAt})` : p;
      } else if (r.device === 'phone' && /^not won|ended differently|left the planned run|only \d golden|off screen/.test(p) && !/off screen for [12] ticks/.test(p)) cause = TOUCH;
      else if (/only \d golden|ended differently/.test(p) && s?.problems.some((q) => /acorn/.test(q.text))) cause = causeOf(s.problems.find((q) => /acorn/.test(q.text))!.text);
      out.push({ id: r.id, where: r.device, cause, text });
    }
  return out;
}

const order = simB.results.map((r) => r.id);
const before = collect(simB.results, brB);
const after = simA ? collect(simA.results, brA ?? []) : null;

function group(found: Found[]) {
  const m = new Map<string, Found[]>();
  for (const f of found) {
    if (!m.has(f.cause)) m.set(f.cause, []);
    m.get(f.cause)!.push(f);
  }
  return [...m.entries()].sort((a, b) => new Set(b[1].map((f) => f.id)).size - new Set(a[1].map((f) => f.id)).size || b[1].length - a[1].length);
}

/** a cause listed with its levels, a few examples and how it was fixed */
const FIX: Record<string, string> = {
  'Dying costs no heart (bug A)':
    'Every death (pit, gap, plank, rope, log, lily pad, mushroom, glide, bridge, chase, crocodile) now goes through one `die(s, reason)` in src/game/sim.ts: exactly one heart, back to the last checkpoint, the last heart loses the level; a heart lost to a hit that knocked the sprite into the pit already counts. Heart HUD flashes, an "ouch" sound, a puff where the sprite comes back.',
  'Bouncy mushroom chain cannot be crossed (bug B)':
    'Confirmed: the bounce flew `s.speed` (4.6-5 early on) for about 1 s, but the caps were 6.2 apart and the first cap 1.4 past the edge. Now every bounce is aimed from the real flight (fixed-step flight time from the bounce speed and the landing height) at the middle of the next cap, then at the far ground; the first cap starts at the edge, so the sprite runs onto it. Crossable with no input at every speed; keeping the finger down on landing bounces a little higher to the same spot (never needed).',
  'Golden acorn over hanging planks needs lucky timing':
    'The acorn hung 3.2 above a plank: a jump high enough to reach it carries the sprite past the next plank. It now hangs in the hop between two planks (1.8 above the higher one), where every human-timed hop passes.',
  'Golden acorn on a sinking lily pad needs lucky timing':
    'The acorn sat on a sinking pad and was only collected when landing within a hand\'s width of its middle. It now hangs in the hop to the next pad.',
  'Golden acorn a human cannot collect': 'Acorn spots in the level generator: a high acorn gets room to land before the next obstacle; a ledge acorn sits near the far end of a longer ledge.',
  'The only human-safe route takes damage': 'The level was regenerated with the fixed acorn spots; the human-limited player now finishes it without losing a heart.',
  'Camera shows too little of the trail ahead (after decision points, during rope flights)':
    'The decision-point shot now already shows viewAhead past the exit, and while running the camera is never allowed to show less than viewAhead(speed) ahead of the sprite (src/play/camera.ts), whatever the smoothing does.',
  [TOUCH]:
    'A touch now jumps at once (src/app/input.ts); a swipe down that follows turns it into a duck (no jump at all while still on the ground, a dive into the duck once in the air). The browser playtest runs the game at the pace of a real phone (60 frames a second) right after every touch, so a touch that only became a jump after some milliseconds shows up as the frames a player would see.',
  'Lifting the finger after the finish presses an end-screen button':
    'Buttons (end screens, seed cards, pause, ad buttons) only react to a press that started on them (`onPress` in src/ui/ui.ts), so a finger that was already down in the game cannot press them by being lifted.',
};

const pct = (n: number, d: number) => `${n}/${d}`;
function summary(sim: SimResult[], br: BrowserResult[], found: Found[]) {
  const fin = sim.filter((r) => r.finished).length;
  const all3 = sim.filter((r) => r.finished && r.acorns >= 3 && !r.problems.some((p) => /acorn/.test(p.text))).length;
  const ok = sim.filter((r) => r.problems.length === 0).length;
  const bOk = br.filter((r) => r.problems.length === 0).length;
  const deaths = sim.flatMap((r) => r.deaths);
  return [
    `- Human-limited playtest (simulation): **${pct(ok, sim.length)} levels without a problem**; ${pct(fin, sim.length)} can be finished, ${pct(all3, sim.length)} with all 3 golden acorns.`,
    `- Death probes: ${deaths.length} deaths at pits and lakes, ${deaths.filter((d) => /→/.test(d.hearts) && d.hearts.split(' → ')[0] !== d.hearts.split(' → ')[1].split(' ')[0]).length} of them cost a heart.`,
    br.length ? `- Real browser build: ${pct(bOk, br.length)} runs (desktop keyboard + phone touch) without a problem.` : '',
    `- **${group(found).length} causes, ${new Set(found.map((f) => f.cause + '|' + f.id)).size} level problems** (a cause in a level counts once) in ${new Set(found.map((f) => f.id)).size} levels; ${found.length} individual findings (every probed death, every device).`,
  ]
    .filter(Boolean)
    .join('\n');
}

function causes(found: Found[], withFix: boolean) {
  return group(found)
    .map(([cause, list]) => {
      const levels = [...new Set(list.map((f) => f.id))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const ex = [...new Map(list.map((f) => [f.id + f.where, f])).values()].slice(0, 6);
      return `### ${cause} — ${levels.length} level${levels.length > 1 ? 's' : ''} (${list.length} finding${list.length > 1 ? 's' : ''})

Levels: ${levels.join(', ')}

${ex.map((f) => `- ${f.id} (${f.where}): ${f.text}`).join('\n')}${list.length > ex.length ? `\n- … and ${list.length - ex.length} more of the same kind` : ''}${withFix && FIX[cause] ? `\n\n**Fix:** ${FIX[cause]}` : ''}`;
    })
    .join('\n\n');
}

/** short labels of the causes, for the table */
const SHORT: [RegExp, string][] = [
  [/bug A/, 'falls free'],
  [/bug B/, 'mushrooms'],
  [/Camera/, 'camera'],
  [/Touch jumps/, 'touch lag'],
  [/finger after the finish/, 'finger lift'],
  [/acorn/i, 'acorn'],
  [/damage/, 'damage'],
];
const short = (cause: string) => SHORT.find(([re]) => re.test(cause))?.[1] ?? cause;

function cell(r: SimResult | undefined, br: BrowserResult[], id: string, found: Found[] = []) {
  if (!r) return { done: '–', where: '', hearts: '', acorns: '', read: '', deaths: '', desk: '', phone: '' };
  const d = br.find((q) => q.id === id && q.device === 'desktop');
  const p = br.find((q) => q.id === id && q.device === 'phone');
  const b = (q?: BrowserResult) => {
    if (!q) return '–';
    const tags = [...new Set(found.filter((f) => f.id === id && f.where === q.device).map((f) => short(f.cause)))];
    return `${q.won ? `won, ${q.acorns}/3` : '**not won**'}${tags.length ? ` — ⚠ ${tags.join(', ')}` : ''}`;
  };
  const dc = r.deaths.length;
  const free = r.deaths.filter((x) => x.hearts.split(' → ')[0] === x.hearts.split(' → ')[1].split(' ')[0]).length;
  return {
    done: r.finished ? (r.problems.some((p) => /acorn/.test(p.text)) ? 'yes (acorn missing)' : 'yes') : '**no**',
    where: r.finished ? '' : r.failAt,
    hearts: String(r.heartsLost),
    acorns: `${r.acorns}/3`,
    read: r.minRead >= 99 ? '–' : `${r.minRead.toFixed(2)} s`,
    deaths: dc ? `${dc}${free ? `, ${free} free` : ''}` : '–',
    desk: b(d),
    phone: b(p),
  };
}

function table(sim: SimResult[], br: BrowserResult[], found: Found[]) {
  const rows = order.map((id) => {
    const r = sim.find((q) => q.id === id);
    const c = cell(r, br, id, found);
    return `| ${id} | ${r?.pieces.join(' + ') ?? ''} | ${c.done} | ${c.where} | ${c.hearts} | ${c.acorns} | ${c.read} | ${c.deaths} | ${c.desk} | ${c.phone} |`;
  });
  return `| Level | Set pieces | Completed | Where it failed | Hearts lost | Acorns (human) | Min. warning | Deaths probed | Browser desktop | Browser phone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}`;
}

function compare() {
  if (!simA) return '';
  const rows = order.map((id) => {
    const b = simB.results.find((q) => q.id === id)!;
    const a = simA.results.find((q) => q.id === id)!;
    const nb = before.filter((f) => f.id === id).length;
    const na = after!.filter((f) => f.id === id).length;
    const st = (r: SimResult) => (r.finished ? `${r.acorns}/3 acorns, ${r.heartsLost} hearts lost` : `stuck at ${r.failAt}`);
    return `| ${id} | ${st(b)} | ${nb} | ${st(a)} | ${na ? `**${na}**` : '0'} |`;
  });
  return `## Before and after, per level

| Level | Before (v1.1.0) | Problems before | After (v1.1.1) | Problems after |
| --- | --- | --- | --- | --- |
${rows.join('\n')}`;
}

const md = `# Playtest report

A "player-real" playtester played every shipped level — 5 worlds × 12 levels, the 5 Golden Groves and the whole daily
pool (30): 95 levels — with only what a human has, and every level was played again in the real browser build.

**How the human-limited playtester plays** (src/game/human.ts, scripts/playtest.ts)

- Only a finger's inputs: tap (finger down ${H.tap} s), full jump (${H.hold} s), glide (finger down until landing),
  swipe down, and picking a seed card at a decision point. Nothing reads hidden state; the plan only depends on the
  level as it is drawn, and everything to dodge must be on screen at least 1 s before it has to be dodged.
- Timing tolerance ±${H.jitter} s on every input: each press is also played ${H.jitter / 2} s and ${H.jitter} s early and late, and taps and
  holds with the finger lifted ${H.jitter} s earlier and later. A press is only used when every one of those still survives
  (no heart lost, no fall, no crocodile); a golden acorn only counts when every variant collects it.
- Reaction time: at least ${H.reaction} s between two presses, ${H.lift} s after the finger was lifted, and ${H.reaction} s after anything the
  player has to react to (a hit, a respawn, the end of a crossing). No frame-perfect tricks.
- It plays the real deterministic simulation (src/game/sim.ts) at each level's real speed (capped at 1.5x level 1).
- Death probes: about 1 s before every pit and crocodile lake of the human run, the finger is lifted and the sprite
  runs in by itself; the report records what that death costs.

**The browser playtest** (scripts/playtest-browser.ts) plays every level once in the web build (dist-web) on a desktop
viewport (1280×720, keyboard) and a phone viewport (390×844, touch), replaying the human run through the game's real
input path (key presses / touch gestures, clicks and taps on the seed cards). It checks that the level is won and the
end screen appears, that the hearts and acorns in the HUD always match the game, that the real camera keeps the
sprite on screen and shows at least viewAhead(speed) of the trail ahead, that every pit, thorn patch, log, stump, lake,
wind stretch and collapsing bridge is on screen at least 1 s before the sprite reaches it, what a fall costs in the HUD,
what lifting the finger after the finish does, and that there are no page errors. A screenshot of each level's main
set piece was taken on both devices and the contact sheets were looked through for visual breakage (none found:
every set piece, scenery variant, the dark caves and the waterfalls render as intended on both screens).

## Before the fixes (v1.1.0)

${summary(simB.results, brB, before)}

### Problems found, grouped by cause

${causes(before, !!simA)}

### Every level (before)

${table(simB.results, brB, before)}
${
  simA
    ? `
## After the fixes (v1.1.1)

${summary(simA.results, brA ?? [], after!)}

${after!.length ? `### Problems left\n\n${causes(after!, false)}` : '**Every level, Golden Grove and daily level passes the human-limited playtest and the browser playtest with zero problems.**'}

### Also found and fixed

- Picking a seed card handled the previous frame's events again: a card picked in the very frame the sprite stopped
  re-ran the stop and, with the last seed planted, showed the "out of seeds" screen (only reachable by a bot: the
  cards are not visible yet in that frame). \`Play.pick\` now handles only the planting's own events.
- The checks themselves: CI's level validator now uses the human-limited playtester instead of the frame-perfect bot,
  the fairness check also counts pits, and CI runs the browser playtest on every level (desktop and phone).

### Every level (after)

${table(simA.results, brA ?? [], after!)}

${compare()}
`
    : ''
}`;

writeFileSync('docs/playtest-report.md', md);
console.log(`docs/playtest-report.md: ${group(before).length} causes, ${new Set(before.map((f) => f.cause + '|' + f.id)).size} level problems before${after ? `, ${after.length} findings after` : ''}`);
for (const [c, l] of group(before)) console.log(`  ${new Set(l.map((f) => f.id)).size} levels, ${l.length} findings: ${c}`);
