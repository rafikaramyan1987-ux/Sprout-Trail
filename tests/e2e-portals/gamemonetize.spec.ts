// Smoke test of the GameMonetize build (dist-gamemonetize/) with a stand-in for GameMonetize's sdk.js.
import { expect, test } from '@playwright/test';
import { boot, lose, OTHER_PORTALS, screen, sim, state, win } from './common';

declare global {
  interface Window {
    __gm?: { calls: number; hold: boolean; finish?: () => void };
  }
}

const GM_SDK = 'https://api.gamemonetize.com/sdk.js';
/** SDK_READY at load; showBanner() sends SDK_GAME_PAUSE, then (unless held) SDK_GAME_START after 300 ms */
const STUB = `(() => {
  const ev = (name) => window.SDK_OPTIONS && window.SDK_OPTIONS.onEvent({ name });
  const g = (window.__gm = window.__gm || { calls: 0, hold: false });
  window.sdk = {
    showBanner() {
      g.calls++;
      ev('SDK_GAME_PAUSE');
      g.finish = () => ev('SDK_GAME_START');
      if (!g.hold) setTimeout(g.finish, 300);
    },
  };
  ev('SDK_READY');
})();`;

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test('GameMonetize: SDK_OPTIONS with the game ID, sdk.js once at boot, no other portal, no ad before Play, no rewarded buttons', async ({ page }) => {
  const { errors, requests } = await boot(page, GM_SDK, STUB);
  expect(await page.evaluate(() => window.SDK_OPTIONS?.gameId)).toBe('tnwpox2a6ymzt6ljyslvspxnstv85tjd');
  expect(await page.locator('script#gamemonetize-sdk').count()).toBe(1);
  expect(requests.filter((u) => u === GM_SDK)).toHaveLength(1);
  expect(requests.filter((u) => OTHER_PORTALS.test(u) && !u.startsWith('https://api.gamemonetize.com/'))).toEqual([]);
  expect(await page.evaluate(() => window.__gm!.calls)).toBe(0);
  // no "watch an ad" button anywhere (the SDK has no rewarded API)
  await page.locator('#title [data-act=play]').click();
  await page.waitForTimeout(800);
  await sim(page, 1);
  await lose(page);
  expect(await page.locator('[data-ad]').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('GameMonetize: the first Play shows the pre-roll (paused + muted), a second Play during it does nothing, then the level plays', async ({ page }) => {
  const { errors } = await boot(page, GM_SDK, STUB);
  await page.evaluate(() => (window.__gm!.hold = true));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => page.evaluate(() => window.__gm!.calls)).toBe(1);
  expect(await screen(page)).toBe('ad');
  expect((await state(page)).muted).toBe(true);
  await page.locator('#title [data-act=play]').click({ force: true });
  expect(await page.evaluate(() => window.__gm!.calls)).toBe(1);
  await page.evaluate(() => window.__gm!.finish!());
  await expect.poll(() => screen(page)).toBe('play');
  await sim(page, 1);
  const s = await state(page);
  expect(s.muted).toBe(false);
  expect(s.paused).toBe(false);
  expect(s.x).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('GameMonetize: result screens (Next / Retry / Menu) show at most one banner per ~2 minutes, never during a level', async ({ page }) => {
  const { errors } = await boot(page, GM_SDK, STUB);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 2);
  expect(await page.evaluate(() => window.__gm!.calls)).toBe(1); // the pre-roll only
  await win(page);
  await page.locator('#end [data-act=next]').click();
  await expect.poll(() => screen(page)).toBe('play');
  expect(await page.evaluate(() => window.__gm!.calls)).toBe(1); // within 2 minutes of the pre-roll
  await page.clock.fastForward(130_000);
  await win(page);
  await page.locator('#end [data-act=retry]').click();
  await expect.poll(() => page.evaluate(() => window.__gm!.calls)).toBe(2);
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await win(page);
  await page.locator('#end [data-act=menu]').click();
  await expect.poll(() => screen(page)).not.toBe('ad');
  expect(await page.evaluate(() => window.__gm!.calls)).toBe(2);
  expect(errors).toEqual([]);
});

test('GameMonetize: with the SDK blocked the game plays without ads', async ({ page }) => {
  const { errors } = await boot(page, GM_SDK, null);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 2);
  expect((await state(page)).x).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});
