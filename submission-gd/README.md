# Sprout Trail — GameDistribution submission

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game (HTML5 zip) | `sprout-trail-gd-v1.2.1.zip` — `index.html` at the root, assets in `assets/` and `models/`, relative paths only |
| Thumbnail 512x384 | `thumbnails/thumb-512x384.jpg` |
| Thumbnail 512x512 | `thumbnails/thumb-512x512.jpg` |
| Thumbnail 200x120 | `thumbnails/thumb-200x120.jpg` |
| Thumbnail 1280x720 | `thumbnails/thumb-1280x720.jpg` |
| Thumbnail 1280x550 | `thumbnails/thumb-1280x550.jpg` |

- **Game ID:** `cc966171a12a4fa68ea6b94b0bf1f757` (in the build: `GD_OPTIONS.gameId`; `scripts/check-gd.mjs` checks it in CI).
- **SDK:** `GD_OPTIONS` + `main.min.js` loaded once at boot. The **pre-roll only from the first Play click** (title Play,
  a level tile or the daily trail); `SDK_GAME_PAUSE` pauses the game and mutes all audio, `SDK_GAME_START` resumes
  it and restores audio through the player's settings. Interstitials only at the result-screen breaks (Next / Retry /
  Menu), at most one per 2 minutes, never during a level. Rewarded ads only from the labelled buttons, the reward only
  after `SDK_REWARDED_WATCH_COMPLETE`. Every ad settles (not started in 8 s, or 120 s at most).
- **Robust (v1.2.1):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad (and any pause an SDK starts on its own) gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).

## Ready-to-paste fields

**Name**
```
Sprout Trail
```
**Category:** Platformer (or Casual) · **Orientation:** landscape and portrait · **Devices:** desktop and mobile
(touch, mouse, keyboard) · **Size:** responsive (any frame; 16:9 suggested, e.g. 1280x720)

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
