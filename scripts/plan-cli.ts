// Prints the level bot's plan for a level as JSON ({ inputs, choices }), for the zip checkers (scripts/web, scripts/playgama).
// usage: tsx scripts/plan-cli.ts 1-1
import { planFor } from './plan';
import { levelById } from '../src/game/levels';
process.stdout.write(JSON.stringify(planFor(levelById(process.argv[2] ?? '1-1')!)));
