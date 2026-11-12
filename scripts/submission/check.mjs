// CI check of the submission rules: zips have index.html at the root and relative paths, store texts fit the
// portals' limits, each portal build loads only its own SDK, the art has the required sizes.
// usage: node scripts/submission/check.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { CONTROLS, DESCRIPTION, HOW_TO_PLAY } from './texts.mjs';

let bad = 0;
const fail = (m) => (bad++, console.log('FAIL', m));
if (DESCRIPTION.length > 500 || DESCRIPTION.length < 100) fail(`description is ${DESCRIPTION.length} chars (100-500)`);
if (HOW_TO_PLAY.length > 500) fail(`how-to-play is ${HOW_TO_PLAY.length} chars (max 500)`);
if (DESCRIPTION.length > 600) fail(`GameMonetize description is ${DESCRIPTION.length} chars (max 600)`);
if (CONTROLS.length > 350) fail(`GameMonetize controls are ${CONTROLS.length} chars (max 350)`);
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const newest = (dir) => readdirSync(dir).filter((f) => f.endsWith('.zip')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).pop();
const SDKS = { crazygames: 'sdk.crazygames.com', gd: 'html5.api.gamedistribution.com', gamepix: 'gamepix.sdk.js', playgama: 'playgama-bridge.js', gamemonetize: 'api.gamemonetize.com/sdk.js', y8: 'cdn.y8.com/minimal-sdk' };
const dirs = { submission: 'crazygames', 'submission-gd': 'gd', 'submission-gamepix': 'gamepix', 'submission-playgama': 'playgama', 'submission-web': 'web', 'submission-gamemonetize': 'gamemonetize', 'submission-y8': 'y8' };
// each folder holds exactly the zip to upload
for (const dir of Object.keys(dirs)) if (existsSync(dir) && readdirSync(dir).filter((f) => f.endsWith('.zip')).length !== 1) fail(`${dir}: more than one zip (keep only the one to upload)`);
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
  'submission-gamemonetize/sprout-trail-512x384.jpg',
  'submission-gamemonetize/sprout-trail-512x512.jpg',
  'submission-gamemonetize/sprout-trail-512x340.jpg',
  ...[1, 2, 3, 4].flatMap((i) => [`submission-y8/media/screenshot-760x570-${i}.jpg`, `submission-y8/media/screenshot-1280x720-${i}.jpg`]),
  'submission-y8/media/promo-landscape-1920x1080.jpg',
  'submission-y8/media/promo-portrait-1080x1920.jpg',
  'submission-y8/media/promo-card-760x570.jpg',
  'submission-y8/media/gameplay-1280x720.mp4',
  ...[1, 2, 3, 4].map((i) => `submission-web/screenshot-${i}.png`),
];
for (const f of need) {
  if (!existsSync(f)) {
    fail(`missing ${f}`);
    continue;
  }
  const want = /(\d+)x(\d+)(?:-\d)?\.\w+$/.exec(f);
  const kb = statSync(f).size / 1024;
  if (f.endsWith('.mp4')) {
    const { w, h, dur } = mp4Info(f);
    // Y8: 16:9, at least 1280x720, 20-30 s (best moment in the 20 s preview), under 50 MB; CrazyGames trailers 15-20 s
    const [lo, hi] = f.includes('submission-y8') ? [20, 30] : [15, 20];
    if (`${w}x${h}` !== `${want[1]}x${want[2]}` || dur < lo || dur > hi) fail(`${f}: ${w}x${h}, ${dur.toFixed(1)} s (want ${want[1]}x${want[2]}, ${lo}-${hi} s)`);
    if (kb > 50 * 1024) fail(`${f}: ${(kb / 1024).toFixed(1)} MB (max 50 MB)`);
  } else {
    if (f.includes('submission-gamemonetize') && kb > 300) fail(`${f}: ${kb.toFixed(0)} KB (GameMonetize: under 300 KB)`);
    if (f.includes('submission-y8') && kb > (/760x570/.test(f) ? 2048 : 5120)) fail(`${f}: ${kb.toFixed(0)} KB (Y8 limit)`);
    if ((f.includes('submission-gamemonetize') || f.includes('submission-y8')) && !f.endsWith('.jpg')) fail(`${f}: JPG wanted`);
    const m = await sharp(f).metadata();
    const size = `${m.width}x${m.height}`;
    const expect = want ? `${want[1]}x${want[2]}` : f.includes('screenshot') ? '1280x720' : null;
    if (expect && size !== expect) fail(`${f}: ${size}, want ${expect}`);
  }
}

/** width / height of the first video track and the duration, read from the MP4 boxes (no ffprobe needed) */
function mp4Info(file) {
  const b = readFileSync(file);
  let dur = 0,
    w = 0,
    h = 0;
  const walk = (start, end) => {
    for (let p = start; p + 8 <= end; ) {
      let size = b.readUInt32BE(p);
      const type = b.toString('latin1', p + 4, p + 8);
      if (size === 1) size = Number(b.readBigUInt64BE(p + 8));
      if (size < 8) break;
      if (['moov', 'trak'].includes(type)) walk(p + 8, p + size);
      if (type === 'mvhd') {
        const v = b[p + 8];
        const ts = v ? b.readUInt32BE(p + 28) : b.readUInt32BE(p + 20);
        const d = v ? Number(b.readBigUInt64BE(p + 32)) : b.readUInt32BE(p + 24);
        dur = d / ts;
      }
      if (type === 'tkhd' && !w) {
        const tw = b.readUInt32BE(p + size - 8) / 65536,
          th = b.readUInt32BE(p + size - 4) / 65536;
        if (tw && th) [w, h] = [tw, th];
      }
      p += size;
    }
  };
  walk(0, b.length);
  return { w, h, dur };
}
console.log(bad ? `${bad} problem(s)` : 'submission checks passed');
process.exit(bad ? 1 : 0);
