# Sprout Trail — open web portals (itch.io, Newgrounds, ...)

The ad-free web build (`npm run build:web` + `node scripts/web/zip.mjs`): no portal SDK, no ads, no external requests.

| File | What |
|---|---|
| `sprout-trail-web-v3.zip` | `index.html` at the zip root, relative paths only; checked in CI by `scripts/web/check.mjs` (served in an iframe at 640x480, 960x600, 1280x720 and 390x844: no scrollbars, canvas centred, level 1-1 played, no external request, only its own localStorage key) |
| `cover-630x500.png` | cover (from the main cover art) |
| `icon-512x512.png` | icon |
| `screenshot-1.png` … `screenshot-4.png` | 1280x720 shots of real play: title, bees in the Deep Forest, the seed cards at a wide river, a rolling acorn in the Autumn Woods |

## Description

Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck under logs and bees. At rivers, walls, cliffs and thorn fields it stops and you pick a seed: a bridge, a vine ladder, a bouncy mushroom, a big leaf, a tall tree or a log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail, golden acorns, gems and hats to unlock. 6 languages.

## How to play

The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. At a big obstacle the sprite stops: look at it and tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.

## Tags

platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5
