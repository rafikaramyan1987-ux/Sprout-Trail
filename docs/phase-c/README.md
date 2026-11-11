# Phase C screenshots

Captured from the web build with `npx tsx scripts/phase-c-shots.ts` (Playwright, real game, game clock frozen at the
shown moment). Phone = 390×844 portrait, desktop = 1280×720.

| File | Level | What it shows |
| --- | --- | --- |
| `phone-1-3-title-card.png` | 1-3 | translated title card (level name + place name) |
| `phone-1-3-rope-swings.png` | 1-3 | rope swings over the crocodile lake |
| `phone-1-7-boar-chase.png` | 1-7 | boar chase (camera widens behind the sprite) |
| `phone-2-1-dark-cave.png` | 2-1 | dark cave: light circle around the sprite, glowing gems and hazards |
| `desktop-1-1-hanging-planks.png` | 1-1 | hanging planks (meadow variant) |
| `desktop-1-2-bounce-mushrooms-rain.png` | 1-2 | bounce mushrooms in the rain variant |
| `desktop-1-4-floating-logs.png` | 1-4 | floating logs over the lake |
| `desktop-1-5-collapsing-bridge.png` | 1-5 | collapsing bridge at sunset (speed boost) |
| `desktop-1-6-dandelion-glide.png` | 1-6 | dandelion glide (hold to float) |
| `desktop-2-2-waterfall.png` | 2-2 | waterfall cliffs and the hidden path behind the curtain |
| `desktop-4-1-wind.png` | 4-1 | autumn wind gusts, leaves show the direction |
| `desktop-5-1-lily-pads-moonlit.png` | 5-1 | lily pads and stepping stones, moonlit swamp |

Scenery variants (4 per world, `src/render/variants.ts`): meadow, sunset, rain, lake · pines, roots, glow, falls ·
caps, canyon, pastel, grotto · golden, ridge, dusk, drizzle · marsh, lagoon, moon, mangrove.
The set piece and scenery of every level are listed in `docs/levels-report.md`.
