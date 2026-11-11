/**
 * Store art rendered from real play (the level bot drives the game; the HUD is hidden and the logo shown at the
 * bottom, so the top-left corner stays clear): CrazyGames covers (PNG), GameDistribution thumbnails (JPG), GamePix
 * icon + cover (JPG), Playgama covers (PNG). usage: npx tsx scripts/submission/covers.ts [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Driver } from '../driver';

const [base = 'http://127.0.0.1:4173/'] = process.argv.slice(2);

/** the mushroom bounce over the thorns of level 1-3, the sprite high in the air */
async function render(w: number, h: number, out: string) {
  const d = await Driver.open(base, w, h, 1);
  await d.startBot('1-3', false, 0.5);
  await d.skipUntil("s.mode === 'cross' && s.x > 149.2");
  await d.page.evaluate(() => (window as unknown as { __game: { cover(on: boolean): void } }).__game.cover(true));
  await d.play(1 / 30);
  await d.shot(out);
  await d.close();
}
const jpg = (src: string, out: string, size: string) => execFileSync('convert', [src, '-resize', `${size}^`, '-gravity', 'center', '-extent', size, '-quality', '90', '-strip', out]);
const png = (src: string, out: string, size: string) => execFileSync('convert', [src, '-resize', `${size}^`, '-gravity', 'center', '-extent', size, '-strip', out]);

for (const d of ['submission/covers', 'submission-gd/thumbnails', 'submission-gamepix', 'submission-playgama']) mkdirSync(d, { recursive: true });
const tmp = (n: string) => join(tmpdir(), `st-${n}.png`);
await render(1920, 1080, 'submission/covers/cover-1920x1080.png');
await render(800, 1200, 'submission/covers/cover-800x1200.png');
await render(800, 800, 'submission/covers/cover-800x800.png');
await render(1280, 550, tmp('1280x550'));
await render(1360, 850, tmp('1360x850'));
await render(1080, 1920, 'submission-playgama/cover-1080x1920.png');
const wide = 'submission/covers/cover-1920x1080.png';
const sq = 'submission/covers/cover-800x800.png';
jpg(wide, 'submission-gd/thumbnails/thumb-1280x720.jpg', '1280x720');
jpg(wide, 'submission-gd/thumbnails/thumb-512x384.jpg', '512x384');
jpg(wide, 'submission-gd/thumbnails/thumb-200x120.jpg', '200x120');
jpg(sq, 'submission-gd/thumbnails/thumb-512x512.jpg', '512x512');
jpg(tmp('1280x550'), 'submission-gd/thumbnails/thumb-1280x550.jpg', '1280x550');
jpg(sq, 'submission-gamepix/icon-256x256.jpg', '256x256');
jpg(tmp('1360x850'), 'submission-gamepix/cover-1360x850.jpg', '1360x850');
png(wide, 'submission-playgama/cover-1920x1080.png', '1920x1080');
png(sq, 'submission-playgama/cover-800x800.png', '800x800');
console.log('store art done');
