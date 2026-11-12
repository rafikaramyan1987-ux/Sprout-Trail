# Robustness (v1.2.0): the lessons of Cookie Heist v3.3, applied to Sprout Trail

Cookie Heist's crash investigation (its `docs/crash-investigation.md`, v3.3) found that a portal build "crashes" —
in the portal's sense — on every uncaught error and unhandled promise rejection, on a loading screen that never ends,
and on a game that stays paused because an ad never finished. Every one of those paths was checked in Sprout Trail
and is fixed in shared code (every build gets the fixes), and a zero-errors suite proves it in Chromium, WebKit and
Firefox, desktop and phone.

## What was checked, what was found, what changed

| # | Path | Found in v1.1.1 | Fix (v1.2.0) |
| --- | --- | --- | --- |
| 1 | A file downloaded after the main script fails | The nature models (`models/nature.glb`, the only lazily loaded file; the game has no dynamic `import()` chunks) were loaded once: a failed download was an unhandled rejection inside `boot()` and the loading screen stayed forever | `src/app/lazy.ts` `withRetry()`: 3 retries with back-off, each on a new `?retry=n` URL (a failed request can be cached for the page), each attempt limited to 20 s. If every attempt fails, the game plays on with its procedural scenery (`loadModels` never rejects) |
| 2 | The main script fails to download | Nothing runs, no error reaches the page: loading screen forever | `index.html`: a capture-phase watchdog before the game script fetches the scripts again (`cache: 'reload'`, WebKit keeps a failed script in its memory cache) and reloads once; a second failure shows "Couldn't load the game. Check your connection." with **Try again** (6 languages, injected at build time) |
| 3 | No WebGL (blocked, no GPU, too many contexts) | `new Stage()` ran when `main.ts` was imported: an uncaught error, loading screen forever | The renderer is created inside `boot()`: without WebGL the loading screen says "This browser can't show the 3D game. Turn on hardware acceleration or try another browser." with **Try again**; `boot()` never rejects unhandled |
| 4 | WebGL context lost (GPU reset, a phone under memory pressure) | Not handled: the level kept running while nothing could be drawn | `webglcontextlost`: the level pauses and nothing is drawn; `webglcontextrestored`: three.js' stale dispose listeners are dropped (`forgetLostContext`) and the level plays on |
| 5 | GPU memory over many levels | Measured: +90 geometries per level (120 → 1,882 after 21 levels); `stage.setTheme()` also rebuilt the hills, clouds and light rays every level without freeing them | `src/render/dispose.ts`: a finished level's scene is disposed (the session-long caches — models, textures, the mist texture, the waterfall material — are marked `userData.shared` and kept), the old theme's hills / clouds / rays too. Measured: 80–163 geometries per level, flat over 21 levels; textures level off at 25 (the caches), shader programs at ~30 |
| 6 | An ad that starts and never ends | CrazyGames, GameDistribution, GamePix and Playgama cleared their 8 s timeout when the ad started, with no upper bound: the game could stay paused for good | `AD_MAX` (120 s after the request) in every platform adapter; one ad at a time; every request settles exactly once |
| 7 | `AudioContext.resume()` / a closed context | `void ctx.resume()` with no handler (an unhandled rejection on a closed context); a failed music render was a rejection nobody handled | Every `resume()` has a handler and is skipped on a closed context, sound effects never throw, the music render resolves to "no music" on failure |
| 8 | Storage blocked (private mode) or an old save | Storage failures were caught, but a save from an older version (the Phase A save has 7 fields) or with a wrong-typed field was spread into the game as it was | `parseSave()` coerces every field to its type and keeps unknown fields: Phase A and v1.1 saves load with their progress (unit + zero-errors tests) |
| 9 | CrazyGames Data Module disabled (Progress Save off) | Every call throws `dataModuleDisabled` | The Data Module is probed once at init; if it throws, saves go to localStorage; every later call is wrapped |
| 10 | CrazyGames `loadingStart` | Sent before the SDK was up, so it was dropped: CrazyGames never saw the start of loading | Remembered and sent right after the SDK init; `gameplayStart` is held until `loadingStop` |
| 11 | CrazyGames rewarded ad without the SDK (ad blocker) | Granted the reward for free | No SDK = no reward; the rewarded buttons are hidden wherever the portal's SDK is not up |
| 12 | An exception in one frame | The frame loop stopped for good (the next frame was scheduled after `tick()`) | The next frame is scheduled first; a failing frame is recorded (`src/app/guard.ts`, `window.__errors`) and the game keeps running |

Portal-specific checks from the same review: GamePix keeps the legacy `GamePix.soundOn / soundOff / pause / resume`
assignments **and** `events.on(...)` (CI greps the bundle for all of them); Playgama now loads the official Bridge from
Playgama's CDN, calls `bridge.initialize()` before the game starts, sends `game_ready` before any gameplay message
and ships `playgama-bridge-config.json` as `{}`.

## Proof

- **Zero-errors suite** (`tests/e2e-crash`, `playwright.crash.config.ts`, CI job `crash`): 19 scenarios × 6 projects
  (Chromium, WebKit, Firefox × desktop, phone) on the CrazyGames build with a stand-in SDK that reports errors the
  way the real one does. Each scenario fails on any uncaught error, unhandled rejection, console error, failed
  request nobody injected, the game's own error record, a loading screen that does not reach `loadingStop`, or a
  `gameplayStart` before it. Scenarios: first load, several levels in a row (with GPU memory bounded), every ad outcome
  for interstitials and rewarded ads (ok, error, blocked, no fill, started and never ended), tab hidden and shown,
  resize and rotate, a failed models download (retried), models that never download, the game script failing once
  and always, private mode, Progress Save off, Phase A and v1.1 saves, no WebGL, WebGL context loss and restore.
- **Portal smoke tests** (`tests/e2e-portals`, CI job `portals`): the GameMonetize, Y8 and GameDistribution builds
  with stubbed SDKs (init order, ad breaks, pause / mute, every ad settles, rewards, ad blockers).
- **Unit tests** (`tests/unit/platforms.test.ts`, `gamemonetize.test.ts`, `y8.test.ts`): `AD_MAX` in every adapter,
  the real GameDistribution ID, the CrazyGames fixes, Playgama's message order.
