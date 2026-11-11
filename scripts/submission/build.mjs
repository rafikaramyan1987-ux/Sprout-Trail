// Portal submission folders. Run after the builds (npm run build:all):
//   node scripts/submission/build.mjs
// Each run writes the zips of the version in package.json; zips of older versions stay next to them.
// - submission/          CrazyGames: zip of dist/ (index.html at the root), covers + trailers (covers.ts, trailer.ts)
// - submission-gd/       GameDistribution: zip of dist-gd/ (index.html at the root), JPG thumbnails, texts
// - submission-gamepix/  GamePix: zip of dist-gamepix/, icon + cover, description (100-500) and how-to-play (max 500)
// The Playgama zip (submission-playgama/) and the ad-free web zip (submission-web/) have their own tools:
// scripts/playgama/zip.mjs and scripts/web/zip.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { DESCRIPTION, HOW_TO_PLAY, NAME, SHORT, TAGS } from './texts.mjs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const gdId = /export const GD_GAME_ID = '([^']*)'/.exec(readFileSync('src/app/platform/gd.ts', 'utf8'))[1];
function zip(dir, out) {
  if (!existsSync(`${dir}/index.html`)) throw new Error(`${dir}/index.html missing: build first`);
  rmSync(out, { force: true });
  // the folder's contents (cwd = dir), so index.html is at the root; -X no extra attributes, -D no directory entries
  execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', `${process.cwd()}/${out}`, '.', '-x', '*.DS_Store'], { cwd: dir });
  console.log('wrote', out);
}
for (const d of ['submission', 'submission-gd', 'submission-gamepix']) mkdirSync(d, { recursive: true });
zip('dist', `submission/sprout-trail-crazygames-v${version}.zip`);
zip('dist-gd', `submission-gd/sprout-trail-gd-v${version}.zip`);
zip('dist-gamepix', `submission-gamepix/sprout-trail-gamepix-v${version}.zip`);
const older = (dir) => readdirSync(dir).filter((f) => f.endsWith('.zip') && !f.includes(`-v${version}.zip`)).sort();
const list = (dir) => older(dir).map((z) => `\`${z}\``).join(', ') || 'none';

const texts = `## Short description
${SHORT}

## Description (${DESCRIPTION.length} characters)
${DESCRIPTION}

## How to play (${HOW_TO_PLAY.length} characters)
${HOW_TO_PLAY}

## Tags
${TAGS.join(', ')}
`;

writeFileSync(
  'submission/README.md',
  `# ${NAME} — CrazyGames submission

${texts}
## Files
- \`sprout-trail-crazygames-v${version}.zip\` — the CrazyGames build (\`npm run build\`), \`index.html\` at the root,
  relative paths only. CrazyGames SDK v3: loadingStart/Stop while booting, gameplayStart/Stop only around real play,
  happytime on a finished level, midgame ads only between levels (Next / Retry / Menu on the result screen, at most
  one per 2 minutes, none in the first 2 minutes), rewarded ads only from the clearly labelled buttons ("Watch an
  ad: +2 seeds", "Watch an ad: continue with 1 heart", "Watch an ad: double gems"), granted only on adFinished;
  8 s timeout, then "No ad available right now, try later" for 2.5 s. Language from the SDK locale (6 languages),
  saves in the SDK Data Module, the platform mute setting is followed live.
- Older versions: ${list('submission')}.
- \`covers/cover-1920x1080.png\`, \`covers/cover-800x1200.png\`, \`covers/cover-800x800.png\` — from real play
  (\`scripts/submission/covers.ts\`); the logo sits at the bottom, the top-left corner is clear.
- \`videos/trailer-1920x1080.mp4\`, \`videos/trailer-1080x1620.mp4\` — 18 s, no sound, real play across the 5 worlds
  (\`scripts/submission/trailer.ts\`).

Regenerate: \`npm run build:all\`, \`npx vite preview --outDir dist-web --port 4173\`, then
\`npx tsx scripts/submission/covers.ts\`, \`npx tsx scripts/submission/trailer.ts 1920 1080\`,
\`npx tsx scripts/submission/trailer.ts 1080 1620\` and \`node scripts/submission/build.mjs\`.
`,
);

writeFileSync(
  'submission-gd/README.md',
  `# ${NAME} — GameDistribution submission

- **Build:** \`sprout-trail-gd-v${version}.zip\` (\`npm run build:gd\`): \`index.html\` at the root of the zip, assets in
  \`assets/\`, relative paths only. GameDistribution HTML5 SDK (\`GD_OPTIONS\` + main.min.js loaded at boot):
  SDK_GAME_PAUSE / SDK_GAME_START pause and resume the game and its audio, interstitials only between levels (at most
  one per 2 minutes), rewarded ads only from the labelled buttons, reward only after SDK_REWARDED_WATCH_COMPLETE.
- **Game ID:** \`${gdId}\` — **a placeholder.** Register the game on GameDistribution, put the real 32-character ID in
  \`GD_GAME_ID\` (\`src/app/platform/gd.ts\`), then \`npm run build:gd && npm run submission\`. CI
  (\`scripts/check-gd.mjs\`) checks the build carries the ID and flags the placeholder.
- **Older versions:** ${list('submission-gd')}.
- **Thumbnails (JPG):** \`thumbnails/thumb-512x384.jpg\`, \`thumb-512x512.jpg\`, \`thumb-200x120.jpg\`,
  \`thumb-1280x720.jpg\`, \`thumb-1280x550.jpg\`.
- **Orientation:** landscape and portrait, desktop and mobile. **Category:** Platformer / Casual.

## Name
${NAME}

${texts}`,
);

writeFileSync(
  'submission-gamepix/README.md',
  `# ${NAME} — GamePix submission

- **Build:** \`sprout-trail-gamepix-v${version}.zip\` (\`npm run build:gamepix\`): \`index.html\` at the root, relative paths
  only. \`window.GamePixConfig = { lifecycle: 'manual' }\` and the GamePix SDK v3 script come first in \`<head>\`, before
  the game. Lifecycle: loading(0-100) during boot, \`loaded()\` before the menu, \`gameStart()\` at the first level. The
  SDK's \`pause\`/\`resume\` and \`soundOff\`/\`soundOn\` events (and the legacy \`GamePix.pause/resume/soundOff/soundOn\`
  handlers) pause the game and silence it. Interstitials only between levels (at most one per 2 minutes), rewarded
  ads only from the labelled buttons, reward only when \`ads.reward()\` resolves with \`success: true\`. Language from
  \`GamePix.lang()\`.
- **Older versions:** ${list('submission-gamepix')}.
- **Icon / cover:** \`icon-256x256.jpg\`, \`cover-1360x850.jpg\` (from real play).

## Name
${NAME}

${texts}
## Category
Platformer
`,
);
console.log('READMEs written');
