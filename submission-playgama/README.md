# Sprout Trail — Playgama

## Description

Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck under logs and bees. At rivers, walls, cliffs and thorn fields it stops and you pick a seed: a bridge, a vine ladder, a bouncy mushroom, a big leaf, a tall tree or a log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail, golden acorns, gems and hats to unlock. 6 languages.

## Controls

The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. At a big obstacle the sprite stops: look at it and tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.

## Tags

platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5

## Files

| File | What |
|---|---|
| `sprout-trail-playgama-v2.zip` | the Playgama build (`npm run build:playgama` + `node scripts/playgama/zip.mjs`): `index.html` at the zip root, `playgama-bridge.js` (Bridge 2.4.1) + `playgama-bridge-config.json` beside it, `assets/`; relative paths only |
| `cover-800x800.png`, `cover-1080x1920.png`, `cover-1920x1080.png` | the three covers (square, portrait, landscape), from real play (`scripts/submission/covers.ts`) |

## Playgama Bridge

- **Version 2.4.1** (pinned): the official standalone `playgama` build from github.com/Playgama/bridge tag `v2.4.1`,
  vendored in `vendor/playgama-bridge/` (sha256 checked in CI, reproducible with `bash scripts/playgama/build-bridge.sh`).
  It is the first script in `<head>`, loaded normally (not async), shipped inside the zip, so the game loads nothing from outside.
- `bridge.initialize()` before the game shows anything; `game_ready` once the loading screen is gone; language from
  `platform.language` (English fallback, or the language the player picked in Settings); progress through Bridge Storage
  only (key `sprout-trail-save`); `level_started` / `level_completed` / `level_failed` messages.
- Pause and audio state events pause the game and silence it. Interstitials only between levels (Bridge's
  `minimumDelayBetweenInterstitial` 120 s from `playgama-bridge-config.json`), rewarded ads only from the labelled
  buttons and only where `isRewardedSupported`; the reward is granted only on the `rewarded` state.
- CI: `scripts/playgama/check.mjs` (zip layout, pinned Bridge, Playgama's own precheck) and `scripts/playgama/test.mjs`
  (mock platform + stubbed Playgama SDK: interstitial, rewarded completed / cancelled, muted and paused during ads).
