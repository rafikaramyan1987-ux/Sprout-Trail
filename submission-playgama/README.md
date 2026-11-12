# Sprout Trail — Playgama submission

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game | `sprout-trail-playgama-v5.zip` — `index.html` at the zip root, `playgama-bridge-config.json` beside it, `assets/`, `models/` |
| Cover 1:1 | `cover-800x800.png` |
| Cover 9:16 | `cover-1080x1920.png` |
| Cover 16:9 | `cover-1920x1080.png` |

## Ready-to-paste fields

**Name:** Sprout Trail · **Category:** Platformer (alternatives: Arcade, Casual) · **Languages:** English (default), French, German, Spanish, Italian, Russian

**Description** (466 characters)
```
Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck. Swing on ropes over a crocodile lake, bounce on giant mushrooms, outrun a wild boar and glide on dandelion seeds. At rivers, walls and thorn fields you pick a seed: bridge, vine ladder, mushroom, big leaf, tall tree or log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail and hats to unlock. 6 languages.
```

**How to play** (441 characters)
```
The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher or to glide on dandelions. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. Tap to let go of a rope. At a big obstacle the sprite stops: tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.
```

**Tags**
```
platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5
```

## Playgama Bridge in this build
- The official Bridge from Playgama's CDN (`https://bridge.playgama.com/v2/stable/playgama-bridge.js`), the first script
  in `<head>`, loaded normally; right after it `bridge.initialize()`, and the game starts only once that has settled
  (a failure is logged and the game plays without the SDK). `playgama-bridge-config.json` is `{}` (Bridge's defaults).
- `game_ready` is the first message, sent once the loading screen is gone; `level_started` / `level_completed` /
  `level_failed` only after it. Language from `platform.language`; progress only through Bridge Storage (no
  localStorage anywhere in the build).
- Pause and audio state events pause the game and silence it. Interstitials at the result-screen breaks after the
  first finished level (Bridge paces them), no pre-roll; rewarded ads only from the labelled buttons and only where
  `isRewardedSupported`; the reward only on the `rewarded` state. Every ad settles (8 s, or 120 s at most).
- **Robust (v1.2.1):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad (and any pause an SDK starts on its own) gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).
- CI: `scripts/playgama/check.mjs` (zip layout, CDN Bridge, Playgama's own precheck: no FAIL, no WARN) and
  `scripts/playgama/test.mjs` (mock platform + stubbed Playgama SDK: interstitial, rewarded completed / cancelled).
