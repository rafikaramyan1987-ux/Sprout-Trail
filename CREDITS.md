# Credits

Sprout Trail is an original game. Everything not listed below was made for this project: code, the forest sprite
and its hats, the beetle, snail, bee and rolling acorn, the plants (bridge, vine ladder, mushroom, big leaf, tall
tree, log), golden acorns, gems, signs, checkpoint flowers, the goal stump house, stumps, fallen logs, thorn brambles,
giant mushrooms, mist, the Phase C set pieces (planks, ropes, the cartoon crocodile, logs, lily pads,
stepping stones, bounce mushrooms, wind leaves and vane, the collapsing bridge, the boar and fence, the cave, the
waterfall, dandelions), the 20 scenery variants and their props (lakes, reeds, waterfall cliffs, giant roots, glowing
mushrooms, crystals, puddles, rain), terrain, water, sky, hills, clouds, light rays, particles (`src/render/`), UI art and icons
(`src/ui/icons.ts`, `src/main.ts`), all sound effects and the music (synthesised at runtime with the Web Audio API,
`src/app/audio.ts`), the level generator and all 95 levels.

Store art and videos (every `submission*/` folder: covers, thumbnails, icons, screenshots, promos, the Y8 gameplay
video, the CrazyGames trailers) are captured from the game itself (`scripts/submission/media.ts`): they show only the
assets listed here, so they carry the same licences (original work and the CC0 models below). No music or sound is
used in the videos.

## 3D models (CC0 1.0, public domain)

### Stylized Nature MegaKit (Standard) by Quaternius — https://quaternius.com
License: CC0 1.0 — `assets-src/quaternius-stylized-nature-megakit/License_Standard.txt`

Only these models and their textures are committed (`assets-src/quaternius-stylized-nature-megakit/`) and bundled
(`public/models/nature.glb`, built by `npm run assets` / `scripts/assets.mjs`: normal maps dropped, textures resized
to 512 px and converted to WebP, meshes welded and quantized).

| Model | Used for |
| --- | --- |
| CommonTree_1 | broad-leaf trees behind the trail |
| Pine_1, Pine_3, Pine_5 | pines (tinted per world) |
| DeadTree_1 | bare trees of the Misty Swamp |
| Bush_Common_Flowers | flowering bushes on the trail and in the meadow |
| Flower_3_Group, Flower_4_Group | flower patches |
| Grass_Common_Tall | grass tufts (with wind sway) |
| Plant_1_Big | leafy plants |
| Rock_Medium_1, Rock_Medium_2 | rocks |
| Pebble_Round_1 | pebbles |
| Mushroom_Common | small decorative mushrooms |

Textures used: Bark_DeadTree, Bark_NormalTree, Leaves_NormalTree_C, Leaf_Pine_C, Leaves, Flowers, Grass, Rocks_Diffuse,
PathRocks_Diffuse, Mushrooms.

Source: the CC0 pack files from the `assets-v1` release of rafikaramyan1987-ux/Word-Islands (as committed in that
repository's `assets-src/`, licence file included). The Pirate Kit from the same release is not used yet.

## Fonts

- Fredoka by Milena Brandão and Hafontia — SIL Open Font License 1.1, via `@fontsource/fredoka` (npm)
- Nunito by Vernon Adams, Cyreal and Jacques Le Bailly — SIL Open Font License 1.1, via `@fontsource/nunito` (npm)

## Portal SDKs (not shipped)

No portal SDK is part of any zip: each build loads its portal's SDK from the portal's own CDN at run time —
CrazyGames SDK v3, GameDistribution `main.min.js`, GamePix `gamepix.sdk.js`, the Playgama Bridge
(`bridge.playgama.com`), GameMonetize `api.gamemonetize.com/sdk.js`, Y8 `cdn.y8.com/minimal-sdk/2-0/y8.min.js`.

## Libraries

- three.js — MIT License
- Vite, TypeScript, Vitest, Playwright, ESLint, glTF-Transform, sharp — development tools only
