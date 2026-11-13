/**
 * Playtest, browser part: plays every level once in the real web build (dist-web, `?capture` frame-stepped clock)
 * on a desktop viewport with the keyboard and on a phone viewport with touch, replaying the human-limited
 * playtester's run (playtest-out/plans/<id>.json, from scripts/playtest.ts) through the game's real input path:
 * key presses / touch gestures and clicks / taps on the seed cards. It checks what the simulation test cannot:
 *  - the level is won in the browser and the end screen appears,
 *  - the hearts and acorns in the HUD always match the game state,
 *  - the real camera keeps the sprite on screen and shows at least viewAhead(speed) ahead of it (the distance the
 *    fairness check assumes), and every pit / thorn / log / stump / lake / wind / bridge is on screen at least 1 s
 *    before the sprite reaches it,
 *  - a fall (first pit of the level, finger lifted) costs a heart in the HUD,
 *  - no page errors.
 * Also saves a small screenshot of every level's main set piece (playtest-out/shots/).
 * usage: npm run playtest:browser [-- --tag=after] [--only=desktop|phone] [--no-shots] [ids...]
 *        (npm run build:web and npm run playtest first; exits 1 if any run has a problem)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, GL_ARGS } from './pw.mjs';
import { allLevels, levelById } from '../src/game/levels';
import { pitEdges } from '../src/game/fairness';
import { viewAhead, W } from '../src/game/physics';
import type { Level } from '../src/game/types';
import { choose, newSim, step } from '../src/game/sim';
import { Replay } from '../src/game/bot';
import type { Page, CDPSession } from 'playwright';

const args = process.argv.slice(2);
const tag = args.find((a) => a.startsWith('--tag='))?.slice(6) ?? 'latest';
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const ids = args.filter((a) => !a.startsWith('--'));
const PLANS = args.find((a) => a.startsWith('--plans='))?.slice(8) ?? 'playtest-out/plans';
const DIST = args.find((a) => a.startsWith('--dist='))?.slice(7) ?? 'dist-web';
// a free port of its own (several runs can go at once)
const PORT = await new Promise<number>((res) => {
  import('node:net').then(({ createServer }) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = (srv.address() as { port: number }).port;
      srv.close(() => res(p));
    });
  });
});
const BASE = `http://127.0.0.1:${PORT}/`;

export interface BrowserResult {
  id: string;
  device: 'desktop' | 'phone';
  won: boolean;
  endScreen: boolean;
  acorns: number;
  hearts: number;
  seconds: number;
  hudMismatch: string[];
  offScreen: number;
  shortView: { ticks: number; worst: number };
  lateThreats: string[];
  fall: string;
  errors: string[];
  problems: string[];
  ms: number;
}

/** static things to see coming (enemies move: they are covered by the view-ahead check) */
function threats(L: Level) {
  const t: { what: string; x: number }[] = [];
  for (const x of pitEdges(L)) t.push({ what: 'pit', x });
  for (const h of L.hazards) t.push({ what: 'thorns', x: h.x0 });
  for (const b of L.boxes) if (b.kind === 'log' || b.kind === 'stump') t.push({ what: b.kind === 'log' ? 'low log' : 'stump', x: b.x0 });
  for (const w of L.water) if (w.croc) t.push({ what: 'crocodile lake', x: w.x0 });
  for (const z of L.zones) if (z.kind === 'wind' || z.kind === 'collapse') t.push({ what: z.kind === 'wind' ? 'wind' : 'collapsing bridge', x: z.x0 });
  for (const m of L.movers) if (m.sinkAfter > 0) t.push({ what: `sinking ${m.kind}`, x: m.x0 - m.amp });
  // not the decision points' own obstacles: the sprite stops there by itself
  return t.filter((q) => !L.dps.some((d) => q.x >= d.stopX - 0.5 && q.x <= d.exitX));
}

/** finger / key changes of a plan, by index of run-mode tick */
function edges(inputs: string) {
  const out: { at: number; ev: 'jumpDown' | 'jumpUp' | 'duckDown' | 'duckUp' }[] = [];
  let j = false,
    d = false;
  for (let i = 0; i < inputs.length; i++) {
    const b = inputs.charCodeAt(i) - 65;
    const jh = !!(b & 2),
      dh = !!(b & 8);
    if (b & 1 || (jh && !j)) {
      if (j) out.push({ at: i, ev: 'jumpUp' });
      out.push({ at: i, ev: 'jumpDown' });
    } else if (!jh && j) out.push({ at: i, ev: 'jumpUp' });
    if (b & 4 || (dh && !d)) {
      if (d) out.push({ at: i, ev: 'duckUp' });
      out.push({ at: i, ev: 'duckDown' });
    } else if (!dh && d) out.push({ at: i, ev: 'duckUp' });
    j = jh;
    d = dh;
  }
  if (j) out.push({ at: inputs.length, ev: 'jumpUp' });
  if (d) out.push({ at: inputs.length, ev: 'duckUp' });
  return out;
}

class Finger {
  private cdp: CDPSession | null = null;
  private down = false;
  constructor(
    readonly page: Page,
    readonly touch: boolean,
  ) {}
  async init() {
    if (this.touch) this.cdp = await this.page.context().newCDPSession(this.page);
  }
  private get pt() {
    const v = this.page.viewportSize()!;
    return { x: Math.round(v.width * 0.6), y: Math.round(v.height * 0.55) };
  }
  async do(ev: 'jumpDown' | 'jumpUp' | 'duckDown' | 'duckUp') {
    if (!this.touch) {
      const key = ev.startsWith('jump') ? 'Space' : 'ArrowDown';
      if (ev.endsWith('Down')) await this.page.keyboard.down(key);
      else await this.page.keyboard.up(key);
      return;
    }
    const { x, y } = this.pt;
    const cdp = this.cdp!;
    // touch events reach the page asynchronously: wait until the page has really seen each one before the game goes on
    const seen = () => this.page.evaluate(() => (window as unknown as { __ptPointer: Record<string, number> }).__ptPointer);
    const waitFor = async (kind: string, n0: number) => {
      for (let i = 0; i < 200; i++) {
        if (((await seen())[kind] ?? 0) > n0) return;
        await this.page.waitForTimeout(5);
      }
      throw new Error(`the page never saw ${kind}`);
    };
    const c0 = await seen();
    if (ev === 'jumpDown' || ev === 'duckDown') {
      if (this.down) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await waitFor('up', c0.up ?? 0);
      }
      const c1 = await seen();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await waitFor('down', c1.down ?? 0);
      this.down = true;
      // a touch jumps at once; moving down turns it into a duck before the next tick
      if (ev === 'duckDown') {
        const c2 = await seen();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 45, id: 1 }] });
        await waitFor('move', c2.move ?? 0);
      }
    } else if (this.down) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await waitFor('up', c0.up ?? 0);
      this.down = false;
    }
  }
  /** a card is tapped with the finger lifted first (as a player does) */
  async lift() {
    if (this.touch && this.down) await this.do('jumpUp');
  }
}

/** in the page: step the game tick by tick until `until` run-mode ticks were used, a decision, or the end */
const STEP = `(() => {
  const g = window.__game;
  return (until, maxTicks) => {
    const pt = window.__pt;
    for (let n = 0; n < maxTicks; n++) {
      const s = g.sim();
      if (!s) return { why: 'nosim' };
      if (pt.runTicks >= until && s.mode === 'run') return { why: 'until', run: pt.runTicks };
      if (s.mode === 'decide' && document.querySelector('#dp:not(.hidden) .card:not(.used)')) return { why: 'decide', dp: s.dp };
      if (g.screen() === 'end') return { why: 'end' };
      const mode = s.mode, tick = s.tick;
      pt.frame++;
      g.tick(1 / 60, pt.frame % pt.renderEvery === 0);
      const t = g.sim();
      if (t.tick > tick && mode === 'run') {
        pt.runTicks++;
        if (pt.trace && pt.runTicks >= 550 && pt.runTicks <= 553) pt.dump = (pt.dump || []).concat([JSON.stringify(t, (_k, v) => (v instanceof Float64Array || v instanceof Uint8Array ? Array.from(v) : v))]);
        if (pt.trace) { const li = g.lastInput(); pt.trace.push((+li.jumpPressed | (+li.jumpHeld << 1) | (+li.duckPressed << 2) | (+li.duckHeld << 3)) + ':' + t.acorns + ':' + t.lastPickup + ':' + (t.ducking ? 'd' : '') + (t.holding ? 'h' : '') + (t.grounded ? 'g' : '')); }
      }
      if (t.tick === tick) continue;
      // HUD = game state
      const spans = [...document.querySelectorAll('[data-hearts] > span')].map((e) => e.innerHTML);
      pt.heartFull ??= spans[0];
      const hh = spans.filter((h) => h === pt.heartFull).length;
      if (hh !== t.hearts && pt.hud.length < 5) pt.hud.push('hearts HUD ' + hh + ' vs ' + t.hearts + ' at x ' + t.x.toFixed(1));
      const as = [...document.querySelectorAll('[data-acorns] > span')].map((e) => e.innerHTML);
      pt.acornEmpty ??= as[2];
      const ah = as.filter((h) => h !== pt.acornEmpty).length;
      if (ah !== t.acorns && pt.hud.length < 5) pt.hud.push('acorns HUD ' + ah + ' vs ' + t.acorns + ' at x ' + t.x.toFixed(1));
      if (t.mode !== 'run') continue;
      // the camera: sprite on screen, enough trail ahead
      const sp = g.screenOf(t.x, t.y + 0.6);
      // (a sprite falling into a pit leaves the screen at the bottom: that is the fall, not the camera)
      if (t.grounded) pt.groundY = t.y;
      const falling = t.y < (pt.groundY ?? t.y) - 1.5 && t.vy < 0;
      if (!falling && (sp.x < 0.02 || sp.x > 0.98 || sp.y < 0.02 || sp.y > 0.98)) pt.off++;
      const v = g.view(t.y + 0.6);
      const need = pt.ahead(Math.max(t.speed, t.vx));
      const have = v.right - t.x;
      if (have < need - 0.25) {
        pt.short++;
        pt.worst = Math.min(pt.worst, have / need);
        if (!pt.inShort && pt.shortAt.length < 6) pt.shortAt.push('x ' + t.x.toFixed(1) + ' (' + (have / need * 100).toFixed(0) + '%' + (t.rope >= 0 ? ', rope' : '') + (!t.grounded ? ', air vx ' + t.vx.toFixed(1) : '') + ')');
        pt.inShort = true;
      } else pt.inShort = false;
      for (const q of pt.threats) {
        if (q.seen < 0 && v.right >= q.x) q.seen = t.et;
        if (q.met < 0 && q.x - (t.x + pt.W / 2) <= 0.3) q.met = t.et;
      }
    }
    return { why: 'max', run: pt.runTicks };
  };
})()`;

async function playLevel(page: Page, finger: Finger, srcLevel: Level, plan: { inputs: string; choices: string[]; finished?: boolean; acorns?: number }, device: 'desktop' | 'phone', shot: boolean): Promise<BrowserResult> {
  const t0 = Date.now();
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(e.message);
  page.on('pageerror', onErr);
  // the level as this build makes it (a build of other code makes other levels)
  const json = await page.evaluate((id) => {
    const g = (window as unknown as { __game: { start(id: string): void; level(): unknown } }).__game;
    g.start(id);
    return JSON.stringify(g.level());
  }, srcLevel.id);
  const L = JSON.parse(json) as Level;
  const sameCode = json === JSON.stringify(srcLevel);
  const th = threats(L).map((q) => ({ ...q, seen: -1, met: -1 }));
  await page.evaluate(
    ([id, th, W]) => {
      const w = window as unknown as { __game: { start(id: string): void }; __pt: unknown };
      w.__game.start(id as string);
      w.__pt = { trace: (window as unknown as { __trace?: boolean }).__trace ? [] : null, runTicks: 0, frame: 0, renderEvery: 1e9, hud: [], shortAt: [], inShort: false, off: 0, short: 0, worst: 1, threats: th, W, ahead: (v: number) => v * 1.25 + 2.6 };
    },
    [L.id, th, W] as [string, unknown, number],
  );
  // drawn before its first update, as the title screen does (Bug 4: a stale InstancedMesh bounding sphere hid every
  // gem); then everything that should be seen is checked after the first stretch of play and at the end
  await page.evaluate(() => (window as unknown as { __game: { render(): void } }).__game.render());
  const rendered = new Set<string>();
  const audit = async (when: string) => {
    for (const p of await page.evaluate(() => (window as unknown as { __game: { audit(): string[] } }).__game.audit())) rendered.add(`not drawn (${when}): ${p}`);
  };
  let audited = false;
  // the page's view-ahead formula must be the game's
  if (Math.abs(viewAhead(5) - (5 * 1.25 + 2.6)) > 1e-9) throw new Error('viewAhead changed: update playtest-browser.ts');
  const ed = edges(plan.inputs);
  const expect = sameCode ? expectedX(L, plan, ed.map((q) => q.at)) : [];
  let diverged = '';
  let endWhy = 'loop end';
  let e = 0,
    c = 0;
  const shotX = shotPoint(L);
  let shotDone = !shot;
  // after a touch, the game runs at the pace of a real phone (60 frames a second) for a few frames: a touch that the
  // game only turns into a jump after some milliseconds is then late by the frames a player would see
  let paced = 0;
  let runNow = 0;
  for (let guard = 0; guard < 20000; guard++) {
    let until = e < ed.length ? ed[e].at : 1e9;
    if (paced > 0) {
      until = Math.min(until, runNow + 1);
      paced--;
      await page.waitForTimeout(17);
    }
    const maxTicks = shotDone ? 600 : 30;
    const r = await page.evaluate(([until, max]) => (window as unknown as Record<string, (u: number, m: number) => { why: string; run?: number }>).__ptStep(until, max), [until, maxTicks] as [number, number]);
    runNow = r.run ?? runNow;
    if (!audited && runNow > 120) {
      audited = true;
      await audit('2 s in');
    }
    if (!shotDone) {
      const x = await page.evaluate(() => (window as unknown as { __game: { sim(): { x: number } } }).__game.sim().x);
      if (x >= shotX) {
        await page.evaluate(() => (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game.tick(0, true));
        mkdirSync(`playtest-out/shots-${tag}`, { recursive: true });
        await page.screenshot({ path: `playtest-out/shots-${tag}/${L.id}-${device}.jpg`, type: 'jpeg', quality: 60, timeout: 90000 });
        shotDone = true;
      }
    }
    if (r.why === 'until') {
      if (sameCode && !diverged && e < ed.length && runNow === ed[e].at) {
        const x = await page.evaluate(() => (window as unknown as { __game: { sim(): { x: number } } }).__game.sim().x);
        if (Math.abs(x - expect[e]) > 1e-6) diverged = `the browser run left the planned run before press ${e + 1} (x ${x.toFixed(2)}, planned ${expect[e].toFixed(2)})`;
      }
      while (e < ed.length && ed[e].at <= runNow) {
        if (device === 'phone' && ed[e].ev === 'jumpDown') paced = 8;
        await finger.do(ed[e++].ev);
      }
    } else if (r.why === 'decide') {
      if (process.env.PT_DEBUG) console.log('decide', await page.evaluate(() => JSON.stringify((({ seeds, dp, mode, tick }) => ({ seeds, dp, mode, tick }))((window as unknown as { __game: { sim(): { seeds: number; dp: number; mode: string; tick: number } } }).__game.sim()))));
      const k = plan.choices[c++];
      if (!k) {
        endWhy = `no card for decision ${(r as { dp?: number }).dp}`;
        break;
      }
      const sel = `#dp .card[data-plant="${k}"]`;
      // a player reads the cards before picking one: 0.6 s at the cards (the simulation stands still meanwhile)
      await page.evaluate(() => {
        const g = (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game;
        for (let i = 0; i < 36; i++) g.tick(1 / 60, false);
      });
      // the cards slide up in 0.45 s of real time; frame-stepped capture does not advance CSS animations by itself
      await page.evaluate(() => {
        for (const a of document.getAnimations()) {
          try {
            if (a.effect?.getTiming().iterations !== Infinity) a.finish();
          } catch {}
        }
      });
      await finger.lift();
      try {
        if (device === 'phone') await page.tap(sel, { timeout: 20000 });
        else await page.click(sel, { timeout: 20000 });
      } catch (err) {
        throw new Error(String(err).split('\n').filter((l) => !l.includes('waiting for')).join(' ').slice(0, 1500));
      }
    } else if (r.why === 'end' || r.why === 'nosim') {
      if (process.env.PT_DEBUG) console.log('end', await page.evaluate(() => JSON.stringify((({ seeds, dp, mode, tick }) => ({ seeds, dp, mode, tick }))((window as unknown as { __game: { sim(): { seeds: number; dp: number; mode: string; tick: number } } }).__game.sim()))), await page.evaluate(() => document.querySelector('#end h2')?.textContent));
      endWhy = r.why;
      break;
    }
    else if (r.why === 'max') {
      const st = await page.evaluate(() => (window as unknown as { __game: { state(): { mode: string } } }).__game.state());
      if (st.mode === 'lost') {
        // the lose screen takes a moment
        await page.evaluate(() => {
          const g = (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game;
          for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
        });
        break;
      }
      if (guard > 400 && e >= ed.length) {
        endWhy = 'gave up';
        break;
      }
    }
  }
  const out = await page.evaluate(() => {
    const w = window as unknown as { __game: { state(): { mode: string; acorns: number; hearts: number }; screen(): string; sim(): { tick: number } }; __pt: { hud: string[]; off: number; short: number; worst: number; shortAt: string[]; threats: { what: string; x: number; seen: number; met: number }[] } };
    const s = w.__game.state();
    return { x: (s as unknown as { x: number }).x, mode: s.mode, acorns: s.acorns, hearts: s.hearts, end: w.__game.screen() === 'end' && !!document.querySelector('#end'), tick: w.__game.sim().tick, pt: w.__pt };
  });
  // the finger is still down when the level ends: lifting it must not press a button on the end screen
  await audit('at the end');
  const before = await page.evaluate(() => (window as unknown as { __game: { state(): { level: string; mode: string }; screen(): string } }).__game.screen());
  for (const ev of ['jumpUp', 'duckUp'] as const) await finger.do(ev);
  const after = await page.evaluate(() => (window as unknown as { __game: { state(): { level: string; mode: string } | null; screen(): string } }).__game.screen());
  const lift = before !== after ? `lifting the finger after the finish pressed a button on the end screen (${before} → ${after})` : '';
  if (process.env.PT_TRACE) {
    const tr = await page.evaluate(() => (window as unknown as { __pt: { trace: string[] } }).__pt.trace);
    const exp = traceX(L, plan);
    const i = tr.findIndex((x, k) => x !== exp[k]);
    const dump = await page.evaluate(() => (window as unknown as { __pt: { dump: string[] } }).__pt.dump);
    const simDump = traceStates(L, plan, 550, 553);
    for (let k = 0; k < dump.length; k++) {
      const a = JSON.parse(dump[k]),
        b = JSON.parse(simDump[k]);
      console.log('DIFF', k, Object.keys(a).filter((q) => JSON.stringify(a[q]) !== JSON.stringify(b[q])).map((q) => `${q}: ${JSON.stringify(a[q])} vs ${JSON.stringify(b[q])}`).join(' | ').slice(0, 900));
    }
    console.log('TRACE first mismatch at run tick', i, '\nbrowser', tr.slice(Math.max(0, i - 4), i + 3).join(' '), '\nsim    ', exp.slice(Math.max(0, i - 4), i + 3).join(' '), '\n', 'press edges near', ed.filter((q) => Math.abs(q.at - i) < 12).map((q) => `${q.ev}@${q.at}`).join(' '));
  }
  const late = out.pt.threats.filter((q) => q.met >= 0 && (q.met - Math.max(0, q.seen)) / 60 < 1).map((q) => `${q.what} at x ${q.x.toFixed(1)} on screen ${((q.met - Math.max(0, q.seen)) / 60).toFixed(2)} s`);
  // a fall costs a heart (the first pit, finger lifted 1 s before it)
  const fall = await fallProbe(page, L, plan);
  page.off('pageerror', onErr);
  const problems: string[] = [];
  const won = out.mode === 'won';
  if (!won) problems.push(`not won in the browser (${out.mode} at x ${out.x.toFixed(1)}, presses ${e}/${ed.length}, cards ${c}/${plan.choices.length}, ${endWhy})`);
  if (won && !out.end) problems.push('the end screen did not appear');
  problems.push(...rendered);
  if (won && out.acorns < 3) problems.push(`only ${out.acorns} golden acorns in the browser`);
  // the real input path reproduces the playtester's run
  if (plan.finished !== undefined && (won !== plan.finished || (won && out.acorns !== plan.acorns))) problems.push(`the browser run ended differently from the simulated run (${won ? `won, ${out.acorns} acorns` : 'not won'} vs ${plan.finished ? `won, ${plan.acorns} acorns` : 'not finished'})`);
  for (const h of out.pt.hud) problems.push(`HUD: ${h}`);
  if (out.pt.off > 0) problems.push(`sprite off screen for ${out.pt.off} ticks`);
  if (diverged) problems.push(diverged);
  if (lift) problems.push(lift);
  if (out.pt.short > 0) problems.push(`camera shows less than viewAhead for ${out.pt.short} ticks (worst ${(out.pt.worst * 100).toFixed(0)}%) at ${out.pt.shortAt.join(', ')}`);
  for (const l of late) problems.push(`late: ${l}`);
  if (fall && !fall.startsWith('ok')) problems.push(fall);
  for (const er of errors) problems.push(`page error: ${er}`);
  return {
    id: L.id,
    device,
    won,
    endScreen: out.end,
    acorns: out.acorns,
    hearts: out.hearts,
    seconds: out.tick / 60,
    hudMismatch: out.pt.hud,
    offScreen: out.pt.off,
    shortView: { ticks: out.pt.short, worst: out.pt.worst },
    lateThreats: late,
    fall,
    errors,
    problems,
    ms: Date.now() - t0,
  };
}

/** the planned sim x at the start of run-tick `at` for every edge */
function expectedX(L: Level, plan: { inputs: string; choices: string[] }, ats: number[]) {
  const dec = [...plan.inputs].map((ch) => {
    const b = ch.charCodeAt(0) - 65;
    return { jumpPressed: !!(b & 1), jumpHeld: !!(b & 2), duckPressed: !!(b & 4), duckHeld: !!(b & 8) };
  });
  const s = newSim(L);
  const r = new Replay({ inputs: dec, choices: plan.choices as never });
  const out: number[] = [];
  let run = 0,
    k = 0;
  for (let i = 0; i < 60 * 300 && s.mode !== 'won' && s.mode !== 'lost' && k < ats.length; i++) {
    if (s.mode === 'decide') {
      const c = r.choice();
      if (!c || !choose(L, s, c)) break;
    }
    while (k < ats.length && s.mode === 'run' && run === ats[k]) out[k++] = s.x;
    if (s.mode === 'run') run++;
    step(L, s, r.input(s));
  }
  return out;
}

/** the sim x after every run-mode tick of a plan (PT_TRACE debugging) */
function traceX(L: Level, plan: { inputs: string; choices: string[] }) {
  const dec = [...plan.inputs].map((ch) => {
    const b = ch.charCodeAt(0) - 65;
    return { jumpPressed: !!(b & 1), jumpHeld: !!(b & 2), duckPressed: !!(b & 4), duckHeld: !!(b & 8) };
  });
  const s = newSim(L);
  const r = new Replay({ inputs: dec, choices: plan.choices as never });
  const out: string[] = [];
  for (let i = 0; i < 60 * 300 && s.mode !== 'won' && s.mode !== 'lost'; i++) {
    if (s.mode === 'decide') {
      const c = r.choice();
      if (!c || !choose(L, s, c)) break;
    }
    const wasRun = s.mode === 'run';
    const inp = r.input(s);
    step(L, s, inp);
    if (wasRun) out.push((+inp.jumpPressed | (+inp.jumpHeld << 1) | (+inp.duckPressed << 2) | (+inp.duckHeld << 3)) + ':' + s.acorns + ':' + s.lastPickup + ':' + (s.ducking ? 'd' : '') + (s.holding ? 'h' : '') + (s.grounded ? 'g' : ''));
  }
  return out;
}

function traceStates(L: Level, plan: { inputs: string; choices: string[] }, from: number, to: number) {
  const dec = [...plan.inputs].map((ch) => {
    const b = ch.charCodeAt(0) - 65;
    return { jumpPressed: !!(b & 1), jumpHeld: !!(b & 2), duckPressed: !!(b & 4), duckHeld: !!(b & 8) };
  });
  const s = newSim(L);
  const r = new Replay({ inputs: dec, choices: plan.choices as never });
  const out: string[] = [];
  let run = 0;
  for (let i = 0; i < 60 * 300 && s.mode !== 'won' && s.mode !== 'lost' && run <= to; i++) {
    if (s.mode === 'decide') {
      const c = r.choice();
      if (!c || !choose(L, s, c)) break;
    }
    const wasRun = s.mode === 'run';
    step(L, s, r.input(s));
    if (wasRun) {
      run++;
      if (run >= from && run <= to) out.push(JSON.stringify(s, (_k, v) => (v instanceof Float64Array || v instanceof Uint8Array ? Array.from(v) : v)));
    }
  }
  return out;
}

/** where the screenshot is taken: in the middle of the level's main set piece */
function shotPoint(L: Level) {
  const p = L.pieces[0];
  const z = L.zones.find((q) => q.kind === p || (p === 'chase' && q.kind === 'chase'));
  if (z) return z.x0 + Math.min(8, (z.x1 - z.x0) / 2);
  const kind = { planks: 'plank', logs: 'log', lily: 'lily', shrooms: 'shroom' }[p as string];
  const m = kind ? L.movers.find((q) => q.kind === kind) : null;
  if (m) return m.x0 + 2;
  if (p === 'ropes' && L.ropes.length) return L.ropes[0].x;
  return L.goalX / 2;
}

/** replay up to 1 s before the first pit, lift the finger, and look at the hearts after the fall */
async function fallProbe(page: Page, L: Level, plan: { inputs: string; choices: string[] }) {
  const pit = pitEdges(L).find((x) => !L.water.some((w) => w.croc && x >= w.x0 - 0.5 && x <= w.x1));
  if (pit === undefined) return '';
  await page.evaluate(
    ([id, inputs, choices]) => {
      const g = (window as unknown as { __game: { start(id: string): void; replay(i: string, c: string[], t: number, d: boolean): void } }).__game;
      g.start(id as string);
      g.replay(inputs as string, choices as unknown as string[], 0.05, false);
    },
    [L.id, plan.inputs, plan.choices] as unknown as [string, string, string],
  );
  return page.evaluate(
    ([pit]) => {
      const g = (window as unknown as { __game: { tick(dt: number, r: boolean): void; sim(): { x: number; mode: string; speed: number; hearts: number; events: string[] }; stopReplay?: () => void; screen(): string } }).__game;
      for (let i = 0; i < 60 * 200; i++) {
        const s = g.sim();
        if (s.mode === 'run' && s.x >= pit - s.speed * 1.0) break;
        if (s.mode === 'won' || s.mode === 'lost') return 'probe: never reached the pit';
        g.tick(1 / 60, false);
      }
      // lift the finger: no more inputs
      const sim = g.sim();
      const p = (window as unknown as { __game: { replay(i: string, c: string[], t: number, d: boolean): void } }).__game;
      p.replay('', [], 0.05, false);
      const h0 = sim.hearts;
      const hudCount = () => {
        const spans = [...document.querySelectorAll('[data-hearts] > span')].map((e) => e.innerHTML);
        const full = spans.filter((x) => x === (window as unknown as { __pt: { heartFull: string } }).__pt.heartFull).length;
        return full;
      };
      let x0 = sim.x;
      for (let i = 0; i < 60 * 6; i++) {
        g.tick(1 / 60, false);
        const s = g.sim();
        if (s.x < x0 - 3 || s.mode === 'lost') {
          // respawned (or out of hearts)
          for (let k = 0; k < 10; k++) g.tick(1 / 60, false);
          const t = g.sim();
          const hud = hudCount();
          if (t.hearts === h0) return `a fall at x ${pit.toFixed(1)} costs no heart (hearts ${h0} → ${t.hearts}, HUD ${hud})`;
          if (hud !== t.hearts) return `after a fall the HUD shows ${hud} hearts, the game has ${t.hearts}`;
          return `ok: fall at x ${pit.toFixed(1)}: hearts ${h0} → ${t.hearts}, HUD ${hud}`;
        }
        x0 = Math.max(x0, s.x);
      }
      return '';
    },
    [pit] as [number],
  );
}

async function main() {
  const levels = (ids.length ? ids.map((id) => levelById(id)!) : allLevels()).filter((L) => existsSync(`${PLANS}/${L.id}.json`));
  const server = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const devices = (['desktop', 'phone'] as const).filter((d) => !only || only === d);
  const results: BrowserResult[] = [];
  const workers = Number(process.env.PT_WORKERS ?? 3);
  try {
    for (const device of devices) {
      const queue = [...levels];
      await Promise.all(
        Array.from({ length: workers }, async () => {
          const browser = await chromium.launch({ args: GL_ARGS });
          const phone = device === 'phone';
          const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone, isMobile: phone });
          await page.addInitScript('window.__name = (f) => f');
          await page.addInitScript(`window.__ptPointer = { down: 0, up: 0, move: 0 };
            addEventListener('pointerdown', () => __ptPointer.down++, true);
            addEventListener('pointerup', () => __ptPointer.up++, true);
            addEventListener('pointercancel', () => __ptPointer.up++, true);
            addEventListener('pointermove', () => __ptPointer.move++, true);`);
          if (process.env.PT_TRACE) await page.addInitScript('window.__trace = true');
          await page.goto(`${BASE}?capture&nosdk`);
          await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 120_000 });
          await page.evaluate((f) => ((window as unknown as Record<string, unknown>).__ptStep = (0, eval)(f)), STEP);
          const finger = new Finger(page, phone);
          await finger.init();
          for (let L = queue.shift(); L; L = queue.shift()) {
            const plan = JSON.parse(readFileSync(`${PLANS}/${L.id}.json`, 'utf8'));
            let r: BrowserResult;
            try {
              r = await playLevel(page, finger, L, plan, device, !args.includes('--no-shots'));
            } catch (err) {
              r = { id: L.id, device, won: false, endScreen: false, acorns: 0, hearts: 0, seconds: 0, hudMismatch: [], offScreen: 0, shortView: { ticks: 0, worst: 1 }, lateThreats: [], fall: '', errors: [String(err)], problems: [`browser run crashed: ${String(err).slice(0, 200)}`], ms: 0 };
            }
            results.push(r);
            console.log(`${device} ${L.id}: ${r.won ? 'won' : 'NOT WON'} ${r.acorns}/3 hearts ${r.hearts} ${(r.ms / 1000).toFixed(0)}s ${r.problems.join(' | ')}`);
          }
          await browser.close();
        }),
      );
    }
  } finally {
    server.kill();
  }
  mkdirSync('playtest-out', { recursive: true });
  const prev = existsSync(`playtest-out/browser-${tag}.json`) && ids.length ? (JSON.parse(readFileSync(`playtest-out/browser-${tag}.json`, 'utf8')) as BrowserResult[]) : [];
  const merged = [...prev.filter((p) => !results.some((r) => r.id === p.id && r.device === p.device)), ...results];
  writeFileSync(`playtest-out/browser-${tag}.json`, JSON.stringify(merged, null, 1));
  const bad = results.filter((r) => r.problems.length);
  console.log(`${results.length - bad.length}/${results.length} browser runs without problems`);
  if (bad.length && !args.includes('--report-only')) process.exit(1);
}

await main();
