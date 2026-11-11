/**
 * Drives the game in a Playwright page opened with `?capture` (frame-stepped clock): starts levels, lets the level
 * bot (src/game/bot.ts) play them through the game's real input path, skips ahead without rendering, records frames.
 * Shared by the preview screenshots and the preview video.
 */
import type { Browser, Page } from 'playwright';
import { chromium, GL_ARGS } from './pw.mjs';
import { planFor } from './plan';
import { levelById } from '../src/game/levels';

export interface GameState {
  mode: string;
  x: number;
  y: number;
  level: string;
  screen: string;
}

export class Driver {
  fps = 30;
  onFrame: (() => Promise<void>) | null = null;
  constructor(
    readonly browser: Browser,
    readonly page: Page,
  ) {}

  static async open(base: string, w: number, h: number, scale = 1) {
    const browser = await chromium.launch({ args: GL_ARGS });
    const phone = w < h;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale, hasTouch: phone, isMobile: phone });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(`${base}?capture`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 120_000 });
    return new Driver(browser, page);
  }

  async state(): Promise<GameState> {
    return this.page.evaluate(() => (window as unknown as { __game: { state(): GameState } }).__game.state());
  }

  /** start a level with the bot playing it (wrongFirst: at each decision point it first tries a wrong card) */
  async startBot(id: string, wrongFirst = false, think = 1.1) {
    const plan = planFor(levelById(id)!, wrongFirst);
    await this.page.evaluate(
      ([id, inputs, choices, think]) => {
        const g = (window as unknown as { __game: { start(id: string): void; replay(i: string, c: string[], t: number): void } }).__game;
        g.start(id);
        g.replay(inputs, choices, think);
      },
      [id, plan.inputs, plan.choices, think] as [string, string, string[], number],
    );
  }

  /** advance without rendering until `cond(state)` is true (a JS expression over `s`) */
  async skipUntil(cond: string, maxSec = 200) {
    const n = await this.page.evaluate(
      ([cond, max]) => {
        const g = (window as unknown as { __game: { tick(dt: number, r: boolean): void; state(): unknown } }).__game;
        const f = new Function('s', `return ${cond};`);
        let i = 0;
        for (; i < max * 60 && !f(g.state()); i++) g.tick(1 / 60, false);
        return i;
      },
      [cond, maxSec] as [string, number],
    );
    if (n >= maxSec * 60) throw new Error(`skipUntil timed out: ${cond}`);
  }

  /** play `sec` seconds, rendering every frame (recorded when onFrame is set) */
  async play(sec: number) {
    const n = Math.round(sec * this.fps);
    for (let i = 0; i < n; i++) {
      await this.page.evaluate((dt) => (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game.tick(dt, true), 1 / this.fps);
      if (this.onFrame) await this.onFrame();
    }
  }

  /** play until a condition holds, rendering (max seconds) */
  async playUntil(cond: string, maxSec = 30) {
    for (let t = 0; t < maxSec; t += 1 / this.fps) {
      const ok = await this.page.evaluate((c) => new Function('s', `return ${c};`)((window as unknown as { __game: { state(): unknown } }).__game.state()), cond);
      if (ok) return;
      await this.play(1 / this.fps);
    }
    throw new Error(`playUntil timed out: ${cond}`);
  }

  async shot(path: string) {
    await this.page.evaluate(() => {
      for (const a of document.getAnimations()) {
        try {
          if (a.effect?.getTiming().iterations !== Infinity) a.finish();
        } catch {}
      }
      (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game.tick(0, true);
    });
    await this.page.screenshot({ path, timeout: 180_000 });
    console.log('wrote', path);
  }

  close() {
    return this.browser.close();
  }
}
