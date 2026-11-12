# Sprout Trail — GameDistribution submission

- **Build:** `sprout-trail-gd-v1.1.1.zip` (`npm run build:gd`): `index.html` at the root of the zip, assets in
  `assets/`, relative paths only. GameDistribution HTML5 SDK (`GD_OPTIONS` + main.min.js loaded at boot):
  SDK_GAME_PAUSE / SDK_GAME_START pause and resume the game and its audio, interstitials only between levels (at most
  one per 2 minutes), rewarded ads only from the labelled buttons, reward only after SDK_REWARDED_WATCH_COMPLETE.
- **Game ID:** `00000000000000000000000000000000` — **a placeholder.** Register the game on GameDistribution, put the real 32-character ID in
  `GD_GAME_ID` (`src/app/platform/gd.ts`), then `npm run build:gd && npm run submission`. CI
  (`scripts/check-gd.mjs`) checks the build carries the ID and flags the placeholder.
- **Older versions:** none.
- **Thumbnails (JPG):** `thumbnails/thumb-512x384.jpg`, `thumb-512x512.jpg`, `thumb-200x120.jpg`,
  `thumb-1280x720.jpg`, `thumb-1280x550.jpg`.
- **Orientation:** landscape and portrait, desktop and mobile. **Category:** Platformer / Casual.

## Name
Sprout Trail

## Short description
A cozy forest platformer for one finger: run, jump and duck, then grow the right plant to cross every river, wall and thorn field.

## Description (433 characters)
Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck under logs and bees. At rivers, walls, cliffs and thorn fields it stops and you pick a seed: a bridge, a vine ladder, a bouncy mushroom, a big leaf, a tall tree or a log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail, golden acorns, gems and hats to unlock. 6 languages.

## How to play (405 characters)
The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. At a big obstacle the sprite stops: look at it and tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.

## Tags
platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5
