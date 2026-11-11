/** Generator seeds of the shipped levels (each one validated by scripts/validate-levels.ts). */
export const LEVEL_SEEDS: Record<string, number> = {};
export const SPECIAL_SEEDS = [1, 1, 1, 1, 1];
/** daily pool: seed 101 + i, except where the validator's --tune found a better one */
export const DAILY_SEEDS = Array.from({ length: 30 }, (_, i) => ({ 4: 302 } as Record<number, number>)[i] ?? 101 + i);
