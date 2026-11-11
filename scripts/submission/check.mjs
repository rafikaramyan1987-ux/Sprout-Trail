// CI check of the submission rules: zips have index.html at the root and relative paths, store texts fit the
// portals' limits, each portal build loads only its own SDK, the art has the required sizes.
// usage: node scripts/submission/check.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { DESCRIPTION, HOW_TO_PLAY } from './texts.mjs';

let bad = 0;
const fail = (m) => (bad++, console.log('FAIL', m));
if (DESCRIPTION.length > 500 || DESCRIPTION.length < 100) fail(`description is ${DESCRIPTION.length} chars (100-500)`);
if (HOW_TO_PLAY.length > 500) fail(`how-to-play is ${HOW_TO_PLAY.length} chars (max 500)`);
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const newest = (dir) => readdirSync(dir).filter((f) => f.endsWith('.zip')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).pop();
const SDKS = { crazygames: 'sdk.crazygames.com', gd: 'html5.api.gamedistribution.com', gamepix: 'gamepix.sdk.js', playgama: 'playgama-bridge.js' };
const dirs = { submission: 'crazygames', 'submission-gd': 'gd', 'submission-gamepix': 'gamepix', 'submission-playgama': 'playgama', 'submission-web': 'web' };
for (const [dir, portal] of Object.entries(dirs)) {
  const z = newest(dir);
  if (!z) {
    fail(`${dir}: no zip`);
    continue;
  }
  if (['submission', 'submission-gd', 'submission-gamepix'].includes(dir) && !z.endsWith(`-v${version}.zip`)) fail(`${dir}: the newest zip ${z} is not version ${version} (run npm run submission)`);
  const files = execFileSync('unzip', ['-Z1', `${dir}/${z}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (!files.includes('index.html')) fail(`${dir}/${z}: index.html is not at the root`);
  if (files.some((f) => f.startsWith('/') || f.split('/').includes('..'))) fail(`${dir}/${z}: unsafe paths`);
  const html = execFileSync('unzip', ['-p', `${dir}/${z}`, 'index.html'], { encoding: 'utf8' });
  if (/(src|href)="\//.test(html)) fail(`${dir}/${z}: absolute paths in index.html`);
  const code = files.filter((f) => f.endsWith('.js') || f.endsWith('.html')).map((f) => execFileSync('unzip', ['-p', `${dir}/${z}`, f], { encoding: 'utf8', maxBuffer: 64 << 20 })).join('\n');
  for (const [p, needle] of Object.entries(SDKS)) {
    const has = code.includes(needle);
    if (p === portal && !has) fail(`${dir}/${z}: does not load its own SDK (${needle})`);
    if (p !== portal && has) fail(`${dir}/${z}: contains another portal's SDK (${needle})`);
  }
  if (portal === 'gamepix' && html.indexOf('GamePixConfig') > html.indexOf('type="module"')) fail('gamepix: GamePixConfig must come before the game bundle');
  console.log('ok', `${dir}/${z}`, files.length, 'files');
}
const need = [
  'submission/covers/cover-1920x1080.png',
  'submission/covers/cover-800x1200.png',
  'submission/covers/cover-800x800.png',
  'submission/videos/trailer-1920x1080.mp4',
  'submission/videos/trailer-1080x1620.mp4',
  'submission-gd/thumbnails/thumb-512x384.jpg',
  'submission-gd/thumbnails/thumb-512x512.jpg',
  'submission-gd/thumbnails/thumb-200x120.jpg',
  'submission-gd/thumbnails/thumb-1280x720.jpg',
  'submission-gd/thumbnails/thumb-1280x550.jpg',
  'submission-gamepix/icon-256x256.jpg',
  'submission-gamepix/cover-1360x850.jpg',
  'submission-playgama/cover-800x800.png',
  'submission-playgama/cover-1080x1920.png',
  'submission-playgama/cover-1920x1080.png',
  'submission-web/cover-630x500.png',
  ...[1, 2, 3, 4].map((i) => `submission-web/screenshot-${i}.png`),
];
for (const f of need) {
  if (!existsSync(f)) {
    fail(`missing ${f}`);
    continue;
  }
  const want = /(\d+)x(\d+)\.\w+$/.exec(f);
  if (f.endsWith('.mp4')) {
    const [w, h, dur] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0:s=x', f], { encoding: 'utf8' }).trim().split(/\s+|x/).map(Number);
    if (`${w}x${h}` !== `${want[1]}x${want[2]}` || dur < 15 || dur > 20) fail(`${f}: ${w}x${h}, ${dur} s (want ${want[1]}x${want[2]}, about 18 s)`);
  } else {
    const size = execFileSync('identify', ['-format', '%wx%h', f], { encoding: 'utf8' }).trim();
    const expect = want ? `${want[1]}x${want[2]}` : f.includes('screenshot') ? '1280x720' : null;
    if (expect && size !== expect) fail(`${f}: ${size}, want ${expect}`);
  }
}
console.log(bad ? `${bad} problem(s)` : 'submission checks passed');
process.exit(bad ? 1 : 0);
