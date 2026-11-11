/**
 * Phase B review screenshots (docs/phase-b/): the menus in German and Russian at 390x844 (text fit), the seed cards,
 * and each world on desktop. usage: npx tsx scripts/phase-b-shots.ts [baseUrl]   (serve dist-web first)
 */
import { mkdirSync } from 'node:fs';
import { Driver } from './driver';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = 'docs/phase-b';
mkdirSync(out, { recursive: true });
const G = (d: Driver, code: string) => d.page.evaluate(code);
const progress = `__game.setSave({ gems: 1340, hat: 'straw', owned: ['acorn','straw','sun'], streak: 4, bestStreak: 6, dailyDay: -1, levels: Object.fromEntries([...Array(12)].map((_, i) => ['1-' + (i + 1), { stars: 3, acorns: 3, gems: 50, done: true }]).concat([['2-1', { stars: 2, acorns: 2, gems: 40, done: true }], ['2-2', { stars: 3, acorns: 3, gems: 40, done: true }]])) })`;

{
  const d = await Driver.open(base, 390, 844, 2);
  await G(d, progress);
  await G(d, "__game.lang('de'); __game.title()");
  await d.play(0.4);
  await d.shot(`${out}/phone-de-title.png`);
  await G(d, '__game.showWorlds(2)');
  await d.play(0.3);
  await d.shot(`${out}/phone-de-worlds.png`);
  await G(d, "__game.lang('ru'); __game.showWardrobe()");
  await d.play(0.3);
  await d.shot(`${out}/phone-ru-wardrobe.png`);
  await G(d, '__game.showDaily()');
  await d.play(0.3);
  await d.shot(`${out}/phone-ru-daily.png`);
  await G(d, "__game.lang('de')");
  await d.startBot('2-6', false, 99);
  await d.skipUntil("s.mode === 'decide'");
  await d.play(0.9);
  await d.shot(`${out}/phone-de-seed-cards-acorn-choice.png`);
  await G(d, "__game.lang('ru')");
  await d.startBot('4-5', false, 99);
  await d.skipUntil('s.x > 70');
  await d.play(0.3);
  await d.shot(`${out}/phone-ru-autumn.png`);
  await d.close();
}
{
  const d = await Driver.open(base, 1920, 1080, 1);
  const shots: [string, string, string][] = [
    ['2-3', 's.x > 60', 'desktop-2-deep-forest.png'],
    ['3-8', "s.mode === 'cross'", 'desktop-3-mushroom-valley-tree.png'],
    ['4-4', 's.x > 120', 'desktop-4-autumn-woods.png'],
    ['5-9', 's.x > 100', 'desktop-5-misty-swamp.png'],
    ['2-2', "s.mode === 'cross' && s.y < -1", 'desktop-2-leaf-glide.png'],
  ];
  for (const [id, cond, file] of shots) {
    await d.startBot(id, false, 0.5);
    await d.skipUntil(cond);
    await d.play(0.5);
    await d.shot(`${out}/${file}`);
  }
  await d.close();
}
