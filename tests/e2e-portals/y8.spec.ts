// Smoke test of the Y8 build (dist-y8/) with a stand-in for Y8's y8.min.js.
import { expect, test } from '@playwright/test';
import { boot, frames, lose, OTHER_PORTALS, screen, sim, state, win } from './common';

declare global {
  interface Window {
    __y8?: { calls: string[]; mode: 'viewed' | 'noAd' | 'dismissed'; hold: boolean; blur?: boolean; finish?: () => void };
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
          // Y8 plays its ads on the parent page, outside the game iframe: the game window loses focus during the ad
          // and gets no 'focus' event back afterwards (focus stays on the parent page)
          if (g.blur) { document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); }
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

test('Y8: the start ad blurs the game window and focus never comes back: after the ad the level runs without a click', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.evaluate(() => (window.__y8!.blur = true));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  expect(await page.evaluate(() => document.hasFocus())).toBe(false);
  // the frame loop's own path, no input, no focus event: the sprite must run on its own
  const x0 = (await state(page)).x;
  await page.waitForTimeout(500);
  await frames(page, 1.5);
  const s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.muted).toBe(false);
  expect(s.x).toBeGreaterThan(x0 + 1);
  expect(errors).toEqual([]);
});

test('Y8: a "next" ad with a blur that lands just after the ad (within 1 s) does not leave the game paused', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.evaluate(() => (window.__y8!.mode = 'noAd'));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  await win(page);
  await page.evaluate(() => Object.assign(window.__y8!, { mode: 'viewed', hold: true }));
  await page.locator('#end [data-act=next]').click();
  await expect.poll(() => calls(page)).toContain('next');
  await page.evaluate(() => {
    window.__y8!.finish!();
    // the parent page takes focus back a moment after the ad closed
    setTimeout(() => window.dispatchEvent(new Event('blur')), 300);
  });
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await page.waitForTimeout(600);
  const x0 = (await state(page)).x;
  await frames(page, 1.5);
  const s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.x).toBeGreaterThan(x0 + 1);
  expect(errors).toEqual([]);
});

test('Y8: a blur without an ad (player clicked outside the game) mutes the sound only; focus or any input brings it back', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.evaluate(() => (window.__y8!.mode = 'noAd'));
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  // past the 1 s after the (skipped) start ad in which a blur is the ad's
  await page.waitForTimeout(1200);
  for (const back of ['focus', 'pointerdown', 'touchstart', 'keydown'] as const) {
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    let s = await state(page);
    expect(s.muted).toBe(true);
    expect(s.paused).toBe(false); // the gameplay is never frozen by a blur
    const x0 = s.x;
    await frames(page, 0.5);
    expect((await state(page)).x).toBeGreaterThan(x0);
    await page.evaluate((t) => {
      if (t === 'focus') window.dispatchEvent(new Event('focus'));
      else if (t === 'keydown') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
      else document.body.dispatchEvent(new Event(t, { bubbles: true }));
    }, back);
    s = await state(page);
    expect(s.muted, back).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('Y8: a hidden page pauses and mutes; coming back resumes', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB);
  await page.locator('#title [data-act=play]').click();
  await expect.poll(() => screen(page), { timeout: 10_000 }).toBe('play');
  await sim(page, 1);
  const hide = (h: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, h);
  await hide(true);
  let s = await state(page);
  expect(s.paused && s.muted).toBe(true);
  await hide(false);
  // the game's own pause menu opened while hidden; Resume plays on, sound back
  await page.locator('#pause [data-act=resume]').click();
  await sim(page, 0.2);
  s = await state(page);
  expect(s.paused || s.muted).toBe(false);
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
