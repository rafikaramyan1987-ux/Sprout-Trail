# Sprout Trail — CrazyGames submission (for later)

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game (folder upload: unzip and upload the folder, or the zip) | `sprout-trail-crazygames-v1.2.0.zip` — `index.html` at the root, relative paths only |
| Cover 16:9 | `covers/cover-1920x1080.png` |
| Cover 2:3 | `covers/cover-800x1200.png` |
| Cover 1:1 | `covers/cover-800x800.png` |
| Landscape trailer | `videos/trailer-1920x1080.mp4` (18 s, real play, no sound) |
| Portrait trailer | `videos/trailer-1080x1620.mp4` (18 s, real play, no sound) |

Covers: the key-art scene from real play (Golden Grove of the Spring Meadow: the sprite flies off a swing rope
towards a golden acorn), HUD hidden, the logo at the bottom; the top-left corner is clear. Trailers: the key art,
then real play at normal speed — rope swings over the crocodile lake, giant bouncy mushrooms, the boar chase, the
path behind the waterfall, the moonlit swamp — and the key art again (`scripts/submission/media.ts`).

## SDK in this build
- CrazyGames SDK v3: loadingStart / loadingStop around the boot (loadingStart is sent as soon as the SDK is up),
  gameplayStart / gameplayStop only around real play and never before loadingStop, happytime on a finished level.
- Midgame ads only at the result-screen breaks (Next / Retry), at most one per 2 minutes, none in the first 2 minutes;
  rewarded ads only from the labelled buttons ("Watch an ad: +2 seeds", "… continue with 1 heart", "… double gems"),
  granted only on adFinished; no ad = "No ad available right now, try later". With an ad blocker the buttons are hidden.
- Saves in the Data Module (if Progress Save is off, localStorage); the platform mute setting is followed live.
- **Robust (v1.2.0):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).

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
