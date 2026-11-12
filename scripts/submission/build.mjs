// Portal submission folders. Run after the builds (npm run build:all):
//   npm run submission        (node scripts/submission/build.mjs)
// Writes every portal's upload zip (index.html at the zip root, relative paths only) and its README with the
// ready-to-paste store fields. Zips of older versions are removed: each folder holds exactly what to upload.
// - submission/              CrazyGames: zip of dist/, covers + trailers (scripts/submission/media.ts)
// - submission-gd/           GameDistribution: zip of dist-gd/, JPG thumbnails
// - submission-gamepix/      GamePix: zip of dist-gamepix/, icon + cover
// - submission-playgama/     Playgama: zip of dist-playgama/ (scripts/playgama/zip.mjs), covers
// - submission-gamemonetize/ GameMonetize: zip of dist-gamemonetize/, three JPG images without text
// - submission-y8/           Y8: zip of dist-y8/, screenshots, promos, gameplay video (media/)
// - submission-web/          open portals, ad-free web build (scripts/web/zip.mjs)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { CONTROLS, DESCRIPTION, HOW_TO_PLAY, LANGUAGES, NAME, SHORT, TAGS } from './texts.mjs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const id = (file, name) => new RegExp(`export const ${name} = '([^']*)'`).exec(readFileSync(file, 'utf8'))[1];
const GD_ID = id('src/app/platform/gd.ts', 'GD_GAME_ID');
const GM_ID = id('src/app/platform/gamemonetize.ts', 'GM_GAME_ID');
const Y8_APP = id('src/app/platform/y8.ts', 'Y8_APP_ID');
const Y8_GAME = id('src/app/platform/y8.ts', 'Y8_GAME_ID');
/** the first GameMonetize / Y8 upload */
export const GM_ZIP = 'sprout-trail-gamemonetize-v2.zip';
export const Y8_ZIP = 'sprout-trail-y8-v2.zip';

function zip(dir, out) {
  if (!existsSync(`${dir}/index.html`)) throw new Error(`${dir}/index.html missing: build first (npm run build:all)`);
  rmSync(out, { force: true });
  // the folder's contents (cwd = dir), so index.html is at the root; -X no extra attributes, -D no directory entries
  execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', `${process.cwd()}/${out}`, '.', '-x', '*.DS_Store'], { cwd: dir });
  console.log('wrote', out);
}
/** keep only `keep` among the folder's zips */
function only(dir, keep) {
  for (const f of readdirSync(dir)) if (f.endsWith('.zip') && f !== keep) rmSync(`${dir}/${f}`);
}
for (const d of ['submission', 'submission-gd', 'submission-gamepix', 'submission-gamemonetize', 'submission-y8', 'submission-playgama', 'submission-web']) mkdirSync(d, { recursive: true });
const CG_ZIP = `sprout-trail-crazygames-v${version}.zip`;
const GD_ZIP = `sprout-trail-gd-v${version}.zip`;
const GPX_ZIP = `sprout-trail-gamepix-v${version}.zip`;
zip('dist', `submission/${CG_ZIP}`);
zip('dist-gd', `submission-gd/${GD_ZIP}`);
zip('dist-gamepix', `submission-gamepix/${GPX_ZIP}`);
zip('dist-gamemonetize', `submission-gamemonetize/${GM_ZIP}`);
zip('dist-y8', `submission-y8/${Y8_ZIP}`);
// Playgama and the web zip have their own tools (exclusions, checks)
execFileSync('node', ['scripts/playgama/zip.mjs'], { stdio: 'inherit' });
execFileSync('node', ['scripts/web/zip.mjs'], { stdio: 'inherit' });
const newest = (dir) => readdirSync(dir).filter((f) => f.endsWith('.zip')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).pop();
const PG_ZIP = newest('submission-playgama');
const WEB_ZIP = newest('submission-web');
only('submission', CG_ZIP);
only('submission-gd', GD_ZIP);
only('submission-gamepix', GPX_ZIP);
only('submission-gamemonetize', GM_ZIP);
only('submission-y8', Y8_ZIP);
only('submission-playgama', PG_ZIP);
only('submission-web', WEB_ZIP);

const fence = (s) => '```\n' + s + '\n```';
const texts = `## Short description
${fence(SHORT)}

## Description (${DESCRIPTION.length} characters)
${fence(DESCRIPTION)}

## How to play (${HOW_TO_PLAY.length} characters)
${fence(HOW_TO_PLAY)}

## Tags
${fence(TAGS.join(', '))}

## Languages
${LANGUAGES}
`;
const robust = `- **Robust (v1.2.1):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad (and any pause an SDK starts on its own) gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).`;

writeFileSync(
  'submission/README.md',
  `# ${NAME} — CrazyGames submission (for later)

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game (folder upload: unzip and upload the folder, or the zip) | \`${CG_ZIP}\` — \`index.html\` at the root, relative paths only |
| Cover 16:9 | \`covers/cover-1920x1080.png\` |
| Cover 2:3 | \`covers/cover-800x1200.png\` |
| Cover 1:1 | \`covers/cover-800x800.png\` |
| Landscape trailer | \`videos/trailer-1920x1080.mp4\` (18 s, real play, no sound) |
| Portrait trailer | \`videos/trailer-1080x1620.mp4\` (18 s, real play, no sound) |

Covers: the key-art scene from real play (Golden Grove of the Spring Meadow: the sprite flies off a swing rope
towards a golden acorn), HUD hidden, the logo at the bottom; the top-left corner is clear. Trailers: the key art,
then real play at normal speed — rope swings over the crocodile lake, giant bouncy mushrooms, the boar chase, the
path behind the waterfall, the moonlit swamp — and the key art again (\`scripts/submission/media.ts\`).

## SDK in this build
- CrazyGames SDK v3: loadingStart / loadingStop around the boot (loadingStart is sent as soon as the SDK is up),
  gameplayStart / gameplayStop only around real play and never before loadingStop, happytime on a finished level.
- Midgame ads only at the result-screen breaks (Next / Retry), at most one per 2 minutes, none in the first 2 minutes;
  rewarded ads only from the labelled buttons ("Watch an ad: +2 seeds", "… continue with 1 heart", "… double gems"),
  granted only on adFinished; no ad = "No ad available right now, try later". With an ad blocker the buttons are hidden.
- Saves in the Data Module (if Progress Save is off, localStorage); the platform mute setting is followed live.
${robust}

${texts}`,
);

writeFileSync(
  'submission-gd/README.md',
  `# ${NAME} — GameDistribution submission

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game (HTML5 zip) | \`${GD_ZIP}\` — \`index.html\` at the root, assets in \`assets/\` and \`models/\`, relative paths only |
| Thumbnail 512x384 | \`thumbnails/thumb-512x384.jpg\` |
| Thumbnail 512x512 | \`thumbnails/thumb-512x512.jpg\` |
| Thumbnail 200x120 | \`thumbnails/thumb-200x120.jpg\` |
| Thumbnail 1280x720 | \`thumbnails/thumb-1280x720.jpg\` |
| Thumbnail 1280x550 | \`thumbnails/thumb-1280x550.jpg\` |

- **Game ID:** \`${GD_ID}\` (in the build: \`GD_OPTIONS.gameId\`; \`scripts/check-gd.mjs\` checks it in CI).
- **SDK:** \`GD_OPTIONS\` + \`main.min.js\` loaded once at boot. The **pre-roll only from the first Play click** (title Play,
  a level tile or the daily trail); \`SDK_GAME_PAUSE\` pauses the game and mutes all audio, \`SDK_GAME_START\` resumes
  it and restores audio through the player's settings. Interstitials only at the result-screen breaks (Next / Retry /
  Menu), at most one per 2 minutes, never during a level. Rewarded ads only from the labelled buttons, the reward only
  after \`SDK_REWARDED_WATCH_COMPLETE\`. Every ad settles (not started in 8 s, or 120 s at most).
${robust}

## Ready-to-paste fields

**Name**
${fence(NAME)}
**Category:** Platformer (or Casual) · **Orientation:** landscape and portrait · **Devices:** desktop and mobile
(touch, mouse, keyboard) · **Size:** responsive (any frame; 16:9 suggested, e.g. 1280x720)

${texts}`,
);

writeFileSync(
  'submission-gamepix/README.md',
  `# ${NAME} — GamePix submission

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game | \`${GPX_ZIP}\` — \`index.html\` at the root, relative paths only |
| Icon 256x256 | \`icon-256x256.jpg\` |
| Cover 1360x850 | \`cover-1360x850.jpg\` |

- \`window.GamePixConfig = { lifecycle: 'manual' }\` and the GamePix SDK v3 script come first in \`<head>\`, before the
  game. Lifecycle: loading(0-100) during boot, \`loaded()\` before the menu, \`gameStart()\` at the first level. The SDK's
  \`events.on('pause' | 'resume' | 'soundOff' | 'soundOn')\` **and** the legacy \`GamePix.pause / resume / soundOff /
  soundOn\` assignments pause the game and silence it. Interstitials only at the result-screen breaks (at most one per
  2 minutes), rewarded ads only from the labelled buttons, the reward only when \`ads.reward()\` resolves with
  \`success: true\`. Language from \`GamePix.lang()\`.
${robust}

## Name
${fence(NAME)}
## Category
Platformer

${texts}`,
);

writeFileSync(
  'submission-playgama/README.md',
  `# ${NAME} — Playgama submission

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game | \`${PG_ZIP}\` — \`index.html\` at the zip root, \`playgama-bridge-config.json\` beside it, \`assets/\`, \`models/\` |
| Cover 1:1 | \`cover-800x800.png\` |
| Cover 9:16 | \`cover-1080x1920.png\` |
| Cover 16:9 | \`cover-1920x1080.png\` |

## Ready-to-paste fields

**Name:** ${NAME} · **Category:** Platformer (alternatives: Arcade, Casual) · **Languages:** ${LANGUAGES}

**Description** (${DESCRIPTION.length} characters)
${fence(DESCRIPTION)}

**How to play** (${HOW_TO_PLAY.length} characters)
${fence(HOW_TO_PLAY)}

**Tags**
${fence(TAGS.join(', '))}

## Playgama Bridge in this build
- The official Bridge from Playgama's CDN (\`https://bridge.playgama.com/v2/stable/playgama-bridge.js\`), the first script
  in \`<head>\`, loaded normally; right after it \`bridge.initialize()\`, and the game starts only once that has settled
  (a failure is logged and the game plays without the SDK). \`playgama-bridge-config.json\` is \`{}\` (Bridge's defaults).
- \`game_ready\` is the first message, sent once the loading screen is gone; \`level_started\` / \`level_completed\` /
  \`level_failed\` only after it. Language from \`platform.language\`; progress only through Bridge Storage (no
  localStorage anywhere in the build).
- Pause and audio state events pause the game and silence it. Interstitials at the result-screen breaks after the
  first finished level (Bridge paces them), no pre-roll; rewarded ads only from the labelled buttons and only where
  \`isRewardedSupported\`; the reward only on the \`rewarded\` state. Every ad settles (8 s, or 120 s at most).
${robust}
- CI: \`scripts/playgama/check.mjs\` (zip layout, CDN Bridge, Playgama's own precheck: no FAIL, no WARN) and
  \`scripts/playgama/test.mjs\` (mock platform + stubbed Playgama SDK: interstitial, rewarded completed / cancelled).
`,
);

writeFileSync(
  'submission-gamemonetize/README.md',
  `# ${NAME} — GameMonetize submission

- **Game ID:** \`${GM_ID}\` (in the build)
- **Upload:** \`${GM_ZIP}\` — \`index.html\` and \`assets/\`, \`models/\` at the zip root, relative paths only
  (Game Management > My games > select the game > drop the file; then "Verify Game" and "REQUEST ACTIVATION").

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game | \`${GM_ZIP}\` |
| Image 512x384 | \`sprout-trail-512x384.jpg\` |
| Image 512x512 | \`sprout-trail-512x512.jpg\` |
| Image 512x340 | \`sprout-trail-512x340.jpg\` |

The images are the key-art scene from real play (the sprite flies off a swing rope towards a golden acorn) without
any text or logo, each under 300 KB.

## Form fields (ready to paste)

**Name**
${fence(NAME)}
**Category** (2–3): Arcade, Adventure, Puzzle

**Tags**
${fence(TAGS.join(', '))}
**Width / Height:** \`1280\` x \`720\` (16:9; the game fills any frame size, landscape or portrait)

**Optimized for Mobile Devices:** Yes (one-finger touch controls; landscape and portrait)

**Description** (${DESCRIPTION.length} characters, limit 600)
${fence(DESCRIPTION)}
**Controls** (${CONTROLS.length} characters, limit 350)
${fence(CONTROLS)}

## Ads in this build (GameMonetize SDK)
- \`window.SDK_OPTIONS = { gameId, onEvent }\`, then \`https://api.gamemonetize.com/sdk.js\` inserted once while the game
  boots (\`<script id="gamemonetize-sdk">\` before the first script, as the SDK README's loader does), never from a click.
  If it fails to load, the game plays on without ads.
- \`SDK_GAME_PAUSE\`: the game pauses and all audio is muted. \`SDK_GAME_START\`: the game resumes and audio comes back
  through the player's own sound / music settings. \`SDK_READY\`: interstitials can be shown.
- \`sdk.showBanner()\` only at natural breaks after a click: the first Play (pre-roll) and Next / Retry / Menu on the
  result screens, at most one every ~2 minutes, never during a level, never on a timer. Every request settles once
  (\`SDK_GAME_START\`, an error, or not started within 8 s; 120 s at most).
- **No rewarded ads:** the SDK documents no rewarded API, so this build has no "watch an ad" buttons.
- No external links, no "more games", no other ad networks. Saves stay in localStorage (\`sprout-trail-save\`).
${robust}
`,
);

writeFileSync(
  'submission-y8/README.md',
  `# ${NAME} — Y8 submission

- **App ID:** \`${Y8_APP}\` · **Game ID:** \`${Y8_GAME}\` (in the build)
- **Hosting:** direct upload. It is a single-player game, so per docs.y8.com/studio/iframe-game-hosting it is uploaded
  to Y8, not iframe-hosted.

## Files to upload

| Portal tab → slot | File (in this folder) | Spec |
| --- | --- | --- |
| **Builds** → upload build | \`${Y8_ZIP}\` | \`index.html\` + \`assets/\`, \`models/\` at the zip root, relative paths only |
| **Media** → Standard Screenshot (4:3) | \`media/screenshot-760x570-1.jpg\` … \`-4.jpg\` | 760x570 JPG, < 2 MB |
| **Media** → Widescreen Screenshot (16:9) | \`media/screenshot-1280x720-1.jpg\` … \`-4.jpg\` | 1280x720 JPG, < 5 MB |
| **Media** → Landscape Promo | \`media/promo-landscape-1920x1080.jpg\` | 1920x1080 JPG, < 5 MB |
| **Media** → Portrait Promo | \`media/promo-portrait-1080x1920.jpg\` | 1080x1920 JPG, < 5 MB |
| **Media** → Game Card Promo | \`media/promo-card-760x570.jpg\` | 760x570 JPG, < 2 MB |
| **Media** → Gameplay video (16:9) | \`media/gameplay-1280x720.mp4\` | H.264 MP4 1280x720, 25 s, no sound, < 50 MB |

Screenshots (the same four moments at both sizes, all real gameplay, no menus or title screens):
1. Spring Meadow 3: swinging on a rope over the crocodile lake
2. Mushroom Valley 1: bouncing from giant mushroom to mushroom
3. Deep Forest 2: the hidden path behind the waterfall
4. Autumn Woods 1: jumping into the wind gusts

Promos: the key-art scene from real play (the sprite flies off a swing rope towards a golden acorn) with the game's
logo as part of the picture, at each size. Video: one continuous, unedited take of real play (the Golden Grove of the
Spring Meadow, played by the game's bot), gameplay from the very first second: the rope swings over the crocodile
lake and the golden acorn in the first seconds, then the trail beyond, all inside Y8's 20 s preview.

## Basic Info (ready to paste)

**Game name**
${fence(NAME)}
**Short description / tagline**
${fence(SHORT)}
**Description** (${DESCRIPTION.length} characters)
${fence(DESCRIPTION)}
**Instructions / Controls**
${fence(HOW_TO_PLAY)}
**Category:** Platformer (alternatives: Adventure, Arcade) · **Tags**
${fence(TAGS.join(', '))}
**Platforms / devices:** desktop and mobile (keyboard, mouse and touch). **Orientation:** landscape and portrait (the
game fills any frame). **Suggested size:** 1280x720. **Languages:** ${LANGUAGES}. **Multiplayer:** no. **Login:** not
required, guests play everything. **In-app purchases:** none.

**AI Declaration:** your call; it cannot be filled in from the repository. For reference, \`CREDITS.md\` lists the CC0
models (Quaternius) and says everything else is original and generated in code (procedural 3D, synthesised audio,
generated levels). If the code was written with an AI coding assistant, declare that as the form asks.

## Ads in this build (Y8 SDK)
- The SDK loads only from Y8's CDN (\`<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async>\` in \`<head>\`),
  never bundled. Initialized exactly like the portal snippet: a \`y8sdk.ready\` listener (once) runs \`y8Sdk = y8.sdk()\`,
  \`y8Sdk.init({ appId, autoLogin: true }, { gameId, preloadAdBreaks: 'on', sound: 'on', onReady })\` and \`onAuth\`, then
  \`window.y8.emitReadyEvent()\` covers an SDK that loaded first. No ad call before init; guests always play.
- Interstitials: \`showAd({ type: 'start' })\` on the first Play click, \`showAd({ type: 'next' })\` on Next / Retry / Menu
  of a result screen, never automatically or during a level, no cap of the game's own (the SDK paces them). The game
  pauses and mutes in \`beforeAd\` and resumes in \`afterAd\`; \`adBreakDone\`, \`.catch()\` and a timeout settle each
  request exactly once (a skipped break goes on at once; 120 s at most).
- Rewarded (\`type: 'reward'\`): only from the labelled buttons that say the reward first ("Watch an ad: continue with
  1 heart", "… +2 seeds", "… double gems"); \`beforeReward\` calls \`showAdFn()\`, the reward only in \`adViewed\`;
  \`adDismissed\` = nothing; no ad = "No ad available right now, try later" and the game goes on. Nothing essential is
  behind an ad; with an ad blocker the game is fully playable and the rewarded buttons are hidden.
- The game pauses and mutes while the tab is hidden (\`visibilitychange\`) and resumes when it is shown again. When
  the window loses focus (\`blur\`, the player clicked outside the game) the sound goes off and comes back on
  \`focus\` or any input in the game; the gameplay is never frozen by a blur. Y8 shows its ads on the parent page, so
  the game loses focus during every ad: a blur during an ad or within 1 s after it is ignored, and the end of an ad
  clears it, so the level runs on after the start ad without a click (v1.2.1).
- No external links, no other ad networks. Saves stay in localStorage (\`sprout-trail-save\`).
${robust}
`,
);
console.log('READMEs written');
