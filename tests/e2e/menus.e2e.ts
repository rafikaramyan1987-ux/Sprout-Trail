import { expect, test, type Page } from '@playwright/test';

type G = {
  state(): { mode: string; level: string; screen: string; hearts: number } | null;
  tick(dt: number, r: boolean): void;
  save(): { gems: number; hat: string; owned: string[] };
  setSave(p: object): void;
  start(id: string): void;
  lose(): void;
  lang(l: string): void;
  showWorlds(w: number): void;
  showDaily(): void;
  showWardrobe(): void;
  showSettings(): void;
  title(): void;
  teleportToDecision(): void;
};
/** run `fn(window.__game)` in the page */
const g = <T>(p: Page, fn: (g: G) => T) => p.evaluate(`(${fn.toString()})(window.__game)`) as Promise<T>;
const tick = (p: Page, sec: number) => p.evaluate((n) => { const w = window as unknown as { __game: G }; for (let i = 0; i < n; i++) w.__game.tick(1 / 60, i === n - 1); }, Math.round(sec * 60));

async function open(page: Page) {
  await page.goto('./?capture');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 90_000 });
}

test('worlds: 5 worlds, world 1 open, later worlds locked until world 1 is done', async ({ page }) => {
  await open(page);
  await page.locator('#title [data-act=worlds]').click();
  await expect(page.locator('#worlds .tab')).toHaveCount(5);
  await expect(page.locator('#worlds .lvl:not(.locked)')).toHaveCount(1);
  await page.locator('#worlds .tab[data-w="2"]').click();
  await expect(page.locator('#worlds .locked-note')).toBeVisible();
  await g(page, (w) => {
    const levels: Record<string, object> = {};
    for (let n = 1; n <= 12; n++) levels[`1-${n}`] = { stars: 3, acorns: 3, gems: 10, done: true };
    w.setSave({ levels });
    w.showWorlds(2);
  });
  await expect(page.locator('#worlds .lvl:not(.locked)')).toHaveCount(1);
  await g(page, (w) => w.showWorlds(1));
  await expect(page.locator('#worlds .btn.special:not(.locked)')).toBeVisible();
  await page.locator('#worlds .lvl[data-lv="2-1"], #worlds [data-lv="1-S"]').first().click();
  expect((await g(page, (w) => w.state()))!.screen).toBe('play');
});

test('wardrobe: buy a hat with gems, then wear it', async ({ page }) => {
  await open(page);
  await g(page, (w) => w.setSave({ gems: 500 }));
  await page.locator('#title [data-act=wardrobe]').click();
  await page.locator('#wardrobe [data-item=acorn]').click();
  const s = await g(page, (w) => w.save());
  expect(s.gems).toBe(350);
  expect(s.hat).toBe('acorn');
  expect(s.owned).toContain('acorn');
  await page.locator('#wardrobe [data-item=crown]').click(); // too expensive
  expect((await g(page, (w) => w.save())).hat).toBe('acorn');
});

test('daily trail: today\'s level with a streak', async ({ page }) => {
  await open(page);
  await page.locator('#title [data-act=daily]').click();
  await expect(page.locator('#daily .streak')).toBeVisible();
  await page.locator('#daily [data-act=go]').click();
  expect((await g(page, (w) => w.state()))!.level).toMatch(/^daily-\d+$/);
});

test('settings: language switch, reset asks for confirmation', async ({ page }) => {
  await open(page);
  await page.locator('#title [data-act=settings]').click();
  await page.locator('#settings select.lang').selectOption('de');
  await expect(page.locator('#settings h2')).toHaveText('Einstellungen');
  await page.locator('#settings [data-act=reset]').click();
  await expect(page.locator('#confirm')).toBeVisible();
  await page.locator('#confirm [data-act=no]').click();
  await expect(page.locator('#confirm')).toHaveCount(0);
});

test('web build: no rewarded-ad buttons, even when out of hearts', async ({ page }) => {
  await open(page);
  await page.locator('#title [data-act=play]').click();
  await g(page, (w) => w.start('2-1'));
  await tick(page, 1);
  await g(page, (w) => w.lose());
  await tick(page, 1.6);
  expect((await g(page, (w) => w.state()))!.screen).toBe('end');
  await expect(page.locator('#end')).toBeVisible();
  await expect(page.locator('.btn.ad')).toHaveCount(0);
});

for (const lang of ['de', 'ru', 'fr']) {
  test(`${lang}: every text fits its button / card at this size`, async ({ page }) => {
    await open(page);
    await g(page, (w) => w.setSave({ gems: 2000 }));
    await page.evaluate((l) => (window as unknown as { __game: G }).__game.lang(l), lang);
    const overflow = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.btn, .card, .item, .tab, .toggle, .pill, .dp-prompt, .panel h2, .panel p, .set-row, .logo')]
          .filter((e) => e.offsetParent && (e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1))
          .map((e) => `${e.className}: ${e.textContent?.trim().slice(0, 40)}`),
      );
    await g(page, (w) => w.title());
    expect(await overflow()).toEqual([]);
    for (const show of ['showWorlds', 'showDaily', 'showWardrobe', 'showSettings'] as const) {
      await page.evaluate((s) => ((window as unknown as { __game: Record<string, (a?: number) => void> }).__game[s](1)), show);
      expect(await overflow(), show).toEqual([]);
    }
    await g(page, (w) => w.start('1-3'));
    await g(page, (w) => w.teleportToDecision());
    for (let i = 0; i < 40 && (await g(page, (w) => w.state()))!.mode !== 'decide'; i++) await tick(page, 0.25);
    await tick(page, 0.6);
    expect(await overflow(), 'seed cards').toEqual([]);
  });
}
