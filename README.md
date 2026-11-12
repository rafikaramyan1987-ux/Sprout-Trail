# Sprout Trail

A cozy 2.5D forest platformer for the browser (desktop and mobile), playable with one finger. A little forest
sprite runs along the trail by itself: tap or swipe up to jump (keep the finger down for a higher jump), swipe down to
duck. At rivers, walls, cliffs and thorn fields it stops and you pick a seed card — bridge, vine ladder, mushroom, big
leaf, tall tree or log — and only the right plant gets it across. From world 2 some plants work but miss the golden
acorn, and seeds are limited.

- 5 worlds (Spring Meadow, Deep Forest, Mushroom Valley, Autumn Woods, Misty Swamp) × 12 levels + a Golden Grove
  special level per world, and a daily trail with a streak (30-level pool).
- Hazards are introduced one world at a time and get denser and tighter: beetles, thorns, low logs, bees, snails,
  rolling acorns. The run speed rises a little at every checkpoint and from world to world, capped at 1.5x level 1;
  decision points are always a full stop.
- Every level looks and plays differently: 20 scenery variants (4 per world: backdrop, props, time of day, weather)
  that change within each level and never repeat on consecutive levels, a translated title card per level, and
  11 set pieces — hanging planks, rope swings over a crocodile lake, floating logs, lily pads and stepping stones,
  mushroom bounce chains, autumn wind gusts, a collapsing bridge, a boar chase, a dark cave, a hidden waterfall path
  and a dandelion glide — each introduced with a sign, then remixed. Screenshots: `docs/phase-c/`.
- Wardrobe: hats and sprite colours bought with gems. 6 languages (en, fr, de, es, it, ru).
- Platform layer chosen at build time: `VITE_PLATFORM = web | crazygames | gd | gamepix | playgama | gamemonetize | y8`
  (`--mode <platform>`), `base: './'`. Rewarded ads only from labelled buttons, interstitials only between levels
  (at most one per 2 minutes); no ads at all in the web build.

TypeScript, Vite, Three.js. Each build is about 2.5 MB (CI budget: 4 MB). The version is shown small on the title screen.

```sh
npm ci
npm run dev                 # local dev server
npm run build:all           # dist/ (CrazyGames), dist-web/, dist-gd/, dist-gamepix/, dist-playgama/,
                            # dist-gamemonetize/, dist-y8/
npm test                    # unit tests
npm run validate:levels     # level validator (human-limited playtester) → docs/levels-report.md
npm run playtest            # human-limited playtest of every level + death probes → playtest-out/
npm run playtest:browser    # every level in the web build, desktop keyboard + phone touch (build:web first)
npm run test:e2e            # Playwright, desktop + phone (build:web first)
npm run test:e2e:crash      # zero-errors suite, Chromium/WebKit/Firefox, desktop + phone (build first)
npm run test:e2e:portals    # GameMonetize, Y8, GameDistribution builds with stubbed SDKs
npm run media               # store art, Y8 screenshots + video, CrazyGames trailers (serve dist-web first)
npm run submission          # portal zips + READMEs (after build:all); npm run submission:check
```

Controls: touch / mouse — tap or swipe up = jump (hold for higher), swipe down = duck. Keyboard — Space / Up / W =
jump (hold for higher), Down / S = duck (`KeyboardEvent.code`, so QWERTY and AZERTY both work). Escape is never used.

The simulation (`src/game/sim.ts`) is deterministic with a fixed 60 Hz timestep. In CI a human-limited playtester
(`src/game/human.ts`) plays every shipped level with it at the level's real speed, using only a finger's inputs (tap,
full jump, glide, swipe down, seed cards) with human limits: every press must still work 0.1 s early or late and with
a shorter or longer hold, presses are at least 0.25 s apart, nothing hidden is read. Each level must be beaten with
all three golden acorns, without losing a heart, within its seeds; every wrong plant must really fail; every hazard
must be on screen at least 1 second before it has to be dodged (`src/game/fairness.ts`; the camera always shows
`viewAhead(speed)` ahead, `src/play/camera.ts`). Every death (a fall or the crocodile) costs exactly one heart. The
browser playtest then plays every level once more in the real web build (desktop keyboard and phone touch) and checks
the HUD, the camera, the end screens and the input path. Results: `docs/playtest-report.md` (before / after the fixes
of v1.1.1). The beam-search bot (`src/game/bot.ts`) still drives the autoplay demo and the preview video.

Submission folders: `submission/` (CrazyGames), `submission-gd/`, `submission-gamepix/`, `submission-playgama/`,
`submission-gamemonetize/`, `submission-y8/`, `submission-web/` — each with a README. Credits: `CREDITS.md`. Robustness (crash-proofing, zero-errors suite): `docs/robustness.md`.
