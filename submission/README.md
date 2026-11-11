# Sprout Trail — CrazyGames submission

## Short description
A cozy forest platformer for one finger: run, jump and duck, then grow the right plant to cross every river, wall and thorn field.

## Description (433 characters)
Guide a little forest sprite home through 5 cozy worlds. It runs by itself: tap to jump, hold to jump higher, swipe down to duck under logs and bees. At rivers, walls, cliffs and thorn fields it stops and you pick a seed: a bridge, a vine ladder, a bouncy mushroom, a big leaf, a tall tree or a log. Only the right plant gets you across. 60 levels, 5 golden groves, a daily trail, golden acorns, gems and hats to unlock. 6 languages.

## How to play (405 characters)
The sprite runs on its own. Tap or swipe up to jump; keep your finger down to jump higher. Swipe down to duck under low logs and bees. Jump on beetles, jump over snails and rolling acorns. At a big obstacle the sprite stops: look at it and tap the seed card that will carry you across. A wrong plant costs a seed. Collect the 3 golden acorns for stars. Keyboard: Space, Up or W to jump, Down or S to duck.

## Tags
platformer, runner, puzzle, casual, cute, nature, forest, one-finger, 3d, family, kids, mobile, html5

## Files
- `sprout-trail-crazygames-v1.0.0.zip` — the CrazyGames build (`npm run build`), `index.html` at the root,
  relative paths only. CrazyGames SDK v3: loadingStart/Stop while booting, gameplayStart/Stop only around real play,
  happytime on a finished level, midgame ads only between levels (Next / Retry / Menu on the result screen, at most
  one per 2 minutes, none in the first 2 minutes), rewarded ads only from the clearly labelled buttons ("Watch an
  ad: +2 seeds", "Watch an ad: continue with 1 heart", "Watch an ad: double gems"), granted only on adFinished;
  8 s timeout, then "No ad available right now, try later" for 2.5 s. Language from the SDK locale (6 languages),
  saves in the SDK Data Module, the platform mute setting is followed live.
- Older versions: none.
- `covers/cover-1920x1080.png`, `covers/cover-800x1200.png`, `covers/cover-800x800.png` — from real play
  (`scripts/submission/covers.ts`); the logo sits at the bottom, the top-left corner is clear.
- `videos/trailer-1920x1080.mp4`, `videos/trailer-1080x1620.mp4` — 18 s, no sound, real play across the 5 worlds
  (`scripts/submission/trailer.ts`).

Regenerate: `npm run build:all`, `npx vite preview --outDir dist-web --port 4173`, then
`npx tsx scripts/submission/covers.ts`, `npx tsx scripts/submission/trailer.ts 1920 1080`,
`npx tsx scripts/submission/trailer.ts 1080 1620` and `node scripts/submission/build.mjs`.
