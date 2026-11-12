/**
 * Store art and videos for every portal, from the real game (the level bot plays it through the game's input path):
 * - the key-art scene: level 1-S (Golden Grove of the Spring Meadow), the sprite flying off a swing rope towards a
 *   golden acorn, HUD hidden, the logo at the bottom (`__game.cover`); GameMonetize's images without any text
 * - Y8 screenshots: four gameplay moments with the HUD, at 1280x720 and 760x570
 * - Y8 gameplay video: one continuous, unedited take of real play (1280x720, 25 s, no sound, action from second 1)
 * - CrazyGames trailers (1920x1080, 1080x1620): 18 s of real play at normal speed, key art at both ends
 * usage: npx tsx scripts/submission/media.ts [baseUrl] [--only=art|y8|trailers]   (serve dist-web first)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Driver } from '../driver';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:4173/';
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const tmp = join(process.env.FRAMES_DIR ?? tmpdir(), 'st-media');
mkdirSync(tmp, { recursive: true });

/** the key-art moment and its framing (landscape / square, portrait) */
const KEY = { level: '1-S', cond: 's.x > 227.5' };
const frameFor = (w: number, h: number) => (h > w * 1.1 ? { zoom: 0.8, lift: 2.4 } : { zoom: 0.55, lift: 1.6 });

async function keyArt(w: number, h: number, out: string, logo = true) {
  const d = await Driver.open(base, w, h, 1);
  await d.startBot(KEY.level, false, 0.3);
  await d.skipUntil(KEY.cond);
  const f = frameFor(w, h);
  await d.page.evaluate(([z, l, g]) => (window as unknown as { __game: { cover(on: boolean, z: number, l: number, g: boolean): void } }).__game.cover(true, z, l, g), [f.zoom, f.lift, logo] as [number, number, boolean]);
  await d.play(1 / 30);
  await d.shot(out);
  await d.close();
}

const im = (src: string, out: string, size: string, opts: string[] = []) => execFileSync('convert', [src, '-resize', `${size}^`, '-gravity', 'center', '-extent', size, ...opts, '-strip', out]);
const jpg = (src: string, out: string, size: string, q = 90) => im(src, out, size, ['-quality', String(q)]);
/** a JPG under `maxKb`: lowers the quality until it fits */
function jpgUnder(src: string, out: string, size: string, maxKb: number) {
  for (let q = 92; q >= 50; q -= 4) {
    jpg(src, out, size, q);
    if (statSync(out).size <= maxKb * 1024) return;
  }
  throw new Error(`${out} stays above ${maxKb} KB`);
}
const t = (n: string) => join(tmp, n);

async function art() {
  for (const d of ['submission/covers', 'submission-gd/thumbnails', 'submission-gamepix', 'submission-playgama', 'submission-gamemonetize', 'submission-y8/media']) mkdirSync(d, { recursive: true });
  // CrazyGames (PNG covers), Playgama (PNG covers)
  await keyArt(1920, 1080, 'submission/covers/cover-1920x1080.png');
  await keyArt(800, 1200, 'submission/covers/cover-800x1200.png');
  await keyArt(800, 800, 'submission/covers/cover-800x800.png');
  await keyArt(1080, 1920, 'submission-playgama/cover-1080x1920.png');
  im('submission/covers/cover-1920x1080.png', 'submission-playgama/cover-1920x1080.png', '1920x1080');
  im('submission/covers/cover-800x800.png', 'submission-playgama/cover-800x800.png', '800x800');
  // GameDistribution thumbnails (JPG)
  await keyArt(1280, 550, t('1280x550.png'));
  jpg('submission/covers/cover-1920x1080.png', 'submission-gd/thumbnails/thumb-1280x720.jpg', '1280x720');
  jpg('submission/covers/cover-1920x1080.png', 'submission-gd/thumbnails/thumb-512x384.jpg', '512x384');
  jpg('submission/covers/cover-1920x1080.png', 'submission-gd/thumbnails/thumb-200x120.jpg', '200x120');
  jpg('submission/covers/cover-800x800.png', 'submission-gd/thumbnails/thumb-512x512.jpg', '512x512');
  jpg(t('1280x550.png'), 'submission-gd/thumbnails/thumb-1280x550.jpg', '1280x550');
  // GamePix: icon 256x256 + cover 1360x850 (JPG)
  await keyArt(1360, 850, t('1360x850.png'));
  jpg('submission/covers/cover-800x800.png', 'submission-gamepix/icon-256x256.jpg', '256x256');
  jpg(t('1360x850.png'), 'submission-gamepix/cover-1360x850.jpg', '1360x850');
  // GameMonetize: the same scene without the logo (no text at all), JPG under 300 KB
  await keyArt(1024, 768, t('gm-1024x768.png'), false);
  await keyArt(1024, 1024, t('gm-1024x1024.png'), false);
  await keyArt(1024, 680, t('gm-1024x680.png'), false);
  jpgUnder(t('gm-1024x768.png'), 'submission-gamemonetize/sprout-trail-512x384.jpg', '512x384', 300);
  jpgUnder(t('gm-1024x1024.png'), 'submission-gamemonetize/sprout-trail-512x512.jpg', '512x512', 300);
  jpgUnder(t('gm-1024x680.png'), 'submission-gamemonetize/sprout-trail-512x340.jpg', '512x340', 300);
  // Y8 promos (JPG, with the logo as part of the picture)
  jpg('submission/covers/cover-1920x1080.png', 'submission-y8/media/promo-landscape-1920x1080.jpg', '1920x1080');
  await keyArt(1080, 1920, t('y8-1080x1920.png'));
  jpg(t('y8-1080x1920.png'), 'submission-y8/media/promo-portrait-1080x1920.jpg', '1080x1920');
  await keyArt(760, 570, t('y8-760x570.png'));
  jpg(t('y8-760x570.png'), 'submission-y8/media/promo-card-760x570.jpg', '760x570');
  console.log('store art done');
}

/** four moments of real play, with the HUD (Y8 screenshots: gameplay only, no menus or title screens) */
const MOMENTS: { level: string; cond: string; what: string }[] = [
  { level: '1-3', cond: 's.x > 124.5', what: 'Spring Meadow 3: swinging on a rope over the crocodile lake' },
  { level: '3-1', cond: 's.x > 250.5 && s.y > 2.5', what: 'Mushroom Valley 1: bouncing from giant mushroom to mushroom' },
  { level: '2-2', cond: 's.x > 143', what: 'Deep Forest 2: the hidden path behind the waterfall' },
  { level: '4-1', cond: 's.x > 233', what: 'Autumn Woods 1: jumping into the wind gusts' },
];

async function y8() {
  mkdirSync('submission-y8/media', { recursive: true });
  for (const [w, h] of [
    [1280, 720],
    [760, 570],
  ]) {
    const d = await Driver.open(base, w, h, 1);
    for (let i = 0; i < MOMENTS.length; i++) {
      const m = MOMENTS[i];
      await d.startBot(m.level, false, 0.3);
      await d.skipUntil(m.cond);
      await d.play(1 / 30);
      await d.shot(t(`y8-shot-${i + 1}.png`));
      jpg(t(`y8-shot-${i + 1}.png`), `submission-y8/media/screenshot-${w}x${h}-${i + 1}.jpg`, `${w}x${h}`, 90);
    }
    await d.close();
  }
  // the gameplay video: one continuous take of the Golden Grove 1-S from just before its swing ropes (crocodile lake,
  // golden acorn at ~4 s), 25 s at 30 fps, no edits, no sound
  await video(1280, 720, 'submission-y8/media/gameplay-1280x720.mp4', [{ level: '1-S', from: 's.x > 212', sec: 25 }], false);
  console.log('y8 media done');
}

/** frames recorded through Chrome's screenshot API while the game is ticked at a fixed rate */
async function video(w: number, h: number, out: string, takes: { level: string; from: string; sec: number }[], stills: boolean) {
  const FPS = 30;
  const dir = join(tmp, `video-${w}x${h}-${Date.now()}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;
  const next = () => join(dir, `f${String(n++).padStart(5, '0')}.jpg`);
  const d = await Driver.open(base, w, h, 1);
  d.fps = FPS;
  const cdp = await d.page.context().newCDPSession(d.page);
  const grab = async () => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
    const f = next();
    writeFileSync(f, Buffer.from(data, 'base64'));
    return f;
  };
  const still = async (sec: number) => {
    await d.startBot(KEY.level, false, 0.3);
    await d.skipUntil(KEY.cond);
    const f = frameFor(w, h);
    await d.page.evaluate(([z, l]) => (window as unknown as { __game: { cover(on: boolean, z: number, l: number): void } }).__game.cover(true, z, l), [f.zoom, f.lift] as [number, number]);
    await d.play(1 / FPS);
    const first = await grab();
    for (let i = 1; i < sec * FPS; i++) copyFileSync(first, next());
    await d.page.evaluate(() => (window as unknown as { __game: { cover(on: boolean): void } }).__game.cover(false));
  };
  if (stills) await still(1.2);
  d.onFrame = async () => void (await grab());
  for (const k of takes) {
    await d.startBot(k.level, false, 0.6);
    await d.skipUntil(k.from);
    await d.play(k.sec);
  }
  d.onFrame = null;
  if (stills) await still(1.2);
  await d.close();
  const total = readdirSync(dir).length / FPS;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%05d.jpg'), '-vf', `scale=${w}:${h}`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`wrote ${out}: ${total.toFixed(1)} s`);
}

/** CrazyGames trailers: key art, then real play at normal speed across the set pieces, key art again (18 s) */
async function trailers() {
  mkdirSync('submission/videos', { recursive: true });
  const takes = [
    { level: '1-3', from: 's.x > 119', sec: 3 }, // rope swings over the crocodile lake
    { level: '3-1', from: 's.x > 244', sec: 3 }, // giant bouncy mushrooms
    { level: '1-7', from: 's.x > 136', sec: 2.6 }, // the boar chase
    { level: '2-2', from: 's.x > 138', sec: 2.6 }, // behind the waterfall
    { level: '5-1', from: 's.x > 403', sec: 3.2 }, // moonlit swamp ropes
  ];
  for (const [w, h] of [
    [1920, 1080],
    [1080, 1620],
  ])
    await video(w, h, `submission/videos/trailer-${w}x${h}.mp4`, takes, true);
}

if (!only || only === 'art') await art();
if (!only || only === 'y8') await y8();
if (!only || only === 'trailers') await trailers();
