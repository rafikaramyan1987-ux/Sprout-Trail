# Sprout Trail

A cozy 2.5D forest platformer for the browser (desktop and mobile), playable with one finger. A little forest
sprite runs along the trail by itself: tap or swipe up to jump (hold for a higher jump), swipe down to duck. At big
gaps, high walls, rivers and thorn fields it stops and you pick a seed card — a bridge, a vine ladder, a mushroom… —
and only the right plant gets it across.

TypeScript, Vite, Three.js. Build-time platform layer `VITE_PLATFORM = web | crazygames | gd | gamepix | playgama`
(`--mode <platform>`), `base: './'`.

```sh
npm ci
npm run dev              # local dev server
npm run build:web        # ad-free web build → dist-web/
npm test                 # unit tests (physics, decision points, every level solvable)
npm run validate:levels  # level validator → docs/levels-report.md (fails if a level is unsolvable)
npm run test:e2e         # Playwright, desktop + phone (build:web first)
npm run assets           # rebuild public/models/nature.glb from assets-src/
```

Controls: touch / mouse — tap or swipe up = jump (keep the finger down for higher), swipe down = duck. Keyboard —
Space / Up / W = jump (hold for higher), Down / S = duck (KeyboardEvent.code, so QWERTY and AZERTY both work).

The simulation (`src/game/sim.ts`) is deterministic with a fixed 60 Hz timestep; the level bot (`src/game/bot.ts`)
plays every level with it in CI and proves each one can be finished with all three golden acorns and that every
wrong plant really fails.

Status: Phase A preview — the spring meadow world with 3 levels. See `docs/preview/`. Credits: `CREDITS.md`.
