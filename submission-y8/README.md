# Sprout Trail — Y8 submission

- **App ID:** `6af5b5e97eafcdc5d5ddce9c` · **Game ID:** `292717` (in the build)
- **Hosting:** direct upload. It is a single-player game, so per docs.y8.com/studio/iframe-game-hosting it is uploaded
  to Y8, not iframe-hosted.

## Files to upload

| Portal tab → slot | File (in this folder) | Spec |
| --- | --- | --- |
| **Builds** → upload build | `sprout-trail-y8-v2.zip` | `index.html` + `assets/`, `models/` at the zip root, relative paths only |
| **Media** → Standard Screenshot (4:3) | `media/screenshot-760x570-1.jpg` … `-4.jpg` | 760x570 JPG, < 2 MB |
| **Media** → Widescreen Screenshot (16:9) | `media/screenshot-1280x720-1.jpg` … `-4.jpg` | 1280x720 JPG, < 5 MB |
| **Media** → Landscape Promo | `media/promo-landscape-1920x1080.jpg` | 1920x1080 JPG, < 5 MB |
| **Media** → Portrait Promo | `media/promo-portrait-1080x1920.jpg` | 1080x1920 JPG, < 5 MB |
| **Media** → Game Card Promo | `media/promo-card-760x570.jpg` | 760x570 JPG, < 2 MB |
| **Media** → Gameplay video (16:9) | `media/gameplay-1280x720.mp4` | H.264 MP4 1280x720, 25 s, no sound, < 50 MB |

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
```
Sprout Trail
```
**Short description / tagline**
```
A cozy forest platformer for one finger: run, jump and duck, then grow the right plant to cross every river, wall and thorn field.
```
**Description** (466 characters)
```
Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck. Swing on ropes over a crocodile lake, bounce on giant mushrooms, outrun a wild boar and glide on dandelion seeds. At rivers, walls and thorn fields you pick a seed: bridge, vine ladder, mushroom, big leaf, tall tree or log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail and hats to unlock. 6 languages.
```
**Instructions / Controls**
```
The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher or to glide on dandelions. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. Tap to let go of a rope. At a big obstacle the sprite stops: tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.
```
**Category:** Platformer (alternatives: Adventure, Arcade) · **Tags**
```
platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5
```
**Platforms / devices:** desktop and mobile (keyboard, mouse and touch). **Orientation:** landscape and portrait (the
game fills any frame). **Suggested size:** 1280x720. **Languages:** English (default), French, German, Spanish, Italian, Russian. **Multiplayer:** no. **Login:** not
required, guests play everything. **In-app purchases:** none.

**AI Declaration:** your call; it cannot be filled in from the repository. For reference, `CREDITS.md` lists the CC0
models (Quaternius) and says everything else is original and generated in code (procedural 3D, synthesised audio,
generated levels). If the code was written with an AI coding assistant, declare that as the form asks.

## Ads in this build (Y8 SDK)
- The SDK loads only from Y8's CDN (`<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async>` in `<head>`),
  never bundled. Initialized exactly like the portal snippet: a `y8sdk.ready` listener (once) runs `y8Sdk = y8.sdk()`,
  `y8Sdk.init({ appId, autoLogin: true }, { gameId, preloadAdBreaks: 'on', sound: 'on', onReady })` and `onAuth`, then
  `window.y8.emitReadyEvent()` covers an SDK that loaded first. No ad call before init; guests always play.
- Interstitials: `showAd({ type: 'start' })` on the first Play click, `showAd({ type: 'next' })` on Next / Retry / Menu
  of a result screen, never automatically or during a level, no cap of the game's own (the SDK paces them). The game
  pauses and mutes in `beforeAd` and resumes in `afterAd`; `adBreakDone`, `.catch()` and a timeout settle each
  request exactly once (a skipped break goes on at once; 120 s at most).
- Rewarded (`type: 'reward'`): only from the labelled buttons that say the reward first ("Watch an ad: continue with
  1 heart", "… +2 seeds", "… double gems"); `beforeReward` calls `showAdFn()`, the reward only in `adViewed`;
  `adDismissed` = nothing; no ad = "No ad available right now, try later" and the game goes on. Nothing essential is
  behind an ad; with an ad blocker the game is fully playable and the rewarded buttons are hidden.
- The game pauses and mutes while the tab is hidden (`visibilitychange`) and resumes when it is shown again. When
  the window loses focus (`blur`, the player clicked outside the game) the sound goes off and comes back on
  `focus` or any input in the game; the gameplay is never frozen by a blur. Y8 shows its ads on the parent page, so
  the game loses focus during every ad: a blur during an ad or within 1 s after it is ignored, and the end of an ad
  clears it, so the level runs on after the start ad without a click (v1.2.1).
- No external links, no other ad networks. Saves stay in localStorage (`sprout-trail-save`).
- **Robust (v1.2.1):** a failed download is retried, the game never waits forever (a failed main script shows
  "Couldn't load the game. Check your connection." with Try again), no WebGL shows a clear message, a lost WebGL
  context pauses the game until it is restored, nothing is ever uncaught, every ad (and any pause an SDK starts on its own) gives up after 120 s at most, and
  a finished level frees its GPU memory (docs/robustness.md; zero-errors suite in Chromium, WebKit and Firefox).
