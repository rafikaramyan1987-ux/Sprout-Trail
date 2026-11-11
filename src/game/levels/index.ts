/** All levels in play order. */
import type { Level } from '../types';
import { WORLD1 } from './w1';

export const LEVELS: Level[] = [...WORLD1];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id) ?? null;

export function nextLevel(id: string): Level | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null;
}
