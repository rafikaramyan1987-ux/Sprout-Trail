/**
 * Phase A preview screenshots from real play (bot input through the game's input path, software WebGL):
 * phone 390x844 (rendered at 2x) and desktop 1920x1080, including decision points with the seed cards.
 * usage: npx tsx scripts/preview-shots.ts [baseUrl]   (serve dist-web first, e.g. npx vite preview --outDir dist-web)
 */
import { mkdirSync } from 'node:fs';
import { Driver } from './driver';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = 'docs/preview';
mkdirSync(out, { recursive: true });

{
  const d = await Driver.open(base, 390, 844, 2);
  await d.play(0.5);
  await d.shot(`${out}/phone-1-title.png`);
  await d.startBot('1-1');
  await d.skipUntil('s.x > 13.5');
  await d.play(0.4);
  await d.shot(`${out}/phone-2-tap-to-jump.png`);
  await d.startBot('1-3');
  await d.skipUntil("s.mode === 'decide'");
  await d.play(0.8);
  await d.shot(`${out}/phone-3-seed-cards-wall.png`);
  await d.close();
}
{
  const d = await Driver.open(base, 1920, 1080, 1);
  await d.startBot('1-1');
  await d.skipUntil('s.x > 76');
  await d.play(0.2);
  await d.shot(`${out}/desktop-1-hold-to-jump.png`);
  await d.startBot('1-2');
  await d.skipUntil("s.mode === 'decide'");
  await d.play(0.8);
  await d.shot(`${out}/desktop-2-seed-cards-river.png`);
  await d.startBot('1-3');
  await d.skipUntil("s.mode === 'cross' && s.x > 148");
  await d.play(0.25);
  await d.shot(`${out}/desktop-3-mushroom-over-thorns.png`);
  await d.close();
}
