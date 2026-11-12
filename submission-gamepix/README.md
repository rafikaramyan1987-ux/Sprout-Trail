# Sprout Trail — GamePix submission

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game | `sprout-trail-gamepix-v1.2.1.zip` — `index.html` at the root, relative paths only |
| Icon 256x256 | `icon-256x256.jpg` |
| Cover 1360x850 | `cover-1360x850.jpg` |

- `window.GamePixConfig = { lifecycle: 'manual' }` and the GamePix SDK v3 script come first in `<head>`, before the
  game. Lifecycle: loading(0-100) during boot, `loaded()` before the menu, `gameStart()` at the first level. The SDK's
  `events.on('pause' | 'resume' | 'soundOff' | 'soundOn')` **and** the legacy `GamePix.pause / resume / soundOff /
  soundOn` assignments pause the game and silence it. Interstitials only at the result-screen breaks (at most one per
  2 minutes), rewarded ads only from the labelled buttons, the reward only when `ads.reward()` resolves with
  `success: true`. Language from `GamePix.lang()`.
- **Robust (v1.2.1):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad (and any pause an SDK starts on its own) gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).

## Name
```
Sprout Trail
```
## Category
Platformer

## Short description
```
A cozy forest platformer for one finger: run, jump and duck, then grow the right plant to cross every river, wall and thorn field.
```

## Description (466 characters)
```
Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck. Swing on ropes over a crocodile lake, bounce on giant mushrooms, outrun a wild boar and glide on dandelion seeds. At rivers, walls and thorn fields you pick a seed: bridge, vine ladder, mushroom, big leaf, tall tree or log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail and hats to unlock. 6 languages.
```

## How to play (441 characters)
```
The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher or to glide on dandelions. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. Tap to let go of a rope. At a big obstacle the sprite stops: tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.
```

## Tags
```
platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5
```

## Languages
English (default), French, German, Spanish, Italian, Russian
