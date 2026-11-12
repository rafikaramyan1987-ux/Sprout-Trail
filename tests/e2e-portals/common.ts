import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __game?: any;
    __ready?: boolean;
  }
}

export interface Boot {
  errors: string[];
  requests: string[];
}

/** open a portal build with `?capture` (the test drives the game clock); `route` fulfills or blocks the portal SDK */
export async function boot(page: Page, sdkUrl: string, stub: string | null): Promise<Boot> {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // a blocked SDK shows up as a failed resource load: the case under test, not a game error
    if (m.type() === 'error' && !(stub === null && /Failed to load resource|net::ERR/.test(m.text()))) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript('window.__name = (f) => f');
  await page.route(sdkUrl, (r) => (stub !== null ? r.fulfill({ contentType: 'application/javascript', body: stub }) : r.abort()));
  await page.goto('./?capture');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
  return { errors, requests };
}

export const state = (page: Page) => page.evaluate(() => window.__game.state() as { screen: string; paused: boolean; muted: boolean; hearts: number; mode: string; x: number });
export const screen = (page: Page) => page.evaluate(() => window.__game.screen() as string);
export async function sim(page: Page, s: number) {
  await page.evaluate((n) => {
    for (let k = 0; k < n; k++) window.__game.tick(1 / 60, k === n - 1);
  }, Math.round(s * 60));
}

/** `s` seconds of the real frame loop (requestAnimationFrame path: an ad pause stops it) */
export async function frames(page: Page, s: number) {
  await page.evaluate((n) => {
    for (let k = 0; k < n; k++) window.__game.frame(1 / 60);
  }, Math.round(s * 60));
}

/** finish the running level (the sprite runs into the goal) */
export async function win(page: Page) {
  await page.evaluate(() => {
    const g = window.__game;
    const L = g.level();
    const s = g.sim();
    s.solved.fill(1);
    Object.assign(s, { x: L.goalX - 1.5, y: L.goalY, vy: 0, grounded: true, mode: 'run' });
  });
  for (let i = 0; i < 20 && (await screen(page)) !== 'end'; i++) await sim(page, 0.5);
  await expect(page.locator('#end [data-act=retry]')).toBeVisible();
}

export async function lose(page: Page) {
  await page.evaluate(() => window.__game.lose());
  for (let i = 0; i < 20 && (await screen(page)) !== 'end'; i++) await sim(page, 0.5);
  await expect(page.locator('#end [data-act=retry]')).toBeVisible();
}

export const OTHER_PORTALS = /crazygames|gamedistribution|gamepix|playgama|gamemonetize|y8\.com/i;
