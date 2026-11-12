// Zero errors in every engine, desktop and phone (docs/robustness.md): nothing uncaught, no unhandled rejection, no
// console error, loading always reaches loadingStop, the game never waits forever and never stays paused.
import { expect, test } from '@playwright/test';
import { clean, frames, lose, loaded, play, press, SAVE_KEY, screen, sim, start, state, win } from './harness';

/** the CrazyGames build makes no ad within 2 minutes of loading (and between ads): the page clock jumps past it */
const AD_GAP = 130_000;

test.beforeEach(async ({ page }) => {
  // a fake page clock that still flows (setTimeout, Date, performance): the tests can jump it ahead
  await page.clock.install();
});

test('first visit: loads, title, Play, a level plays; loadingStop before gameplayStart', async ({ page }, info) => {
  const run = await start(page, info);
  await loaded(page, run);
  await expect(page.locator('#title [data-act=play]')).toBeVisible();
  await frames(page, 3);
  await play(page);
  await sim(page, 4);
  const s = await state(page);
  expect(s!.x).toBeGreaterThan(10);
  const ev = await run.events();
  expect(ev.indexOf('gameplayStart')).toBeGreaterThan(ev.indexOf('loadingStop'));
  await clean(run);
});

test('several levels in a row (win, Next with an ad, retry, menu); GPU memory stays bounded', async ({ page }, info) => {
  const run = await start(page, info);
  await loaded(page, run);
  await play(page);
  const gpu0 = await page.evaluate(() => window.__game.gpu());
  for (let i = 0; i < 4; i++) {
    await win(page);
    await page.clock.fastForward(AD_GAP);
    await press(page, 'next');
  }
  await win(page);
  await press(page, 'retry');
  await lose(page);
  await press(page, 'menu');
  // many more levels: what a finished level leaves on the GPU is freed
  for (const id of ['1-6', '1-7', '1-8', '2-1', '2-2', '3-1', '4-1', '5-1', '1-9', '2-5', '3-5', '4-5']) {
    await page.evaluate((id) => window.__game.start(id), id);
    await sim(page, 1);
  }
  const gpu1 = await page.evaluate(() => window.__game.gpu());
  expect(gpu1.geometries).toBeLessThan(Math.max(400, gpu0.geometries * 3));
  expect((await run.events()).filter((e) => e === 'ad:midgame').length).toBeGreaterThanOrEqual(3);
  await clean(run);
});

for (const mode of ['ok', 'error', 'blocked', 'nofill', 'hung'] as const) {
  test(`interstitial and rewarded ads: ${mode}; the game always goes on and is never left paused`, async ({ page }, info) => {
    const run = await start(page, info, { adMode: mode });
    await loaded(page, run);
    await play(page);
    await win(page);
    await page.clock.fastForward(AD_GAP);
    // an ad that started and never ended is given up after AD_MAX (120 s)
    await press(page, 'next', mode === 'hung' ? 125_000 : 0);
    await sim(page, 1);
    expect(await screen(page)).toBe('play');
    expect(await page.evaluate(() => window.__game.sim().mode)).toBe('run');
    // rewarded: "continue with 1 heart" on the lost screen
    await lose(page);
    const btn = page.locator('#end [data-ad=heart]');
    await expect(btn).toBeVisible();
    await btn.click();
    if (mode === 'hung') {
      await page.waitForTimeout(2000);
      await page.clock.fastForward(125_000);
    }
    if (mode === 'ok') await expect.poll(() => screen(page), { timeout: 20_000 }).toBe('play');
    else {
      await expect(page.locator('.toast')).toBeVisible({ timeout: 20_000 });
      expect(await screen(page)).toBe('end');
      // Retry is a break too: in this mode its interstitial never ends either
      await press(page, 'retry', mode === 'hung' ? 125_000 : 0);
    }
    await sim(page, 1);
    await clean(run);
  });
}

test('tab hidden and shown: pauses, then resumes from the pause menu', async ({ page }, info) => {
  const run = await start(page, info);
  await loaded(page, run);
  await play(page);
  const setHidden = (h: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, h);
  await setHidden(true);
  await sim(page, 1);
  expect(await screen(page)).toBe('pause');
  await setHidden(false);
  await page.locator('#pause [data-act=resume]').click();
  await sim(page, 1);
  expect(await screen(page)).toBe('play');
  await clean(run);
});

test('resize and rotate (desktop, phone portrait / landscape, tiny)', async ({ page }, info) => {
  const run = await start(page, info);
  await loaded(page, run);
  await play(page);
  for (const [w, h] of [
    [1280, 720],
    [844, 390],
    [390, 844],
    [320, 240],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await frames(page, 2);
    await sim(page, 0.5);
  }
  await clean(run);
});

test('a failed download of the models is retried (the game loads normally)', async ({ page }, info) => {
  const run = await start(page, info, { fail: /models\/nature\.glb$/, failTimes: 2 });
  await loaded(page, run);
  expect(run.injected.length).toBe(2);
  await play(page);
  await clean(run);
});

test('the models never download: the game still loads and plays (no endless loading screen)', async ({ page }, info) => {
  const run = await start(page, info, { fail: /models\/nature\.glb$/ });
  await page.clock.fastForward(30_000);
  await loaded(page, run);
  await play(page);
  // the one recorded reason (the models could not be loaded) is expected here; nothing else
  expect((await run.problems()).filter((p) => !/models/.test(p))).toEqual([]);
});

test('the game script fails to download once: the page fetches it again and loads', async ({ page }, info) => {
  const run = await start(page, info, { fail: /\/assets\/index-[^/]+\.js$/, failTimes: 1 });
  await loaded(page, run);
  await play(page);
  await clean(run);
});

test('the game script never downloads: "Couldn\'t load the game" with Try again (no endless loading screen)', async ({ page }, info) => {
  const run = await start(page, info, { fail: /\/assets\/index-[^/]+\.js$/ });
  await expect(page.locator('#loading[data-failed=load]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#boot-retry')).toBeVisible();
  await expect(page.locator('#loading p')).toContainText(/connection|connexion|Verbindung|conexión|connessione|подключение/);
  await clean(run);
});

test('private mode (storage throws): plays, no errors', async ({ page }, info) => {
  const run = await start(page, info, { noStorage: true });
  await loaded(page, run);
  await play(page);
  await win(page);
  await press(page, 'retry');
  await clean(run);
});

test('Progress Save off (Data Module throws): progress goes to localStorage', async ({ page }, info) => {
  const run = await start(page, info, { dataDisabled: true });
  await loaded(page, run);
  await play(page);
  await win(page);
  expect(await page.evaluate((k) => !!localStorage.getItem(k), SAVE_KEY)).toBe(true);
  await clean(run);
});

for (const save of ['save-phase-a.json', 'save-v1.1.json']) {
  test(`a returning player with an older save (${save}): progress kept, plays`, async ({ page }, info) => {
    const run = await start(page, info, { save });
    await loaded(page, run);
    const g = await page.evaluate(() => window.__game.save());
    expect(g.levels['1-1'].stars).toBe(3);
    expect(typeof g.hat).toBe('string');
    expect(Array.isArray(g.owned)).toBe(true);
    await page.locator('#title [data-act=worlds]').click();
    await frames(page, 1);
    await page.locator('[data-lv="1-2"]').click();
    await sim(page, 2);
    expect(await screen(page)).toBe('play');
    await clean(run);
  });
}

test('no WebGL: a clear message with Try again, not a stuck loading screen', async ({ page }, info) => {
  const run = await start(page, info, { noWebgl: true });
  await expect(page.locator('#loading[data-failed=webgl]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#boot-retry')).toBeVisible();
  await clean(run);
});

test('WebGL context lost and restored: the level pauses, then plays on', async ({ page }, info) => {
  const run = await start(page, info);
  await loaded(page, run);
  await play(page);
  const lose = (restore: boolean) =>
    page.evaluate((restore) => {
      // the extension is taken before the loss (a lost context gives none)
      const w = window as unknown as { __loseExt?: WEBGL_lose_context | null };
      if (!w.__loseExt) {
        const c = document.getElementById('game') as HTMLCanvasElement;
        const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext;
        w.__loseExt = gl.getExtension('WEBGL_lose_context');
      }
      const ext = w.__loseExt;
      if (!ext) return false;
      if (restore) ext.restoreContext();
      else ext.loseContext();
      return true;
    }, restore);
  if (!(await lose(false))) test.skip(true, 'no WEBGL_lose_context in this engine');
  await page.waitForTimeout(300);
  const x0 = (await state(page))!.x;
  await sim(page, 1);
  expect((await state(page))!.x).toBe(x0); // paused while lost
  await lose(true);
  await page.waitForTimeout(500);
  await sim(page, 1);
  await frames(page, 3);
  expect((await state(page))!.x).toBeGreaterThan(x0);
  await clean(run);
});
