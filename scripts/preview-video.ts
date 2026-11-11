/**
 * Phase A preview video: the 3 spring meadow levels played at phone size (390x844) by the level bot through the
 * game's real input path, frame by frame (software WebGL), cut to the key moments and encoded to ~30 s MP4.
 * usage: npx tsx scripts/preview-video.ts [baseUrl] [out.mp4]   (serve dist-web first)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Driver } from './driver';

const [base = 'http://127.0.0.1:4173/', out = 'docs/preview/sprout-trail-3-levels-390x844.mp4'] = process.argv.slice(2);
const W = 390,
  H = 844,
  FPS = 30,
  TARGET = 30;
const dir = join(process.env.FRAMES_DIR ?? tmpdir(), 'sprout-frames');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const d = await Driver.open(base, W, H, 1);
d.fps = FPS;
let n = 0;
d.onFrame = async () => {
  await d.page.screenshot({ path: join(dir, `f${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90, timeout: 180_000 });
  if (n % 60 === 0) console.log('frames', n);
};

// title, then level 1: tap to jump, hold to jump higher, swipe down to duck
await d.play(1.2);
await d.startBot('1-1');
await d.play(6.5);
await d.skipUntil('s.x > 136');
await d.play(3.2);
// level 2: the first decision point, a wrong seed first (the vine splashes), then the bridge
await d.startBot('1-2', true, 0.9);
await d.skipUntil("s.mode === 'decide'");
await d.playUntil("s.mode === 'run'", 20);
await d.play(0.8);
// level 3: vine ladder up the wall, mushroom over the thorns, then the goal
await d.startBot('1-3', false, 0.8);
await d.skipUntil('s.x > 67');
await d.playUntil("s.mode === 'run' && s.y > 4", 20);
await d.play(0.6);
await d.skipUntil('s.x > 143');
await d.playUntil("s.mode === 'run'", 20);
await d.play(0.6);
await d.skipUntil('s.x > 212');
await d.playUntil("s.screen === 'end'", 20);
await d.play(1.5);
await d.close();

const frames = readdirSync(dir).length;
const dur = frames / FPS;
const speed = dur > TARGET ? TARGET / dur : 1;
console.log(`frames ${frames}, ${dur.toFixed(1)} s, speed x${(1 / speed).toFixed(2)}`);
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%05d.jpg'),
  '-vf', `setpts=${speed.toFixed(4)}*PTS,scale=${W}:${H}:flags=lanczos,fps=${FPS}`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out,
]);
console.log('wrote', out);
