// Zero-errors harness (docs/robustness.md). Runs the CrazyGames build (dist/) with a stand-in SDK in the
// `crazygames` environment that forwards every uncaught error and unhandled rejection the way the real SDK does
// (CrazyGames counts them as crashes), and collects every other signal a player or a portal could see:
// Playwright `pageerror`, console errors, failed requests nobody injected, the game's own last-resort record
// (`window.__errors`, src/app/guard.ts), loading that never reaches loadingStop, gameplayStart before loadingStop.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __game?: any;
    __ready?: boolean;
    __errors?: string[];
    __cgReported?: string[];
    __cgEvents?: string[];
    __adMode?: AdMode;
    __lost?: number;
    __cgStore?: Map<string, string>;
  }
}

/** ok: plays and finishes; error: adError; blocked: requestAd throws; nofill: never answers; hung: starts, never ends */
export type AdMode = 'ok' | 'error' | 'blocked' | 'nofill' | 'hung';
export interface Opts {
  /** a save in localStorage (fixture name in fixtures/, or an object) */
  save?: string | object;
  adMode?: AdMode;
  /** private mode: every localStorage / sessionStorage access throws */
  noStorage?: boolean;
  /** Progress Save off: the Data Module throws `dataModuleDisabled` */
  dataDisabled?: boolean;
  /** requests whose URL (without query) matches are aborted, `failTimes` times per URL (default: always) */
  fail?: RegExp;
  failTimes?: number;
  /** the browser cannot create a WebGL context */
  noWebgl?: boolean;
  /** extra query (the game runs with ?capture: the test drives its clock) */
  query?: string;
}

export const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
export const SAVE_KEY = 'sprout-trail-save';

export interface Run {
  /** everything that would have been reported (must stay empty) */
  problems(): Promise<string[]>;
  events(): Promise<string[]>;
  injected: string[];
}

export async function start(page: Page, info: TestInfo, o: Opts = {}): Promise<Run> {
  const consoleErr: string[] = [];
  const pageErrors: string[] = [];
  const failedReq: string[] = [];
  const injected: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // the browser's own line for a request the test aborted (not a script error)
    if (injected.length && /Failed to load resource|NetworkError|net::ERR_FAILED|Loading failed|load failed|due to access control|cancelled/i.test(t)) return;
    // the no-WebGL test: three.js says it could not create a context, and the game records why it shows the card
    if (o.noWebgl && /WebGL|\[sprout-trail\] boot/.test(t)) return;
    // Firefox: a font download the page itself cancelled by reloading
    if (/downloadable font: download failed .*status=2152398850/.test(t)) return;
    consoleErr.push(`console.error: ${t}`);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (injected.includes(u) || !u.startsWith('http://127.0.0.1') || /cancelled|ERR_ABORTED|NS_BINDING_ABORTED/i.test(r.failure()?.errorText ?? '')) return;
    failedReq.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
  });

  if (o.fail) {
    const n = new Map<string, number>();
    await page.route(/127\.0\.0\.1/, async (route) => {
      const u = route.request().url();
      const k = u.split('?')[0];
      if (o.fail!.test(k) && (n.get(k) ?? 0) < (o.failTimes ?? Infinity)) {
        n.set(k, (n.get(k) ?? 0) + 1);
        injected.push(u);
        return route.abort('failed');
      }
      return route.continue().catch(() => {});
    });
  }

  await page.addInitScript(
    ({ noStorage, noWebgl, dataDisabled, save, key }) => {
      window.__cgReported = [];
      window.__lost = 0;
      if (noStorage)
        for (const k of ['localStorage', 'sessionStorage'])
          Object.defineProperty(window, k, {
            configurable: true,
            get() {
              throw new DOMException('The operation is insecure.', 'SecurityError');
            },
          });
      else if (save) localStorage.setItem(key, save);
      const gc = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (noWebgl && /webgl/.test(type)) return null;
        if (/webgl/.test(type) && !(this as unknown as { __w?: 1 }).__w) {
          (this as unknown as { __w?: 1 }).__w = 1;
          this.addEventListener('webglcontextlost', () => (window.__lost = (window.__lost ?? 0) + 1));
        }
        return (gc as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof gc;
      // CrazyGames SDK v3 stand-in, `crazygames` environment
      const events: string[] = (window.__cgEvents = []);
      const store = (window.__cgStore = new Map<string, string>());
      if (save) store.set(key, save);
      window.__adMode = window.__adMode ?? 'ok';
      const disabled = () => {
        throw { code: 'dataModuleDisabled', message: 'The data module is disabled.' };
      };
      (window as unknown as { CrazyGames: unknown }).CrazyGames = {
        SDK: {
          environment: 'crazygames',
          async init() {
            await new Promise((r) => setTimeout(r, 30));
            // what the real SDK does after init: every uncaught error / unhandled rejection goes to CrazyGames
            addEventListener('error', (e) => window.__cgReported!.push(`error: ${e.message}`));
            addEventListener('unhandledrejection', (e) => window.__cgReported!.push(`unhandledrejection: ${(e.reason && (e.reason.message || e.reason)) ?? ''}`));
          },
          game: {
            gameplayStart: () => events.push('gameplayStart'),
            gameplayStop: () => events.push('gameplayStop'),
            loadingStart: () => events.push('loadingStart'),
            loadingStop: () => events.push('loadingStop'),
            happytime: () => events.push('happytime'),
            settings: { muteAudio: false },
            addSettingsChangeListener: () => {},
          },
          ad: {
            requestAd(type: string, cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }) {
              events.push(`ad:${type}`);
              const m = window.__adMode;
              if (m === 'blocked') throw new Error('adblock');
              if (m === 'nofill') return; // nothing ever comes back
              if (m === 'error') return void setTimeout(() => cb.adError?.({ code: 'unfilled', message: 'No ad available' }), 150);
              setTimeout(() => {
                cb.adStarted?.();
                if (m === 'ok') setTimeout(() => cb.adFinished?.(), 400);
              }, 150);
            },
          },
          data: dataDisabled
            ? { getItem: disabled, setItem: disabled, removeItem: disabled }
            : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) },
          user: { systemInfo: { locale: 'en-US', countryCode: 'US' } },
        },
      };
    },
    {
      noStorage: !!o.noStorage,
      noWebgl: !!o.noWebgl,
      dataDisabled: !!o.dataDisabled,
      save: o.save === undefined ? null : typeof o.save === 'string' ? fixture(o.save) : JSON.stringify(o.save),
      key: SAVE_KEY,
    },
  );
  if (o.adMode) await page.addInitScript((m) => (window.__adMode = m), o.adMode);
  await page.addInitScript('window.__name = (f) => f');

  await page.goto(`/?${['capture', o.query].filter(Boolean).join('&')}`);
  info.annotations.push({ type: 'scenario', description: JSON.stringify({ ...o, save: typeof o.save === 'string' ? o.save : o.save ? 'object' : undefined, fail: o.fail?.source }) });

  return {
    injected,
    async problems() {
      const inPage = await page
        .evaluate(() => ({ reported: window.__cgReported ?? [], guard: window.__errors ?? [], lost: window.__lost ?? 0 }))
        .catch(() => ({ reported: [] as string[], guard: [] as string[], lost: 0 }));
      const guard = inPage.guard.filter((g) => !(o.noWebgl && /^boot: WebGL/.test(g)));
      return [...pageErrors, ...consoleErr, ...failedReq, ...inPage.reported.map((r) => `reported to CrazyGames: ${r}`), ...guard.map((g) => `guard: ${g}`)];
    },
    events: () => page.evaluate(() => window.__cgEvents ?? []),
  };
}

/** the loading screen is done: __ready, the overlay gone, loadingStop sent and never after a gameplayStart */
export async function loaded(page: Page, run: Run) {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });
  const ev = await run.events();
  expect(ev[0]).toBe('loadingStart');
  expect(ev).toContain('loadingStop');
  const g = ev.indexOf('gameplayStart');
  if (g >= 0) expect(g).toBeGreaterThan(ev.indexOf('loadingStop'));
}

export const state = (page: Page) => page.evaluate(() => window.__game.state() as { mode: string; x: number; screen: string; level: string; hearts: number; acorns: number } | null);
export const screen = (page: Page) => page.evaluate(() => window.__game.screen() as string);

/** game seconds without drawing (software WebGL is slow), then one drawn frame */
export async function sim(page: Page, s: number) {
  await page.evaluate((n) => {
    for (let k = 0; k < n; k++) window.__game.tick(1 / 60, k === n - 1);
  }, Math.round(s * 60));
}

/** a few drawn frames (the renderer, not just the logic) */
export const frames = (page: Page, n = 4) =>
  page.evaluate((n) => {
    for (let i = 0; i < n; i++) window.__game.tick(1 / 30, true);
  }, n);

/** the title's Play: into the level behind the menu */
export async function play(page: Page) {
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 30_000 }).toBe('play');
  await sim(page, 1);
}

/** finish the running level: the sprite is put just before the goal and runs in; the win screen shows */
export async function win(page: Page) {
  await page.evaluate(() => {
    const g = window.__game;
    const L = g.level();
    const sm = g.sim();
    // every decision point counts as crossed (an unsolved one holds the sprite back like a fence)
    sm.solved.fill(1);
    Object.assign(sm, { x: L.goalX - 1.5, y: L.goalY, vy: 0, grounded: true, mode: 'run' });
  });
  for (let i = 0; i < 20 && (await screen(page)) !== 'end'; i++) await sim(page, 0.5);
  await expect(page.locator('#end [data-act=retry]')).toBeVisible();
  await frames(page, 2);
}

/** lose the running level (out of hearts): the lost screen shows */
export async function lose(page: Page) {
  await page.evaluate(() => window.__game.lose());
  for (let i = 0; i < 20 && (await screen(page)) !== 'end'; i++) await sim(page, 0.5);
  await expect(page.locator('#end [data-act=retry]')).toBeVisible();
}

/** a result-screen button (next / retry / menu); waits until the game has gone on (an ad that never answers settles
 *  within AD_TIMEOUT; `fastForward` moves the page clock past AD_MAX for an ad that starts and never ends) */
export async function press(page: Page, act: 'next' | 'retry' | 'menu', fastForward = 0) {
  await page.locator(`#end [data-act=${act}]`).click();
  if (fastForward) {
    // the ad has started (the stand-in SDK starts it after 150 ms), then the page clock jumps past AD_MAX
    await page.waitForTimeout(2000);
    await page.clock.fastForward(fastForward);
  }
  await expect.poll(() => screen(page), { timeout: 40_000 }).not.toBe('ad');
  await expect.poll(() => screen(page), { timeout: 10_000 }).not.toBe('end');
  await frames(page, 2);
}

export async function clean(run: Run) {
  expect(await run.problems()).toEqual([]);
}
