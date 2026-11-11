/**
 * Bot plans for levels (the beam-search solver in src/game/bot.ts), encoded compactly for the browser:
 * one character per run-mode tick (65 + bits: 1 jump pressed, 2 jump held, 4 duck pressed, 8 duck held).
 */
import { solve, type Plan } from '../src/game/bot';
import type { Level } from '../src/game/types';

export function encodeInputs(p: Plan) {
  return p.inputs.map((i) => String.fromCharCode(65 + (i.jumpPressed ? 1 : 0) + (i.jumpHeld ? 2 : 0) + (i.duckPressed ? 4 : 0) + (i.duckHeld ? 8 : 0))).join('');
}

export function planFor(level: Level, wrongFirst = false) {
  const p = solve(level, { wrongFirst });
  if (!p.ok) throw new Error(`bot could not finish ${level.id}`);
  return { inputs: encodeInputs(p), choices: p.choices, seconds: p.seconds };
}
