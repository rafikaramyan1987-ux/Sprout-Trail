# Playtest report

A "player-real" playtester played every shipped level — 5 worlds × 12 levels, the 5 Golden Groves and the whole daily
pool (30): 95 levels — with only what a human has, and every level was played again in the real browser build.

**How the human-limited playtester plays** (src/game/human.ts, scripts/playtest.ts)

- Only a finger's inputs: tap (finger down 0.1 s), full jump (0.45 s), glide (finger down until landing),
  swipe down, and picking a seed card at a decision point. Nothing reads hidden state; the plan only depends on the
  level as it is drawn, and everything to dodge must be on screen at least 1 s before it has to be dodged.
- Timing tolerance ±0.1 s on every input: each press is also played 0.05 s and 0.1 s early and late, and taps and
  holds with the finger lifted 0.1 s earlier and later. A press is only used when every one of those still survives
  (no heart lost, no fall, no crocodile); a golden acorn only counts when every variant collects it.
- Reaction time: at least 0.25 s between two presses, 0.2 s after the finger was lifted, and 0.25 s after anything the
  player has to react to (a hit, a respawn, the end of a crossing). No frame-perfect tricks.
- It plays the real deterministic simulation (src/game/sim.ts) at each level's real speed (capped at 1.5x level 1).
- Death probes: about 1 s before every pit and crocodile lake of the human run, the finger is lifted and the sprite
  runs in by itself; the report records what that death costs.

**The browser playtest** (scripts/playtest-browser.ts) plays every level once in the web build (dist-web) on a desktop
viewport (1280×720, keyboard) and a phone viewport (390×844, touch), replaying the human run through the game's real
input path (key presses / touch gestures, clicks and taps on the seed cards). It checks that the level is won and the
end screen appears, that the hearts and acorns in the HUD always match the game, that the real camera keeps the
sprite on screen and shows at least viewAhead(speed) of the trail ahead, that every pit, thorn patch, log, stump, lake,
wind stretch and collapsing bridge is on screen at least 1 s before the sprite reaches it, what a fall costs in the HUD,
what lifting the finger after the finish does, and that there are no page errors. A screenshot of each level's main
set piece was taken on both devices and the contact sheets were looked through for visual breakage (none found:
every set piece, scenery variant, the dark caves and the waterfalls render as intended on both screens).

## Before the fixes (v1.1.0)

- Human-limited playtest (simulation): **0/95 levels without a problem**; 85/95 can be finished, 80/95 with all 3 golden acorns.
- Death probes: 575 deaths at pits and lakes, 100 of them cost a heart.
- Real browser build: 0/190 runs (desktop keyboard + phone touch) without a problem.
- **8 causes, 263 level problems** (a cause in a level counts once) in 95 levels; 1064 individual findings (every probed death, every device).

### Problems found, grouped by cause

### Dying costs no heart (bug A) — 95 levels (663 findings)

Levels: 1-1, 1-2, 1-3, 1-4, 1-5, 1-6, 1-7, 1-8, 1-9, 1-10, 1-11, 1-12, 2-1, 2-2, 2-3, 2-4, 2-5, 2-6, 2-7, 2-8, 2-9, 2-10, 2-11, 2-12, 3-1, 3-2, 3-3, 3-4, 3-5, 3-6, 3-7, 3-8, 3-9, 3-10, 3-11, 3-12, 4-1, 4-2, 4-3, 4-4, 4-5, 4-6, 4-7, 4-8, 4-9, 4-10, 4-11, 4-12, 5-1, 5-2, 5-3, 5-4, 5-5, 5-6, 5-7, 5-8, 5-9, 5-10, 5-11, 5-12, 1-S, 2-S, 3-S, 4-S, 5-S, daily-0, daily-1, daily-2, daily-3, daily-4, daily-5, daily-6, daily-7, daily-8, daily-9, daily-10, daily-11, daily-12, daily-13, daily-14, daily-15, daily-16, daily-17, daily-18, daily-19, daily-20, daily-21, daily-22, daily-23, daily-24, daily-25, daily-26, daily-27, daily-28, daily-29

- 1-1 (sim): falling at x 250.0 (pit 2.4 wide) costs 0 hearts (3 → 3)
- 1-2 (sim): falling at x 182.2 (bouncy mushrooms) costs 0 hearts (3 → 3)
- 1-3 (sim): falling at x 313.7 (pit 2.6 wide) costs 0 hearts (3 → 3)
- 1-4 (sim): falling at x 310.7 (pit 2.2 wide) costs 0 hearts (3 → 3)
- 1-5 (sim): falling at x 219.7 (bouncy mushrooms) costs 0 hearts (3 → 3)
- 1-6 (sim): falling at x 341.2 (pit 2.3 wide) costs 0 hearts (3 → 3)
- … and 657 more of the same kind

**Fix:** Every death (pit, gap, plank, rope, log, lily pad, mushroom, glide, bridge, chase, crocodile) now goes through one `die(s, reason)` in src/game/sim.ts: exactly one heart, back to the last checkpoint, the last heart loses the level; a heart lost to a hit that knocked the sprite into the pit already counts. Heart HUD flashes, an "ouch" sound, a puff where the sprite comes back.

### Camera shows too little of the trail ahead (after decision points, during rope flights) — 94 levels (222 findings)

Levels: 1-2, 1-3, 1-4, 1-5, 1-6, 1-7, 1-8, 1-9, 1-10, 1-11, 1-12, 2-1, 2-2, 2-3, 2-4, 2-5, 2-6, 2-7, 2-8, 2-9, 2-10, 2-11, 2-12, 3-1, 3-2, 3-3, 3-4, 3-5, 3-6, 3-7, 3-8, 3-9, 3-10, 3-11, 3-12, 4-1, 4-2, 4-3, 4-4, 4-5, 4-6, 4-7, 4-8, 4-9, 4-10, 4-11, 4-12, 5-1, 5-2, 5-3, 5-4, 5-5, 5-6, 5-7, 5-8, 5-9, 5-10, 5-11, 5-12, 1-S, 2-S, 3-S, 4-S, 5-S, daily-0, daily-1, daily-2, daily-3, daily-4, daily-5, daily-6, daily-7, daily-8, daily-9, daily-10, daily-11, daily-12, daily-13, daily-14, daily-15, daily-16, daily-17, daily-18, daily-19, daily-20, daily-21, daily-22, daily-23, daily-24, daily-25, daily-26, daily-27, daily-28, daily-29

- 1-3 (desktop): camera shows less than viewAhead for 12 ticks (worst 43%) at x 91.5 (89%), x 133.3 (98%, rope, air vx 8.6), x 246.2 (43%)
- 1-4 (desktop): camera shows less than viewAhead for 9 ticks (worst 43%) at x 129.3 (43%), x 245.5 (84%)
- 1-6 (desktop): camera shows less than viewAhead for 9 ticks (worst 43%) at x 138.6 (43%), x 247.9 (83%)
- 1-2 (desktop): camera shows less than viewAhead for 4 ticks (worst 66%) at x 84.6 (66%)
- 1-7 (desktop): camera shows less than viewAhead for 16 ticks (worst 64%) at x 103.6 (64%), x 254.7 (83%), x 288.2 (91%, rope, air vx 9.3)
- 1-8 (desktop): camera shows less than viewAhead for 9 ticks (worst 64%) at x 92.0 (64%), x 213.5 (82%)
- … and 216 more of the same kind

**Fix:** The decision-point shot now already shows viewAhead past the exit, and while running the camera is never allowed to show less than viewAhead(speed) ahead of the sprite (src/play/camera.ts), whatever the smoothing does.

### Touch jumps start 70 ms (4 frames) after the finger touches: human-timed runs fail on phones — 48 levels (113 findings)

Levels: 1-1, 1-7, 2-3, 2-4, 2-6, 2-8, 2-9, 2-12, 3-2, 3-4, 3-9, 3-10, 3-12, 4-1, 4-2, 4-3, 4-4, 4-8, 4-10, 4-12, 5-3, 5-6, 5-8, 5-11, 1-S, 2-S, 3-S, 5-S, daily-1, daily-2, daily-3, daily-4, daily-5, daily-6, daily-7, daily-8, daily-12, daily-13, daily-16, daily-17, daily-18, daily-19, daily-23, daily-24, daily-26, daily-27, daily-28, daily-29

- 1-1 (phone): the browser run left the planned run before press 99 (x 169.30, planned 169.46)
- 1-7 (phone): sprite off screen for 13 ticks
- 2-4 (phone): the browser run ended differently from the simulated run (not won vs won, 3 acorns)
- 2-3 (phone): sprite off screen for 154 ticks
- 2-6 (phone): sprite off screen for 15 ticks
- 2-8 (phone): the browser run left the planned run before press 106 (x 213.14, planned 221.84)
- … and 107 more of the same kind

**Fix:** A touch now jumps at once (src/app/input.ts); a swipe down that follows turns it into a duck (no jump at all while still on the ground, a dive into the duck once in the air). The browser playtest runs the game at the pace of a real phone (60 frames a second) right after every touch, so a touch that only became a jump after some milliseconds shows up as the frames a player would see.

### Bouncy mushroom chain cannot be crossed (bug B) — 10 levels (49 findings)

Levels: 1-2, 1-5, 1-10, 3-11, 4-9, 5-12, daily-9, daily-11, daily-15, daily-25

- 1-2 (sim): cannot be finished by a human: stuck at x 195.7 (bouncy mushrooms): tap: fell; fell; hold: fell
- 1-5 (sim): cannot be finished by a human: stuck at x 239.2 (bouncy mushrooms): tap: fell; fell; hold: fell
- 1-10 (sim): cannot be finished by a human: stuck at x 155.0 (bouncy mushrooms): tap: fell; fell; hold: fell
- 3-11 (sim): cannot be finished by a human: stuck at x 530.5 (bouncy mushrooms): fell; tap: fell; hold: fell
- 4-9 (sim): cannot be finished by a human: stuck at x 453.3 (bouncy mushrooms): fell; tap: fell; hold: fell
- 5-12 (sim): cannot be finished by a human: stuck at x 392.6 (bouncy mushrooms): fell; tap: fell; hold: fell
- … and 43 more of the same kind

**Fix:** Confirmed: the bounce flew `s.speed` (4.6-5 early on) for about 1 s, but the caps were 6.2 apart and the first cap 1.4 past the edge. Now every bounce is aimed from the real flight (fixed-step flight time from the bounce speed and the landing height) at the middle of the next cap, then at the far ground; the first cap starts at the edge, so the sprite runs onto it. Crossable with no input at every speed; keeping the finger down on landing bounces a little higher to the same spot (never needed).

### Lifting the finger after the finish presses an end-screen button — 10 levels (10 findings)

Levels: 1-6, 1-7, 3-3, 4-6, 4-8, 5-6, daily-2, daily-26, daily-27, daily-29

- 1-6 (phone): lifting the finger after the finish pressed a button on the end screen (end → play)
- 1-7 (phone): lifting the finger after the finish pressed a button on the end screen (end → title)
- 3-3 (phone): lifting the finger after the finish pressed a button on the end screen (end → play)
- 4-6 (phone): lifting the finger after the finish pressed a button on the end screen (end → play)
- 4-8 (phone): lifting the finger after the finish pressed a button on the end screen (end → title)
- 5-6 (phone): lifting the finger after the finish pressed a button on the end screen (end → title)
- … and 4 more of the same kind

**Fix:** Buttons (end screens, seed cards, pause, ad buttons) only react to a press that started on them (`onPress` in src/ui/ui.ts), so a finger that was already down in the game cannot press them by being lifted.

### Golden acorn over hanging planks needs lucky timing — 4 levels (4 findings)

Levels: 1-8, 2-3, 3-4, daily-10

- 1-8 (sim): 1 golden acorn(s) only with lucky timing (missed when pressed 0.1 s early or late) at x 131.6 (hanging planks)
- 2-3 (sim): 1 golden acorn(s) only with lucky timing (missed when pressed 0.1 s early or late) at x 135.9 (hanging planks)
- 3-4 (sim): 1 golden acorn(s) only with lucky timing (missed when pressed 0.1 s early or late) at x 254.5 (hanging planks)
- daily-10 (sim): 1 golden acorn(s) only with lucky timing (missed when pressed 0.1 s early or late) at x 120.8 (hanging planks)

**Fix:** The acorn hung 3.2 above a plank: a jump high enough to reach it carries the sprite past the next plank. It now hangs in the hop between two planks (1.8 above the higher one), where every human-timed hop passes.

### Golden acorn on a sinking lily pad needs lucky timing — 1 level (2 findings)

Levels: 5-3

- 5-3 (sim): acorn at x 185.8 (lily pads / stones), 0.4 high cannot be collected with human timing
- 5-3 (desktop): only 2 golden acorns in the browser

**Fix:** The acorn sat on a sinking pad and was only collected when landing within a hand's width of its middle. It now hangs in the hop to the next pad.

### The only human-safe route takes damage — 1 level (1 finding)

Levels: 4-10

- 4-10 (sim): the human run loses 1 heart(s)

**Fix:** The level was regenerated with the fixed acorn spots; the human-limited player now finishes it without losing a heart.

### Every level (before)

| Level | Set pieces | Completed | Where it failed | Hearts lost | Acorns (human) | Min. warning | Deaths probed | Browser desktop | Browser phone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1-1 | planks | yes |  | 0 | 3/3 | 1.62 s | 6, 6 free | won, 3/3 — ⚠ falls free | won, 3/3 — ⚠ touch lag, falls free |
| 1-2 | shrooms | **no** | x 195.7 (bouncy mushrooms) | 0 | 3/3 | – | 5, 5 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| 1-3 | ropes | yes |  | 0 | 3/3 | 1.32 s | 12, 10 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 1-4 | logs + collapse | yes |  | 0 | 3/3 | 1.25 s | 7, 5 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 1-5 | collapse + shrooms | **no** | x 239.2 (bouncy mushrooms) | 0 | 2/3 | – | 4, 4 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| 1-6 | glide + logs | yes |  | 0 | 3/3 | 1.28 s | 9, 7 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ finger lift, camera, falls free |
| 1-7 | chase + ropes | yes |  | 0 | 3/3 | 1.60 s | 10, 8 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, finger lift, camera, falls free |
| 1-8 | planks + glide | yes (acorn missing) |  | 0 | 2/3 | 1.25 s | 8, 8 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 1-9 | ropes + chase | yes |  | 0 | 3/3 | 1.23 s | 8, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 1-10 | shrooms + glide | **no** | x 155.0 (bouncy mushrooms) | 0 | 3/3 | – | 3, 3 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| 1-11 | logs + planks | yes |  | 0 | 3/3 | 1.32 s | 16, 14 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 1-12 | chase + ropes | yes |  | 0 | 3/3 | 1.25 s | 9, 7 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-1 | cave + waterfall | yes |  | 0 | 3/3 | 1.47 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-2 | waterfall + shrooms | yes |  | 0 | 3/3 | 1.53 s | 2, 2 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-3 | planks + shrooms | yes (acorn missing) |  | 0 | 2/3 | 1.48 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 2-4 | ropes + chase | yes |  | 0 | 3/3 | 1.27 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, falls free |
| 2-5 | chase + shrooms | yes |  | 0 | 3/3 | 1.30 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-6 | cave + collapse | yes |  | 0 | 3/3 | 1.35 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 2-7 | glide + ropes | yes |  | 0 | 3/3 | 1.25 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-8 | logs + waterfall | yes |  | 0 | 3/3 | 1.50 s | 8, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| 2-9 | waterfall + chase | yes |  | 0 | 3/3 | 1.25 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| 2-10 | collapse + planks | yes |  | 0 | 3/3 | 1.27 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-11 | shrooms + glide | yes |  | 0 | 3/3 | 1.27 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 2-12 | ropes + logs | yes |  | 0 | 3/3 | 1.47 s | 5, 1 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 3-1 | shrooms + logs | yes |  | 0 | 3/3 | 1.27 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 3-2 | cave + planks | yes |  | 0 | 3/3 | 1.27 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, falls free |
| 3-3 | ropes + glide | yes |  | 0 | 3/3 | 1.27 s | 4, 2 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, finger lift, falls free |
| 3-4 | planks + collapse | yes (acorn missing) |  | 0 | 2/3 | 1.25 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 3-5 | glide + shrooms | yes |  | 0 | 3/3 | 1.27 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 3-6 | waterfall + shrooms | yes |  | 0 | 3/3 | 1.27 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 3-7 | logs + planks | yes |  | 0 | 3/3 | 1.25 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 3-8 | chase + ropes | yes |  | 0 | 3/3 | 1.25 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 3-9 | shrooms + logs | yes |  | 0 | 3/3 | 1.27 s | 9, 7 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 3-10 | collapse + chase | yes |  | 0 | 3/3 | 1.25 s | 4, 4 free | won, 3/3 — ⚠ camera | **not won** — ⚠ touch lag, camera |
| 3-11 | cave + shrooms | **no** | x 530.5 (bouncy mushrooms) | 0 | 3/3 | – | 4, 4 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| 3-12 | ropes + planks | yes |  | 0 | 3/3 | 1.25 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 4-1 | wind + chase | yes |  | 0 | 3/3 | 1.15 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 4-2 | logs + ropes | yes |  | 0 | 3/3 | 1.18 s | 5, 1 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| 4-3 | wind + collapse | yes |  | 0 | 3/3 | 1.15 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | won, 2/3 — ⚠ touch lag, camera, falls free |
| 4-4 | chase + ropes | yes |  | 0 | 3/3 | 1.20 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| 4-5 | planks + collapse | yes |  | 0 | 3/3 | 1.20 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 4-6 | wind + chase | yes |  | 0 | 3/3 | 1.15 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, finger lift, falls free |
| 4-7 | glide + logs | yes |  | 0 | 3/3 | 1.20 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 4-8 | ropes + shrooms | yes |  | 0 | 3/3 | 1.20 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, finger lift, camera, falls free |
| 4-9 | collapse + shrooms | **no** | x 453.3 (bouncy mushrooms) | 0 | 3/3 | – | 4, 4 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| 4-10 | wind + ropes | yes |  | 1 | 3/3 | 1.20 s | 12, 10 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 4-11 | waterfall + logs | yes |  | 0 | 3/3 | 1.20 s | 10, 8 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 4-12 | chase + collapse | yes |  | 0 | 3/3 | 1.20 s | 9, 9 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, falls free |
| 5-1 | lily + ropes | yes |  | 0 | 3/3 | 1.23 s | 10, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-2 | ropes + chase | yes |  | 0 | 3/3 | 1.25 s | 4, 2 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-3 | lily + chase | yes (acorn missing) |  | 0 | 2/3 | 1.20 s | 7, 5 free | won, 2/3 — ⚠ acorn, camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| 5-4 | cave + waterfall | yes |  | 0 | 3/3 | 1.20 s | 11, 11 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-5 | logs + glide | yes |  | 0 | 3/3 | 1.25 s | 8, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-6 | lily + planks | yes |  | 0 | 3/3 | 1.20 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, finger lift, camera, falls free |
| 5-7 | wind + logs | yes |  | 0 | 3/3 | 1.00 s | 7, 5 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-8 | chase + waterfall | yes |  | 0 | 3/3 | 1.20 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 5-9 | planks + lily | yes |  | 0 | 3/3 | 1.20 s | 7, 5 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-10 | lily + waterfall | yes |  | 0 | 3/3 | 1.20 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-11 | glide + collapse | yes |  | 0 | 3/3 | 1.20 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 5-12 | ropes + shrooms | **no** | x 392.6 (bouncy mushrooms) | 0 | 3/3 | – | 5, 3 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| 1-S | ropes + shrooms + chase | yes |  | 0 | 3/3 | 1.32 s | 6, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 2-S | cave + ropes + waterfall | yes |  | 0 | 3/3 | 1.27 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 3-S | shrooms + glide + cave | yes |  | 0 | 3/3 | 1.27 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| 4-S | wind + collapse + chase | yes |  | 0 | 3/3 | 1.20 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| 5-S | lily + ropes + wind | yes |  | 0 | 3/3 | 1.15 s | 11, 7 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-0 | planks + collapse | yes |  | 0 | 3/3 | 1.27 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| daily-1 | logs + ropes | yes |  | 0 | 3/3 | 1.45 s | 12, 8 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-2 | shrooms + chase | yes |  | 0 | 3/3 | 1.25 s | 2, 2 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, finger lift, falls free |
| daily-3 | waterfall + chase | yes |  | 0 | 3/3 | 1.20 s | 3, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| daily-4 | ropes + cave | yes |  | 0 | 3/3 | 1.22 s | 9, 7 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-5 | planks + shrooms | yes |  | 0 | 3/3 | 1.30 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-6 | ropes + shrooms | yes |  | 0 | 3/3 | 1.43 s | 7, 5 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-7 | planks + glide | yes |  | 0 | 3/3 | 1.28 s | 2, 2 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-8 | logs + collapse | yes |  | 0 | 3/3 | 1.20 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| daily-9 | planks + shrooms | **no** | x 389.2 (bouncy mushrooms) | 0 | 3/3 | – | 6, 6 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| daily-10 | planks + collapse | yes (acorn missing) |  | 0 | 2/3 | 1.50 s | 7, 7 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| daily-11 | shrooms + planks | **no** | x 179.6 (bouncy mushrooms) | 0 | 2/3 | – | 3, 3 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| daily-12 | waterfall + logs | yes |  | 0 | 3/3 | 1.27 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-13 | waterfall + planks | yes |  | 0 | 3/3 | 1.20 s | 4, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-14 | ropes + chase | yes |  | 0 | 3/3 | 1.22 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| daily-15 | planks + shrooms | **no** | x 290.6 (bouncy mushrooms) | 0 | 3/3 | – | 8, 8 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| daily-16 | planks + waterfall | yes |  | 0 | 3/3 | 1.25 s | 4, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, falls free |
| daily-17 | cave + ropes | yes |  | 0 | 3/3 | 1.27 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-18 | logs + cave | yes |  | 0 | 3/3 | 1.20 s | 5, 3 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-19 | collapse + planks | yes |  | 0 | 3/3 | 1.20 s | 7, 7 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ touch lag, camera, falls free |
| daily-20 | planks + collapse | yes |  | 0 | 3/3 | 1.27 s | 7, 7 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| daily-21 | waterfall + chase | yes |  | 0 | 3/3 | 1.27 s | 4, 4 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| daily-22 | chase + shrooms | yes |  | 0 | 3/3 | 1.27 s | 8, 8 free | won, 3/3 — ⚠ camera, falls free | won, 3/3 — ⚠ camera, falls free |
| daily-23 | waterfall + logs | yes |  | 0 | 3/3 | 1.20 s | 4, 2 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, falls free |
| daily-24 | chase + glide | yes |  | 0 | 3/3 | 1.20 s | 6, 6 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-25 | planks + shrooms | **no** | x 276.3 (bouncy mushrooms) | 0 | 2/3 | – | 5, 5 free | **not won** — ⚠ mushrooms, camera, falls free | **not won** — ⚠ mushrooms, camera, falls free |
| daily-26 | cave + glide | yes |  | 0 | 3/3 | 1.30 s | 9, 9 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, finger lift, camera, falls free |
| daily-27 | glide + planks | yes |  | 0 | 3/3 | 1.25 s | 4, 4 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, finger lift, falls free |
| daily-28 | logs + planks | yes |  | 0 | 3/3 | 1.20 s | 7, 5 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, falls free |
| daily-29 | waterfall + planks | yes |  | 0 | 3/3 | 1.12 s | 5, 5 free | won, 3/3 — ⚠ camera, falls free | **not won** — ⚠ touch lag, camera, finger lift, falls free |

## After the fixes (v1.1.1)

- Human-limited playtest (simulation): **95/95 levels without a problem**; 95/95 can be finished, 95/95 with all 3 golden acorns.
- Death probes: 570 deaths at pits and lakes, 570 of them cost a heart.
- Real browser build: 190/190 runs (desktop keyboard + phone touch) without a problem.
- **0 causes, 0 level problems** (a cause in a level counts once) in 0 levels; 0 individual findings (every probed death, every device).

**Every level, Golden Grove and daily level passes the human-limited playtest and the browser playtest with zero problems.**

### Also found and fixed

- Picking a seed card handled the previous frame's events again: a card picked in the very frame the sprite stopped
  re-ran the stop and, with the last seed planted, showed the "out of seeds" screen (only reachable by a bot: the
  cards are not visible yet in that frame). `Play.pick` now handles only the planting's own events.
- The checks themselves: CI's level validator now uses the human-limited playtester instead of the frame-perfect bot,
  the fairness check also counts pits, and CI runs the browser playtest on every level (desktop and phone).

### Every level (after)

| Level | Set pieces | Completed | Where it failed | Hearts lost | Acorns (human) | Min. warning | Deaths probed | Browser desktop | Browser phone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1-1 | planks | yes |  | 0 | 3/3 | 1.62 s | 6 | won, 3/3 | won, 3/3 |
| 1-2 | shrooms | yes |  | 0 | 3/3 | 1.32 s | 5 | won, 3/3 | won, 3/3 |
| 1-3 | ropes | yes |  | 0 | 3/3 | 1.27 s | 12 | won, 3/3 | won, 3/3 |
| 1-4 | logs + collapse | yes |  | 0 | 3/3 | 1.23 s | 7 | won, 3/3 | won, 3/3 |
| 1-5 | collapse + shrooms | yes |  | 0 | 3/3 | 1.60 s | 4 | won, 3/3 | won, 3/3 |
| 1-6 | glide + logs | yes |  | 0 | 3/3 | 1.28 s | 9 | won, 3/3 | won, 3/3 |
| 1-7 | chase + ropes | yes |  | 0 | 3/3 | 1.60 s | 10 | won, 3/3 | won, 3/3 |
| 1-8 | planks + glide | yes |  | 0 | 3/3 | 1.58 s | 8 | won, 3/3 | won, 3/3 |
| 1-9 | ropes + chase | yes |  | 0 | 3/3 | 1.23 s | 8 | won, 3/3 | won, 3/3 |
| 1-10 | shrooms + glide | yes |  | 0 | 3/3 | 1.32 s | 5 | won, 3/3 | won, 3/3 |
| 1-11 | logs + planks | yes |  | 0 | 3/3 | 1.27 s | 16 | won, 3/3 | won, 3/3 |
| 1-12 | chase + ropes | yes |  | 0 | 3/3 | 1.25 s | 9 | won, 3/3 | won, 3/3 |
| 2-1 | cave + waterfall | yes |  | 0 | 3/3 | 1.57 s | 3 | won, 3/3 | won, 3/3 |
| 2-2 | waterfall + shrooms | yes |  | 0 | 3/3 | 1.53 s | 1 | won, 3/3 | won, 3/3 |
| 2-3 | planks + shrooms | yes |  | 0 | 3/3 | 1.50 s | 2 | won, 3/3 | won, 3/3 |
| 2-4 | ropes + chase | yes |  | 0 | 3/3 | 1.30 s | 6 | won, 3/3 | won, 3/3 |
| 2-5 | chase + shrooms | yes |  | 0 | 3/3 | 1.28 s | 2 | won, 3/3 | won, 3/3 |
| 2-6 | cave + collapse | yes |  | 0 | 3/3 | 1.57 s | 6 | won, 3/3 | won, 3/3 |
| 2-7 | glide + ropes | yes |  | 0 | 3/3 | 1.27 s | 6 | won, 3/3 | won, 3/3 |
| 2-8 | logs + waterfall | yes |  | 0 | 3/3 | 1.50 s | 8 | won, 3/3 | won, 3/3 |
| 2-9 | waterfall + chase | yes |  | 0 | 3/3 | 1.25 s | 3 | won, 3/3 | won, 3/3 |
| 2-10 | collapse + planks | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| 2-11 | shrooms + glide | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| 2-12 | ropes + logs | yes |  | 0 | 3/3 | 1.47 s | 5 | won, 3/3 | won, 3/3 |
| 3-1 | shrooms + logs | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| 3-2 | cave + planks | yes |  | 0 | 3/3 | 1.25 s | 3 | won, 3/3 | won, 3/3 |
| 3-3 | ropes + glide | yes |  | 0 | 3/3 | 1.27 s | 4 | won, 3/3 | won, 3/3 |
| 3-4 | planks + collapse | yes |  | 0 | 3/3 | 1.25 s | 5 | won, 3/3 | won, 3/3 |
| 3-5 | glide + shrooms | yes |  | 0 | 3/3 | 1.27 s | 6 | won, 3/3 | won, 3/3 |
| 3-6 | waterfall + shrooms | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| 3-7 | logs + planks | yes |  | 0 | 3/3 | 1.25 s | 6 | won, 3/3 | won, 3/3 |
| 3-8 | chase + ropes | yes |  | 0 | 3/3 | 1.25 s | 6 | won, 3/3 | won, 3/3 |
| 3-9 | shrooms + logs | yes |  | 0 | 3/3 | 1.27 s | 8 | won, 3/3 | won, 3/3 |
| 3-10 | collapse + chase | yes |  | 0 | 3/3 | 1.25 s | 4 | won, 3/3 | won, 3/3 |
| 3-11 | cave + shrooms | yes |  | 0 | 3/3 | 1.27 s | 3 | won, 3/3 | won, 3/3 |
| 3-12 | ropes + planks | yes |  | 0 | 3/3 | 1.25 s | 6 | won, 3/3 | won, 3/3 |
| 4-1 | wind + chase | yes |  | 0 | 3/3 | 1.15 s | 5 | won, 3/3 | won, 3/3 |
| 4-2 | logs + ropes | yes |  | 0 | 3/3 | 1.18 s | 5 | won, 3/3 | won, 3/3 |
| 4-3 | wind + collapse | yes |  | 0 | 3/3 | 1.15 s | 5 | won, 3/3 | won, 3/3 |
| 4-4 | chase + ropes | yes |  | 0 | 3/3 | 1.20 s | 5 | won, 3/3 | won, 3/3 |
| 4-5 | planks + collapse | yes |  | 0 | 3/3 | 1.20 s | 3 | won, 3/3 | won, 3/3 |
| 4-6 | wind + chase | yes |  | 0 | 3/3 | 1.15 s | 3 | won, 3/3 | won, 3/3 |
| 4-7 | glide + logs | yes |  | 0 | 3/3 | 1.20 s | 5 | won, 3/3 | won, 3/3 |
| 4-8 | ropes + shrooms | yes |  | 0 | 3/3 | 1.20 s | 5 | won, 3/3 | won, 3/3 |
| 4-9 | collapse + shrooms | yes |  | 0 | 3/3 | 1.20 s | 4 | won, 3/3 | won, 3/3 |
| 4-10 | wind + ropes | yes |  | 0 | 3/3 | 1.20 s | 12 | won, 3/3 | won, 3/3 |
| 4-11 | waterfall + logs | yes |  | 0 | 3/3 | 1.20 s | 10 | won, 3/3 | won, 3/3 |
| 4-12 | chase + collapse | yes |  | 0 | 3/3 | 1.20 s | 9 | won, 3/3 | won, 3/3 |
| 5-1 | lily + ropes | yes |  | 0 | 3/3 | 1.22 s | 10 | won, 3/3 | won, 3/3 |
| 5-2 | ropes + chase | yes |  | 0 | 3/3 | 1.25 s | 4 | won, 3/3 | won, 3/3 |
| 5-3 | lily + chase | yes |  | 0 | 3/3 | 1.20 s | 7 | won, 3/3 | won, 3/3 |
| 5-4 | cave + waterfall | yes |  | 0 | 3/3 | 1.20 s | 11 | won, 3/3 | won, 3/3 |
| 5-5 | logs + glide | yes |  | 0 | 3/3 | 1.25 s | 8 | won, 3/3 | won, 3/3 |
| 5-6 | lily + planks | yes |  | 0 | 3/3 | 1.20 s | 9 | won, 3/3 | won, 3/3 |
| 5-7 | wind + logs | yes |  | 0 | 3/3 | 1.13 s | 7 | won, 3/3 | won, 3/3 |
| 5-8 | chase + waterfall | yes |  | 0 | 3/3 | 1.20 s | 6 | won, 3/3 | won, 3/3 |
| 5-9 | planks + lily | yes |  | 0 | 3/3 | 1.20 s | 7 | won, 3/3 | won, 3/3 |
| 5-10 | lily + waterfall | yes |  | 0 | 3/3 | 1.20 s | 6 | won, 3/3 | won, 3/3 |
| 5-11 | glide + collapse | yes |  | 0 | 3/3 | 1.20 s | 6 | won, 3/3 | won, 3/3 |
| 5-12 | ropes + shrooms | yes |  | 0 | 3/3 | 1.25 s | 7 | won, 3/3 | won, 3/3 |
| 1-S | ropes + shrooms + chase | yes |  | 0 | 3/3 | 1.32 s | 6 | won, 3/3 | won, 3/3 |
| 2-S | cave + ropes + waterfall | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| 3-S | shrooms + glide + cave | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| 4-S | wind + collapse + chase | yes |  | 0 | 3/3 | 1.15 s | 6 | won, 3/3 | won, 3/3 |
| 5-S | lily + ropes + wind | yes |  | 0 | 3/3 | 1.15 s | 11 | won, 3/3 | won, 3/3 |
| daily-0 | planks + collapse | yes |  | 0 | 3/3 | 1.27 s | 6 | won, 3/3 | won, 3/3 |
| daily-1 | logs + ropes | yes |  | 0 | 3/3 | 1.45 s | 12 | won, 3/3 | won, 3/3 |
| daily-2 | shrooms + chase | yes |  | 0 | 3/3 | 1.23 s | 1 | won, 3/3 | won, 3/3 |
| daily-3 | waterfall + chase | yes |  | 0 | 3/3 | 1.20 s | 3 | won, 3/3 | won, 3/3 |
| daily-4 | ropes + cave | yes |  | 0 | 3/3 | 1.22 s | 9 | won, 3/3 | won, 3/3 |
| daily-5 | planks + shrooms | yes |  | 0 | 3/3 | 1.30 s | 5 | won, 3/3 | won, 3/3 |
| daily-6 | ropes + shrooms | yes |  | 0 | 3/3 | 1.43 s | 6 | won, 3/3 | won, 3/3 |
| daily-7 | planks + glide | yes |  | 0 | 3/3 | 1.28 s | 2 | won, 3/3 | won, 3/3 |
| daily-8 | logs + collapse | yes |  | 0 | 3/3 | 1.20 s | 5 | won, 3/3 | won, 3/3 |
| daily-9 | planks + shrooms | yes |  | 0 | 3/3 | 1.20 s | 6 | won, 3/3 | won, 3/3 |
| daily-10 | planks + collapse | yes |  | 0 | 3/3 | 1.60 s | 7 | won, 3/3 | won, 3/3 |
| daily-11 | shrooms + planks | yes |  | 0 | 3/3 | 1.47 s | 4 | won, 3/3 | won, 3/3 |
| daily-12 | waterfall + logs | yes |  | 0 | 3/3 | 1.25 s | 5 | won, 3/3 | won, 3/3 |
| daily-13 | waterfall + planks | yes |  | 0 | 3/3 | 1.20 s | 4 | won, 3/3 | won, 3/3 |
| daily-14 | ropes + chase | yes |  | 0 | 3/3 | 1.22 s | 5 | won, 3/3 | won, 3/3 |
| daily-15 | planks + shrooms | yes |  | 0 | 3/3 | 1.28 s | 8 | won, 3/3 | won, 3/3 |
| daily-16 | planks + waterfall | yes |  | 0 | 3/3 | 1.27 s | 4 | won, 3/3 | won, 3/3 |
| daily-17 | cave + ropes | yes |  | 0 | 3/3 | 1.27 s | 5 | won, 3/3 | won, 3/3 |
| daily-18 | logs + cave | yes |  | 0 | 3/3 | 1.20 s | 5 | won, 3/3 | won, 3/3 |
| daily-19 | collapse + planks | yes |  | 0 | 3/3 | 1.20 s | 7 | won, 3/3 | won, 3/3 |
| daily-20 | planks + collapse | yes |  | 0 | 3/3 | 1.27 s | 7 | won, 3/3 | won, 3/3 |
| daily-21 | waterfall + chase | yes |  | 0 | 3/3 | 1.27 s | 4 | won, 3/3 | won, 3/3 |
| daily-22 | chase + shrooms | yes |  | 0 | 3/3 | 1.27 s | 7 | won, 3/3 | won, 3/3 |
| daily-23 | waterfall + logs | yes |  | 0 | 3/3 | 1.20 s | 4 | won, 3/3 | won, 3/3 |
| daily-24 | chase + glide | yes |  | 0 | 3/3 | 1.20 s | 6 | won, 3/3 | won, 3/3 |
| daily-25 | planks + shrooms | yes |  | 0 | 3/3 | 1.25 s | 4 | won, 3/3 | won, 3/3 |
| daily-26 | cave + glide | yes |  | 0 | 3/3 | 1.28 s | 9 | won, 3/3 | won, 3/3 |
| daily-27 | glide + planks | yes |  | 0 | 3/3 | 1.25 s | 4 | won, 3/3 | won, 3/3 |
| daily-28 | logs + planks | yes |  | 0 | 3/3 | 1.20 s | 7 | won, 3/3 | won, 3/3 |
| daily-29 | waterfall + planks | yes |  | 0 | 3/3 | 1.12 s | 5 | won, 3/3 | won, 3/3 |

## Before and after, per level

| Level | Before (v1.1.0) | Problems before | After (v1.1.1) | Problems after |
| --- | --- | --- | --- | --- |
| 1-1 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 1-2 | stuck at x 195.7 (bouncy mushrooms) | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 1-3 | 3/3 acorns, 0 hearts lost | 14 | 3/3 acorns, 0 hearts lost | 0 |
| 1-4 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 1-5 | stuck at x 239.2 (bouncy mushrooms) | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 1-6 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 1-7 | 3/3 acorns, 0 hearts lost | 16 | 3/3 acorns, 0 hearts lost | 0 |
| 1-8 | 2/3 acorns, 0 hearts lost | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 1-9 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 1-10 | stuck at x 155.0 (bouncy mushrooms) | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 1-11 | 3/3 acorns, 0 hearts lost | 18 | 3/3 acorns, 0 hearts lost | 0 |
| 1-12 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 2-1 | 3/3 acorns, 0 hearts lost | 7 | 3/3 acorns, 0 hearts lost | 0 |
| 2-2 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 2-3 | 2/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 2-4 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 2-5 | 3/3 acorns, 0 hearts lost | 7 | 3/3 acorns, 0 hearts lost | 0 |
| 2-6 | 3/3 acorns, 0 hearts lost | 14 | 3/3 acorns, 0 hearts lost | 0 |
| 2-7 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 2-8 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 2-9 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 2-10 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 2-11 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 2-12 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 3-1 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 3-2 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 3-3 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 3-4 | 2/3 acorns, 0 hearts lost | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 3-5 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 3-6 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 3-7 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 3-8 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 3-9 | 3/3 acorns, 0 hearts lost | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 3-10 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 3-11 | stuck at x 530.5 (bouncy mushrooms) | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 3-12 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 4-1 | 3/3 acorns, 0 hearts lost | 14 | 3/3 acorns, 0 hearts lost | 0 |
| 4-2 | 3/3 acorns, 0 hearts lost | 6 | 3/3 acorns, 0 hearts lost | 0 |
| 4-3 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 4-4 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| 4-5 | 3/3 acorns, 0 hearts lost | 7 | 3/3 acorns, 0 hearts lost | 0 |
| 4-6 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 4-7 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 4-8 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 4-9 | stuck at x 453.3 (bouncy mushrooms) | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 4-10 | 3/3 acorns, 1 hearts lost | 18 | 3/3 acorns, 0 hearts lost | 0 |
| 4-11 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 4-12 | 3/3 acorns, 0 hearts lost | 16 | 3/3 acorns, 0 hearts lost | 0 |
| 5-1 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 5-2 | 3/3 acorns, 0 hearts lost | 6 | 3/3 acorns, 0 hearts lost | 0 |
| 5-3 | 2/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 5-4 | 3/3 acorns, 0 hearts lost | 15 | 3/3 acorns, 0 hearts lost | 0 |
| 5-5 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 5-6 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 5-7 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 5-8 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 5-9 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 5-10 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| 5-11 | 3/3 acorns, 0 hearts lost | 13 | 3/3 acorns, 0 hearts lost | 0 |
| 5-12 | stuck at x 392.6 (bouncy mushrooms) | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 1-S | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| 2-S | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| 3-S | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 4-S | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| 5-S | 3/3 acorns, 0 hearts lost | 13 | 3/3 acorns, 0 hearts lost | 0 |
| daily-0 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| daily-1 | 3/3 acorns, 0 hearts lost | 15 | 3/3 acorns, 0 hearts lost | 0 |
| daily-2 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| daily-3 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| daily-4 | 3/3 acorns, 0 hearts lost | 14 | 3/3 acorns, 0 hearts lost | 0 |
| daily-5 | 3/3 acorns, 0 hearts lost | 13 | 3/3 acorns, 0 hearts lost | 0 |
| daily-6 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| daily-7 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| daily-8 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| daily-9 | stuck at x 389.2 (bouncy mushrooms) | 15 | 3/3 acorns, 0 hearts lost | 0 |
| daily-10 | 2/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| daily-11 | stuck at x 179.6 (bouncy mushrooms) | 12 | 3/3 acorns, 0 hearts lost | 0 |
| daily-12 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| daily-13 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| daily-14 | 3/3 acorns, 0 hearts lost | 9 | 3/3 acorns, 0 hearts lost | 0 |
| daily-15 | stuck at x 290.6 (bouncy mushrooms) | 17 | 3/3 acorns, 0 hearts lost | 0 |
| daily-16 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| daily-17 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| daily-18 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| daily-19 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| daily-20 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| daily-21 | 3/3 acorns, 0 hearts lost | 10 | 3/3 acorns, 0 hearts lost | 0 |
| daily-22 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| daily-23 | 3/3 acorns, 0 hearts lost | 8 | 3/3 acorns, 0 hearts lost | 0 |
| daily-24 | 3/3 acorns, 0 hearts lost | 12 | 3/3 acorns, 0 hearts lost | 0 |
| daily-25 | stuck at x 276.3 (bouncy mushrooms) | 14 | 3/3 acorns, 0 hearts lost | 0 |
| daily-26 | 3/3 acorns, 0 hearts lost | 17 | 3/3 acorns, 0 hearts lost | 0 |
| daily-27 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| daily-28 | 3/3 acorns, 0 hearts lost | 11 | 3/3 acorns, 0 hearts lost | 0 |
| daily-29 | 3/3 acorns, 0 hearts lost | 14 | 3/3 acorns, 0 hearts lost | 0 |
