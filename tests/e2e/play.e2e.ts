import { expect, test, type Page } from '@playwright/test';

type State = { mode: string; x: number; y: number; level: string; screen: string; seeds: number };
const state = (p: Page) => p.evaluate(() => (window as unknown as { __game: { state(): State } }).__game.state());
const tick = (p: Page, sec: number) => p.evaluate((n) => { const g = (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game; for (let i = 0; i < n; i++) g.tick(1 / 60, i === n - 1); }, Math.round(sec * 60));

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?capture');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 90_000 });
  return errors;
}

test('title → Play starts level 1 at once, and the sprite runs by itself', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#title [data-act=play]')).toBeVisible();
  await expect(page.locator('#title [data-act=worlds]')).toBeVisible();
  await expect(page.locator('#title [data-act=settings]')).toBeVisible();
  await page.locator('#title [data-act=play]').click();
  expect((await state(page))!.screen).toBe('play');
  const x0 = (await state(page))!.x;
  await tick(page, 1);
  const s = (await state(page))!;
  expect(s.level).toBe('1-1');
  expect(s.x).toBeGreaterThan(x0 + 3);
  expect(errors).toEqual([]);
});

test('one-finger / keyboard jump', async ({ page, isMobile }) => {
  await open(page);
  await page.locator('#title [data-act=play]').click();
  await tick(page, 0.3);
  if (isMobile) await page.touchscreen.tap(195, 500);
  else await page.keyboard.press('Space');
  await tick(page, 0.25);
  expect((await state(page))!.y).toBeGreaterThan(0.5);
});

test('swipe down ducks', async ({ page }) => {
  await open(page);
  await page.locator('#title [data-act=play]').click();
  await tick(page, 0.3);
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width / 2, vp.height / 2 + 60, { steps: 4 });
  await tick(page, 0.1);
  const ducking = await page.evaluate(() => (window as unknown as { __game: { sim(): { ducking: boolean } } }).__game.sim().ducking);
  await page.mouse.up();
  expect(ducking).toBe(true);
});

test('decision point: seed cards appear, a card plants a seed', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { __game: { start(id: string): void } }).__game.start('1-2'));
  await page.evaluate(() => (window as unknown as { __game: { teleportToDecision(): void } }).__game.teleportToDecision());
  for (let i = 0; i < 40 && (await state(page))!.mode !== 'decide'; i++) await tick(page, 0.25);
  expect((await state(page))!.mode).toBe('decide');
  const cards = page.locator('#dp .card');
  await expect(cards).toHaveCount(2);
  const box = await cards.first().boundingBox();
  expect(box!.height).toBeGreaterThan(100);
  await cards.filter({ hasText: 'Bridge' }).click();
  expect((await state(page))!.mode).toBe('grow');
  for (let i = 0; i < 30 && (await state(page))!.mode !== 'run'; i++) await tick(page, 0.25);
  expect((await state(page))!.mode).toBe('run');
  expect((await state(page))!.seeds).toBe(2);
});

test('pause menu and settings', async ({ page }) => {
  await open(page);
  await page.locator('#title [data-act=play]').click();
  await page.locator('#btn-pause').click();
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#pause [data-act=settings]').click();
  await expect(page.locator('#settings')).toBeVisible();
  await page.locator('#settings [data-set=music]').click();
  await page.locator('#settings [data-act=back]').click();
  await page.locator('#pause [data-act=resume]').click();
  expect((await state(page))!.screen).toBe('play');
});
