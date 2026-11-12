#!/usr/bin/env node
// CI check for the GameDistribution build: the bundle carries the game ID defined in src/app/platform/gd.ts, sets
// GD_OPTIONS and loads the GD SDK, and contains no other portal's SDK. A malformed or placeholder ID fails it (the
// game is registered on GameDistribution; the real ID is in gd.ts).
import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER = '00000000000000000000000000000000';
const dir = process.argv[2] ?? 'dist-gd';
const errors = [];
const src = fs.readFileSync('src/app/platform/gd.ts', 'utf8');
const m = /export const GD_GAME_ID = '([^']*)'/.exec(src);
const id = m?.[1] ?? '';
if (!/^[0-9a-f]{32}$/.test(id)) errors.push(`GD_GAME_ID "${id}" is not a 32-character hex ID`);
if (id === PLACEHOLDER) errors.push('GD_GAME_ID is still the placeholder: set the real ID from the GameDistribution dashboard');
const js = fs
  .readdirSync(path.join(dir, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8'))
  .join('\n');
if (!js.includes(id)) errors.push(`the gd bundle does not contain the game ID ${id}`);
if (!js.includes('GD_OPTIONS')) errors.push('the gd bundle does not set GD_OPTIONS');
if (!js.includes('html5.api.gamedistribution.com/main.min.js')) errors.push('the gd bundle does not load the GameDistribution SDK');
for (const bad of ['sdk.crazygames.com', 'gamepix.sdk.js', 'playgama-bridge', 'api.gamemonetize.com', 'cdn.y8.com']) if (js.includes(bad)) errors.push(`the gd bundle contains another portal SDK (${bad})`);
if (errors.length) {
  console.error(`gd build check FAILED:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`gd build ok (game ID ${id})`);
