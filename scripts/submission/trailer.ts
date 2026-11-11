/**
 * CrazyGames trailer: real play recorded frame by frame across the worlds (the level bot drives the game through its
 * input path), cover stills at both ends, sped up to 18 s, no sound.
 * usage: npx tsx scripts/submission/trailer.ts <width> <height> [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Driver } from '../driver';

const [W = '1920', H = '1080', base = 'http://127.0.0.1:4173/'] = process.argv.slice(2);
const FPS = 15;
const LEN = 18;
const dir = join(process.env.FRAMES_DIR ?? tmpdir(), `trailer-${W}x${H}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
mkdirSync('submission/videos', { recursive: true });
let n = 0;
const next = () => join(dir, `f${String(n++).padStart(5, '0')}.jpg`);

const d = await Driver.open(base, +W, +H, 1);
d.fps = FPS;
const cdp = await d.page.context().newCDPSession(d.page);
const grab = async () => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
  const f = next();
  writeFileSync(f, Buffer.from(data, 'base64'));
  return f;
};
const game = (code: string) => d.page.evaluate(code);

async function coverStill(sec: number) {
  await d.startBot('1-3', false, 0.5);
  await d.skipUntil("s.mode === 'cross' && s.x > 149.2");
  await game('__game.cover(true)');
  await d.play(1 / 30);
  const f = await grab();
  for (let i = 1; i < sec * FPS; i++) copyFileSync(f, next());
  await game('__game.cover(false)');
}

await coverStill(1.3);
d.onFrame = async () => void (await grab());
// 1-1: tap to jump over the first stumps
await d.startBot('1-1');
await d.skipUntil('s.x > 15');
await d.play(2.4);
// deep forest: bees over the trail
await d.startBot('2-6');
await d.skipUntil('s.x > 86');
await d.play(2.6);
// a decision point: the seed cards, the vine ladder grows, the sprite climbs the wall
await d.startBot('1-3', false, 0.7);
await d.skipUntil("s.mode === 'decide'");
await d.playUntil("s.mode === 'run'", 15);
await d.play(0.3);
// mushroom valley: a tall tree falls across the wide river
await d.startBot('3-2', false, 0.6);
await d.skipUntil("s.mode === 'decide'");
await d.playUntil("s.mode === 'run'", 15);
// autumn woods: a rolling acorn
await d.startBot('4-1');
await d.skipUntil('s.x > 24');
await d.play(2.4);
// misty swamp at full speed
await d.startBot('5-6');
await d.skipUntil('s.x > 140');
await d.play(2);
d.onFrame = null;
await coverStill(1.5);
await d.close();

const frames = readdirSync(dir).length;
const speed = LEN / (frames / FPS);
const out = `submission/videos/trailer-${W}x${H}.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%05d.jpg'), '-vf', `setpts=${speed.toFixed(4)}*PTS,fps=30,scale=${W}:${H}`, '-t', String(LEN), '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
console.log(`wrote ${out}: ${frames} frames, sped x${(1 / speed).toFixed(2)}`);
