// Smoke test of the Y8 build (dist-y8/) with a stand-in for Y8's y8.min.js.
import { expect, test } from '@playwright/test';
import { boot, lose, OTHER_PORTALS, screen, sim, state, win } from './common';

declare global {
  interface Window {
    __y8?: { calls: string[]; mode: 'viewed' | 'noAd' | 'dismissed'; hold: boolean; finish?: () => void };
  }
}

const Y8_SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
/**
 * fires y8sdk.ready on load (and on emitReadyEvent); showAd() records the call (and whether init() came first), then
 * plays the documented callbacks: beforeAd → (reward: adViewed / adDismissed) → afterAd → adBreakDone, or only
 * adBreakDone({ breakStatus: 'noAdPreloaded' })
 */
const STUB = `(() => {
  const g = (window.__y8 = window.__y8 || { calls: [], mode: 'viewed', hold: false });
  let inited = false;
  const sdk = {
    init(app, ad) { g.calls.push('init:' + app.appId + ':' + ad.gameId + ':' + app.autoLogin + ':' + ad.preloadAdBreaks + ':' + ad.sound); inited = true; setTimeout(() => ad.onReady && ad.onReady(), 0); },
    onAuth(cb) { setTimeout(() => cb(null, null), 0); },
    showAd(o) {
      g.calls.push((inited ? '' : 'BEFORE-INIT:') + o.type);
      return new Promise((res) => {
        if (g.mode === 'noAd') { o.adBreakDone && o.adBreakDone({ breakStatus: 'noAdPreloaded' }); return res(); }
        const play = () => {
          o.beforeAd && o.beforeAd();
          g.finish = () => {
            if (o.type === 'reward') (g.mode === 'viewed' ? o.adViewed : o.adDismissed)();
            o.afterAd && o.afterAd();
            o.adBreakDone && o.adBreakDone({ breakStatus: g.mode });
            res();
          };
          if (!g.hold) setTimeout(g.finish, 300);
        };
        if (o.type === 'reward') o.beforeReward(play); else play();
      });
    },
  };
  const ready = () => window.dispatchEvent(new Event('y8sdk.ready'));
  window.y8 = { sdk: () => sdk, emitReadyEvent: ready };
  ready();
})();`;

const calls = (page: import('@playwright/test').Page) => page.evaluate(() => window.__y8!.calls.slice());

test('Y8: y8.min.js from the CDN once (async), init with the App ID + Game ID like the portal snippet, no ad before Play, no other portal', async ({ page }) => {
  const { errors, requests } = await boot(page, Y8_SDK, STUB);
  expect(await page.locator(`script[src="${Y8_SDK}"][async]`).count()).toBe(1);
  expect(requests.filter((u) => u === Y8_SDK)).toHaveLength(1);
  expect(requests.filter((u) => OTHER_PORTALS.test(u) && u !== Y8_SDK)).toEqual([]);
  expect(await calls(page)).toEqual(['init:6af5b5e97eafcdc5d5ddce9c:292717:true:on:on']);
  expect(errors).toEqual([]);
});

test('Y8: Play shows the start ad (paused + muted in beforeAd), a second Play does nothing, afterAd resumes', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.evaluate(() => (window.__y8!.hold = true));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => calls(page)).toEqual([expect.stringMatching(/^init/), 'start']);
  expect((await state(page)).muted).toBe(true);
  await page.locator('#title [data-act=play]').click({ force: true });
  expect((await calls(page)).length).toBe(2);
  await page.evaluate(() => window.__y8!.finish!());
  await expect.poll(() => screen(page)).toBe('play');
  await sim(page, 1);
  expect((await state(page)).muted).toBe(false);
  expect((await calls(page)).some((c) => c.startsWith('BEFORE-INIT'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Y8: Next / Retry / Menu each ask for a "next" break (no cap of our own); a skipped break goes on at once', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.evaluate(() => (window.__y8!.mode = 'noAd'));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page)).toBe('play');
  for (const act of ['next', 'retry', 'menu']) {
    await sim(page, 1);
    await win(page);
    await page.locator(`#end [data-act=${act}]`).click();
    await expect.poll(() => screen(page)).not.toBe('end');
    if (act === 'menu') break;
  }
  expect((await calls(page)).slice(1)).toEqual(['start', 'next', 'next', 'next']);
  expect(errors).toEqual([]);
});

test('Y8: rewarded "continue with 1 heart": reward only after adViewed; no ad or dismissed = "No ad available right now, try later"', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  await lose(page);
  const btn = page.locator('#end [data-ad=heart]');
  await expect(btn).toContainText('1');
  for (const mode of ['noAd', 'dismissed'] as const) {
    await page.evaluate((m) => (window.__y8!.mode = m), mode);
    await btn.click();
    await expect(page.locator('.toast').last()).toHaveText('No ad available right now, try later', { timeout: 5000 });
    expect(await screen(page)).toBe('end');
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => (window.__y8!.mode = 'viewed'));
  await btn.click();
  await expect.poll(() => screen(page), { timeout: 5000 }).toBe('play');
  expect((await state(page)).hearts).toBe(1);
  expect((await calls(page)).filter((c) => c === 'reward')).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('Y8: a hidden page or a lost focus pauses and mutes; coming back resumes', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  let s = await state(page);
  expect(s.paused && s.muted).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  s = await state(page);
  expect(s.paused || s.muted).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  s = await state(page);
  expect(s.paused && s.muted).toBe(true);
  expect(errors).toEqual([]);
});

test('Y8: with the SDK blocked (ad blocker) the game plays, without rewarded buttons', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, null);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  await lose(page);
  expect(await page.locator('[data-ad]').count()).toBe(0);
  expect(errors).toEqual([]);
});
