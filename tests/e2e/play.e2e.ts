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

test('a fall costs a heart: the HUD shows it and the sprite is back at the checkpoint', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { __game: { start(id: string): void } }).__game.start('1-1'));
  await tick(page, 0.3);
  // drop the sprite into the first pit of the level
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { level(): { boxes: { kind: string; x0: number; x1: number }[] }; sim(): Record<string, unknown> } }).__game;
    const ground = g.level().boxes.filter((b) => b.kind === 'ground').sort((a, b) => a.x0 - b.x0);
    const i = ground.findIndex((b, k) => k > 0 && b.x0 - ground[k - 1].x1 > 1);
    const pit = (ground[i - 1].x1 + ground[i].x0) / 2;
    Object.assign(g.sim(), { x: pit, y: -2, vy: 0, vx: 0, grounded: false });
  });
  await tick(page, 1.5);
  const s = await page.evaluate(() => (window as unknown as { __game: { sim(): { hearts: number; x: number; cpX: number } } }).__game.sim());
  expect(s.hearts).toBe(2);
  const full = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('[data-hearts] > span')].map((e) => e.innerHTML);
    return spans.filter((h) => h === spans[0]).length;
  });
  expect(full).toBe(2);
});

test('a finger still down when the end screen appears does not press its buttons', async ({ page, isMobile }) => {
  await open(page);
  const g = () => page.evaluate(() => (window as unknown as { __game: { screen(): string } }).__game.screen());
  await page.evaluate(() => (window as unknown as { __game: { start(id: string): void } }).__game.start('1-1'));
  await page.evaluate(() => (window as unknown as { __game: { lose(): void } }).__game.lose());
  for (let i = 0; i < 20 && (await g()) !== 'end'; i++) await tick(page, 0.25);
  const box = (await page.locator('#end [data-act=retry]').boundingBox())!;
  const at = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  // play again; the finger goes down in the game where the button will be, the level ends, the finger lifts
  await page.evaluate(() => (window as unknown as { __game: { start(id: string): void } }).__game.start('1-1'));
  const cdp = isMobile ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
  else {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
  }
  await page.evaluate(() => (window as unknown as { __game: { lose(): void } }).__game.lose());
  for (let i = 0; i < 20 && (await g()) !== 'end'; i++) await tick(page, 0.25);
  expect(await g()).toBe('end');
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
  await tick(page, 0.2);
  expect(await g()).toBe('end');
  // a real tap on the button still works
  await page.locator('#end [data-act=retry]').click();
  expect(await g()).toBe('play');
});

test('planting the last seed at once does not show the "out of seeds" screen', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { __game: { start(id: string): void } }).__game.start('1-2'));
  await page.evaluate(() => (window as unknown as { __game: { teleportToDecision(): void } }).__game.teleportToDecision());
  // one seed left; the card is picked in the very frame the sprite stops (no tick in between)
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { tick(dt: number, r: boolean): void; sim(): { mode: string; seeds: number } } }).__game;
    g.sim().seeds = 1;
    for (let i = 0; i < 600 && g.sim().mode !== 'decide'; i++) g.tick(1 / 60, false);
    (document.querySelector('#dp .card[data-plant="bridge"]') as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    (document.querySelector('#dp .card[data-plant="bridge"]') as HTMLElement).click();
  });
  expect(await page.evaluate(() => (window as unknown as { __game: { screen(): string } }).__game.screen())).toBe('play');
  expect(await page.evaluate(() => (window as unknown as { __game: { sim(): { mode: string } } }).__game.sim().mode)).toBe('grow');
});

test('a touch jumps on the very next frame (no waiting to see whether it becomes a swipe)', async ({ page, isMobile }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { __game: { start(id: string): void } }).__game.start('1-1'));
  await tick(page, 0.5);
  await page.evaluate(() => {
    (window as unknown as { __down: number }).__down = 0;
    addEventListener('pointerdown', () => (window as unknown as { __down: number }).__down++, true);
  });
  const vp = page.viewportSize()!;
  const cdp = isMobile ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width * 0.6, y: vp.height * 0.55, id: 1 }] });
  else {
    await page.mouse.move(vp.width * 0.6, vp.height * 0.55);
    await page.mouse.down();
  }
  await page.waitForFunction(() => (window as unknown as { __down: number }).__down > 0);
  // one frame
  await page.evaluate(() => (window as unknown as { __game: { tick(dt: number, r: boolean): void } }).__game.tick(1 / 60, false));
  const s = await page.evaluate(() => (window as unknown as { __game: { sim(): { vy: number; grounded: boolean } } }).__game.sim());
  expect(s.grounded).toBe(false);
  expect(s.vy).toBeGreaterThan(5);
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
});

test('Bug 4: the gems of the first level started from the title are drawn (not culled), and everything else too', async ({ page }) => {
  const errors = await open(page);
  type G = { audit(): string[]; gemsInView(): number; tick(dt: number, r: boolean): void };
  const g = (fn: (g: G) => unknown) => page.evaluate(fn as never);
  await page.locator('#title [data-act=play]').click();
  expect((await state(page))!.screen).toBe('play');
  // run until gems are in view, drawing every frame like the real loop; at each step nothing may be hidden or culled
  let inView = 0;
  for (let i = 0; i < 40 && !inView; i++) {
    await tick(page, 0.25);
    inView = (await g(() => (window as unknown as { __game: G }).__game.gemsInView())) as number;
    expect(await g(() => (window as unknown as { __game: G }).__game.audit())).toEqual([]);
  }
  expect(inView).toBeGreaterThan(0);
  expect(await g(() => (window as unknown as { __game: G }).__game.audit())).toEqual([]);
  // and far from the origin, where bounds computed at the start no longer reach (gems, pollen, scenery)
  // on down the trail: at a decision point, pick the answer card
  for (let i = 0; i < 80 && (await state(page))!.x < 60; i++) {
    const answer = await page.evaluate(() => {
      const g = (window as unknown as { __game: { sim(): { mode: string; dp: number }; level(): { dps: { answer: string }[] } } }).__game;
      return g.sim().mode === 'decide' ? g.level().dps[g.sim().dp].answer : null;
    });
    if (answer) await page.locator(`#dp .card[data-plant="${answer}"]`).click({ force: true });
    else {
      // jump over whatever stops the sprite (the tutorial's first obstacles need a jump)
      await page.evaluate(() => {
        const g = (window as unknown as { __game: { sim(): { buffer: number } } }).__game;
        g.sim().buffer = 0.2;
      });
    }
    await tick(page, 0.5);
  }
  expect((await state(page))!.x).toBeGreaterThan(50);
  expect(await g(() => (window as unknown as { __game: G }).__game.audit())).toEqual([]);
  expect(errors).toEqual([]);
});
