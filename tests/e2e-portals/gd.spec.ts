// Smoke test of the GameDistribution build (dist-gd/) with a stand-in for GD's main.min.js: what GD's SDK check looks
// at — the pre-roll only from the first Play click, pause + mute on SDK_GAME_PAUSE, resume on SDK_GAME_START.
import { expect, test } from '@playwright/test';
import { boot, lose, OTHER_PORTALS, screen, sim, state } from './common';

declare global {
  interface Window {
    __gd?: { calls: string[]; hold: boolean; reward: 'complete' | 'skip'; finish?: () => void };
  }
}

const GD_SDK = 'https://html5.api.gamedistribution.com/main.min.js';
const STUB = `(() => {
  const ev = (name) => window.GD_OPTIONS && window.GD_OPTIONS.onEvent({ name });
  const g = (window.__gd = window.__gd || { calls: [], hold: false, reward: 'complete' });
  window.gdsdk = {
    showAd(type) {
      g.calls.push(type || 'interstitial');
      return new Promise((res) => {
        ev('SDK_GAME_PAUSE');
        g.finish = () => {
          if (type === 'rewarded' && g.reward === 'complete') ev('SDK_REWARDED_WATCH_COMPLETE');
          ev('SDK_GAME_START');
          res();
        };
        if (!g.hold) setTimeout(g.finish, 300);
      });
    },
  };
  ev('SDK_READY');
})();`;

const calls = (page: import('@playwright/test').Page) => page.evaluate(() => window.__gd!.calls.slice());

test('GameDistribution: the real game ID, main.min.js once at boot, no other portal, no ad before Play', async ({ page }) => {
  const { errors, requests } = await boot(page, GD_SDK, STUB);
  expect(await page.evaluate(() => window.GD_OPTIONS?.gameId)).toBe('cc966171a12a4fa68ea6b94b0bf1f757');
  expect(requests.filter((u) => u === GD_SDK)).toHaveLength(1);
  expect(requests.filter((u) => OTHER_PORTALS.test(u) && !u.startsWith('https://html5.api.gamedistribution.com/'))).toEqual([]);
  await sim(page, 1);
  expect(await calls(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('GameDistribution: pre-roll only from the first Play click; SDK_GAME_PAUSE pauses + mutes, SDK_GAME_START resumes', async ({ page }) => {
  const { errors } = await boot(page, GD_SDK, STUB);
  await page.evaluate(() => (window.__gd!.hold = true));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => calls(page)).toEqual(['interstitial']);
  const s0 = await state(page);
  expect(s0.muted).toBe(true);
  await page.locator('#title [data-act=play]').click({ force: true });
  expect(await calls(page)).toEqual(['interstitial']);
  await page.evaluate(() => window.__gd!.finish!());
  await expect.poll(() => screen(page)).toBe('play');
  await sim(page, 1);
  const s1 = await state(page);
  expect(s1.muted || s1.paused).toBe(false);
  expect(s1.x).toBeGreaterThan(3);
  // a later Play (from the menu) is no pre-roll
  await page.evaluate(() => window.__game.title());
  await page.locator('#title [data-act=play]').click();
  await sim(page, 1);
  expect(await calls(page)).toEqual(['interstitial']);
  expect(errors).toEqual([]);
});

test('GameDistribution: rewarded "continue with 1 heart" only after SDK_REWARDED_WATCH_COMPLETE', async ({ page }) => {
  const { errors } = await boot(page, GD_SDK, STUB);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  await lose(page);
  const btn = page.locator('#end [data-ad=heart]');
  await page.evaluate(() => (window.__gd!.reward = 'skip'));
  await btn.click();
  await expect(page.locator('.toast').last()).toHaveText('No ad available right now, try later', { timeout: 5000 });
  expect(await screen(page)).toBe('end');
  await page.evaluate(() => (window.__gd!.reward = 'complete'));
  await btn.click();
  await expect.poll(() => screen(page), { timeout: 5000 }).toBe('play');
  expect((await state(page)).hearts).toBe(1);
  expect(errors).toEqual([]);
});
