// Game-specific settings for the open-portal web zip (scripts/web/zip.mjs), its checker (scripts/web/check.mjs),
// the store images (scripts/web/store.mjs) and the Playgama zip tests (scripts/playgama/test.mjs).
import { execFileSync } from 'node:child_process';

const SAVE_KEY = 'sprout-trail-save';

/** the level bot's plan for a level (scripts/plan-cli.ts), cached */
const plans = new Map();
export function plan(id) {
  if (!plans.has(id)) plans.set(id, JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/plan-cli.ts', id], { encoding: 'utf8' })));
  return plans.get(id);
}

/** a returning player (worlds 1 and 2 partly done, some gems), so the menus show progress */
export function returning() {
  const levels = {};
  for (let n = 1; n <= 12; n++) levels[`1-${n}`] = { stars: n % 4 ? 3 : 2, acorns: 3, gems: 60, done: true };
  for (let n = 1; n <= 4; n++) levels[`2-${n}`] = { stars: 2, acorns: 2, gems: 50, done: true };
  const save = { v: 1, levels, gems: 1340, last: '2-4', music: true, sfx: true, lang: null, hat: 'straw', color: 'leaf', owned: ['acorn', 'straw', 'sun'], dailyDay: -1, streak: 0, bestStreak: 3 };
  return new Function(`localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(save))})`);
}

const game = {
  slug: 'sprout-trail',
  title: 'Sprout Trail',
  /** the ad-free web build: no portal SDK, no rewarded-ad buttons, no interstitials (ADS is false in src/main.ts) */
  build: 'npm run build:web',
  dist: 'dist-web',
  exclude: ['*.DS_Store'],
  /** the only localStorage keys the game writes (src/app/save.ts; the probe key is removed right away) */
  storageKeys: [SAVE_KEY, '__st_probe'],
  /** `capture`: the game clock only moves when the checker ticks it (software WebGL is slow), like the e2e tests */
  query: '?capture',
  canvasSelector: 'canvas#game',
  /** every rewarded-ad button of the portal builds (double gems, continue with 1 heart, +2 seeds) */
  adSelector: '.btn.ad',
  rewardSelector: '.btn.ad',
  async ready(frame) {
    await frame.waitForFunction(() => window.__ready === true && window.__game, null, { timeout: 120_000 });
  },
  /** level 1-1 from the title: Play (real click), then the level bot plays it to the result screen */
  async play(frame, page) {
    const d = new FrameDriver(frame, page);
    await d.click('#title [data-act=play]');
    const p = plan('1-1');
    await frame.evaluate(([i, c]) => window.__game.replay(i, c, 0.3, false), [p.inputs, p.choices]);
    await frame.evaluate(() => {
      for (let k = 0; k < 60 * 120 && window.__game.screen() !== 'end'; k++) window.__game.tick(1 / 60, false);
    });
    await d.tick(0.5);
    await d.settle();
    await frame.evaluate(() => window.__game.render());
    const s = await frame.evaluate(() => window.__game.state());
    return { won: s.mode === 'won', why: `level ended in mode ${s.mode}`, note: `level 1-1 finished with ${s.acorns} golden acorns and ${s.gems} gems` };
  },
  driver: (frame, page) => new FrameDriver(frame, page),
  /** gems in the wallet */
  money: (frame) => frame.evaluate(() => window.__game.save().gems),
  async next(frame, page) {
    await new FrameDriver(frame, page).click('[data-act=next]');
  },
  async nextLevelOpened(frame, page) {
    const d = new FrameDriver(frame, page);
    await d.until(() => window.__game.state()?.level === '1-2' && window.__game.screen() === 'play', 60);
  },
  // ---------------------------------------------------------------- store images (scripts/web/store.mjs)
  cover: { src: 'submission/covers/cover-1920x1080.png', crop: '1260x1000+330+40' },
  icon: 'submission/covers/cover-800x800.png',
  /** 1280x720 shots of the web build, played through the game (capture mode, as in the e2e tests) */
  shots: [
    {
      name: 'title: the main menu of a returning player',
      query: '?capture',
      save: returning(),
      run: async (f, p) => {
        const d = new FrameDriver(f, p);
        await d.tick(1.2);
        await d.shot();
      },
    },
    { name: 'deep forest: bees over the trail', query: '?capture', save: returning(), run: playTo('2-6', 's.x > 38.5') },
    { name: 'mushroom valley: the seed cards at a wide river', query: '?capture', save: returning(), run: playTo('3-2', "s.mode === 'decide'", 0.9) },
    { name: 'autumn woods: rolling acorns', query: '?capture', save: returning(), run: playTo('4-1', 's.x > 49.5') },
  ],
};
export default game;

/** start a level, let the bot play until `cond`, then a short rendered beat and the shot */
function playTo(id, cond, after = 0.4) {
  return async (f, p) => {
    const d = new FrameDriver(f, p);
    const pl = plan(id);
    await f.evaluate(([id, i, c]) => {
      window.__game.start(id);
      window.__game.replay(i, c, 0.6, false);
    }, [id, pl.inputs, pl.choices]);
    await f.evaluate((cond) => {
      const fn = new Function('s', `return ${cond};`);
      for (let k = 0; k < 60 * 200 && !fn(window.__game.state()); k++) window.__game.tick(1 / 60, false);
    }, cond);
    for (let t = 0; t < after; t += 1 / 30) await f.evaluate(() => window.__game.tick(1 / 30, true));
    await d.shot();
  };
}

/**
 * Plays through real pointer input on a frame (the game in the checker's iframe, or the page itself): page mouse
 * coordinates are offset by the iframe's position.
 */
export class FrameDriver {
  fps = 10;
  constructor(frame, page) {
    this.f = frame;
    this.p = page;
  }
  async offset() {
    if (!this.f.parentFrame()) return { x: 0, y: 0 };
    const b = await (await this.f.frameElement()).boundingBox();
    return { x: b.x, y: b.y };
  }
  /** advance the game clock without drawing (like the e2e driver); `shot()` draws the frame */
  async tick(sec) {
    const n = Math.max(1, Math.round(sec * this.fps));
    for (let i = 0; i < n; i++) await this.f.evaluate((dt) => window.__game.tick(dt, false), 1 / this.fps);
  }
  async until(fn, maxSec = 20) {
    for (let t = 0; t < maxSec; t += 1 / this.fps) {
      if (await this.f.evaluate(fn)) return;
      await this.tick(1 / this.fps);
    }
    throw new Error(`timed out waiting for ${fn.toString().replace(/\s+/g, ' ')}`);
  }
  has(sel) {
    return this.f.evaluate((s) => !!document.querySelector(s), sel);
  }
  /** let pop-in UI animations finish (they run on the game clock in capture mode) */
  async settle() {
    for (let i = 0; i < 20; i++) {
      const busy = await this.f.evaluate(() =>
        document.getAnimations().some((a) => {
          const tm = a.effect?.getComputedTiming();
          return tm && tm.iterations !== Infinity && (tm.progress ?? 1) < 1 && a.animationName !== 'toast';
        }),
      );
      if (!busy) return;
      await this.tick(1 / this.fps);
    }
  }
  /** finish pop-in transitions and draw the current frame (capture mode has no render loop) */
  async shot() {
    await this.f.evaluate(() => {
      for (const a of document.getAnimations()) {
        try {
          if (a.effect?.getTiming().iterations !== Infinity && a.animationName !== 'toast') a.finish();
        } catch {}
      }
      window.__game.render();
    });
  }
  async click(sel) {
    await this.until(new Function(`return !!document.querySelector(${JSON.stringify(sel)})`), 30);
    await this.settle();
    const b = await this.f.locator(sel).first().boundingBox();
    if (!b) throw new Error(`no box for ${sel}`);
    // locator boxes are already in page coordinates
    await this.p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
}
