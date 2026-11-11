# Credits

Sprout Trail is an original game. Everything not listed below was made for this project: code, the forest sprite,
the beetle, the plants (bridge, vine ladder, mushroom), golden acorns, gems, signs, checkpoint flowers, the goal
stump house, stumps, fallen logs, thorn brambles, terrain, water, sky, hills, clouds, light rays, particles
(`src/render/`), UI art and icons (`src/ui/icons.ts`), all sound effects and the music (synthesised at runtime with
the Web Audio API, `src/app/audio.ts`).

## 3D models (CC0 1.0, public domain)

### Stylized Nature MegaKit (Standard) by Quaternius — https://quaternius.com
License: CC0 1.0 — `assets-src/quaternius-stylized-nature-megakit/License_Standard.txt`

Only these models and their textures are committed (`assets-src/quaternius-stylized-nature-megakit/`) and bundled
(`public/models/nature.glb`, built by `npm run assets` / `scripts/assets.mjs`: normal maps dropped, textures resized
to 512 px and converted to WebP, meshes welded and quantized).

| Model | Used for |
| --- | --- |
| CommonTree_1 | broad-leaf trees behind the trail |
| Pine_3, Pine_5 | pines in the background |
| Bush_Common_Flowers | flowering bushes on the trail and in the meadow |
| Flower_3_Group, Flower_4_Group | flower patches |
| Grass_Common_Tall | grass tufts (with wind sway) |
| Plant_1_Big | leafy plants |
| Rock_Medium_1, Rock_Medium_2 | rocks |
| Pebble_Round_1 | pebbles |
| Mushroom_Common | small decorative mushrooms |

Textures used: Bark_NormalTree, Leaves_NormalTree_C, Leaf_Pine_C, Leaves, Flowers, Grass, Rocks_Diffuse,
PathRocks_Diffuse, Mushrooms.

Source: the CC0 pack files from the `assets-v1` release of rafikaramyan1987-ux/Word-Islands (as committed in that
repository's `assets-src/`, licence file included). The Pirate Kit from the same release is not used yet.

## Fonts

- Fredoka by Milena Brandão and Hafontia — SIL Open Font License 1.1, via `@fontsource/fredoka` (npm)
- Nunito by Vernon Adams, Cyreal and Jacques Le Bailly — SIL Open Font License 1.1, via `@fontsource/nunito` (npm)

## Libraries

- three.js — MIT License
- Vite, TypeScript, Vitest, Playwright, ESLint, glTF-Transform, sharp — development tools only
