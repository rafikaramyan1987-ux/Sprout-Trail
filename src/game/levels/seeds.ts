/** Generator seeds of the shipped levels (each one validated by scripts/validate-levels.ts). */
export const LEVEL_SEEDS: Record<string, number> = {};
export const SPECIAL_SEEDS = [1, 1, 1, 1, 1];
export const DAILY_SEEDS = Array.from({ length: 30 }, (_, i) => 101 + i);
