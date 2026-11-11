# Sprout Trail — GamePix submission

- **Build:** `sprout-trail-gamepix-v1.1.0.zip` (`npm run build:gamepix`): `index.html` at the root, relative paths
  only. `window.GamePixConfig = { lifecycle: 'manual' }` and the GamePix SDK v3 script come first in `<head>`, before
  the game. Lifecycle: loading(0-100) during boot, `loaded()` before the menu, `gameStart()` at the first level. The
  SDK's `pause`/`resume` and `soundOff`/`soundOn` events (and the legacy `GamePix.pause/resume/soundOff/soundOn`
  handlers) pause the game and silence it. Interstitials only between levels (at most one per 2 minutes), rewarded
  ads only from the labelled buttons, reward only when `ads.reward()` resolves with `success: true`. Language from
  `GamePix.lang()`.
- **Older versions:** `sprout-trail-gamepix-v1.0.0.zip`.
- **Icon / cover:** `icon-256x256.jpg`, `cover-1360x850.jpg` (from real play).

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

## Category
Platformer
