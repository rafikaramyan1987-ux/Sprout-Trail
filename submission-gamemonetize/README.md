# Sprout Trail — GameMonetize submission

- **Game ID:** `tnwpox2a6ymzt6ljyslvspxnstv85tjd` (in the build)
- **Upload:** `sprout-trail-gamemonetize-v3.zip` — `index.html` and `assets/`, `models/` at the zip root, relative paths only
  (Game Management > My games > select the game > drop the file; then "Verify Game" and "REQUEST ACTIVATION").

## Files to upload

| What | File (in this folder) |
| --- | --- |
| Game | `sprout-trail-gamemonetize-v3.zip` |
| Image 512x384 | `sprout-trail-512x384.jpg` |
| Image 512x512 | `sprout-trail-512x512.jpg` |
| Image 512x340 | `sprout-trail-512x340.jpg` |

The images are the key-art scene from real play (the sprite flies off a swing rope towards a golden acorn) without
any text or logo, each under 300 KB.

## Form fields (ready to paste)

**Name**
```
Sprout Trail
```
**Category** (2–3): Arcade, Adventure, Puzzle

**Tags**
```
platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5
```
**Width / Height:** `1280` x `720` (16:9; the game fills any frame size, landscape or portrait)

**Optimized for Mobile Devices:** Yes (one-finger touch controls; landscape and portrait)

**Description** (466 characters, limit 600)
```
Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck. Swing on ropes over a crocodile lake, bounce on giant mushrooms, outrun a wild boar and glide on dandelion seeds. At rivers, walls and thorn fields you pick a seed: bridge, vine ladder, mushroom, big leaf, tall tree or log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail and hats to unlock. 6 languages.
```
**Controls** (202 characters, limit 350)
```
Mouse / touch: tap to jump, hold to jump higher or glide, swipe down to duck, tap to let go of a rope, tap a seed card to plant it. Keyboard: Space, Up or W to jump (hold for higher), Down or S to duck.
```

## Ads in this build (GameMonetize SDK)
- `window.SDK_OPTIONS = { gameId, onEvent }`, then `https://api.gamemonetize.com/sdk.js` inserted once while the game
  boots (`<script id="gamemonetize-sdk">` before the first script, as the SDK README's loader does), never from a click.
  If it fails to load, the game plays on without ads.
- `SDK_GAME_PAUSE`: the game pauses and all audio is muted. `SDK_GAME_START`: the game resumes and audio comes back
  through the player's own sound / music settings. `SDK_READY`: interstitials can be shown.
- `sdk.showBanner()` only at natural breaks after a click: the first Play (pre-roll) and Next / Retry / Menu on the
  result screens, at most one every ~2 minutes, never during a level, never on a timer. Every request settles once
  (`SDK_GAME_START`, an error, or not started within 8 s; 120 s at most).
- **No rewarded ads:** the SDK documents no rewarded API, so this build has no "watch an ad" buttons.
- No external links, no "more games", no other ad networks. Saves stay in localStorage (`sprout-trail-save`).
- **Robust (v1.2.2):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad (and any pause an SDK starts on its own) gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).
  After every ad the game takes the keyboard focus back and runs on at once; if it still cannot run, the pause menu
  opens instead of a frozen screen. After a lost heart (or "continue with 1 heart") every obstacle from the checkpoint
  on is back in its first state; every level is checked for that (docs/death-check-report.md).
