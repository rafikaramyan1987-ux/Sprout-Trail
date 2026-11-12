/**
 * Progress and settings, saved as one JSON value: the portal's cloud save when there is one (CrazyGames Data
 * Module, Playgama storage), localStorage otherwise.
 */
import type { KeyValueStore } from './platform/types';

export interface LevelRecord {
  stars: number;
  acorns: number;
  gems: number;
  done: boolean;
}
export interface Save {
  v: 1;
  levels: Record<string, LevelRecord>;
  /** gems to spend in the wardrobe */
  gems: number;
  last: string | null;
  music: boolean;
  sfx: boolean;
  lang: string | null;
  hat: string;
  color: string;
  owned: string[];
  /** daily challenge: last day completed (days since 2026-01-01), streak, best streak */
  dailyDay: number;
  streak: number;
  bestStreak: number;
}

export const SAVE_KEY = 'sprout-trail-save';
const fresh = (): Save => ({ v: 1, levels: {}, gems: 0, last: null, music: true, sfx: true, lang: null, hat: 'none', color: 'leaf', owned: [], dailyDay: -1, streak: 0, bestStreak: 0 });

let store: KeyValueStore | null = null;
export let save: Save = fresh();

function local(): KeyValueStore | null {
  // Playgama: progress goes through Bridge Storage only (the platform's data())
  if (__PLATFORM__ === 'playgama') return null;
  try {
    const s = window.localStorage;
    s.setItem('__st_probe', '1');
    s.removeItem('__st_probe');
    return s;
  } catch {
    return null;
  }
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/**
 * A stored save, as the game uses it: every field coerced to its type (a missing or wrong-typed field, e.g. from an
 * older version or a hand-edited save, gets its default instead of breaking the game later); unknown fields are kept,
 * so the format stays the same for older and newer builds.
 */
export function parseSave(raw: string | null | undefined): Save {
  const d = fresh();
  if (!raw) return d;
  let o: Record<string, unknown>;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return d;
    o = v as Record<string, unknown>;
  } catch {
    return d;
  }
  const levels: Record<string, LevelRecord> = {};
  if (o.levels && typeof o.levels === 'object' && !Array.isArray(o.levels))
    for (const [k, r] of Object.entries(o.levels as Record<string, unknown>)) {
      if (!r || typeof r !== 'object') continue;
      const x = r as Record<string, unknown>;
      levels[k] = { stars: Math.max(0, Math.min(3, num(x.stars, 0))), acorns: Math.max(0, Math.min(3, num(x.acorns, 0))), gems: Math.max(0, num(x.gems, 0)), done: bool(x.done, true) };
    }
  return {
    ...o,
    v: 1,
    levels,
    gems: Math.max(0, num(o.gems, d.gems)),
    last: typeof o.last === 'string' ? o.last : null,
    music: bool(o.music, d.music),
    sfx: bool(o.sfx, d.sfx),
    lang: typeof o.lang === 'string' ? o.lang : null,
    hat: str(o.hat, d.hat),
    color: str(o.color, d.color),
    owned: Array.isArray(o.owned) ? o.owned.filter((x): x is string => typeof x === 'string') : [],
    dailyDay: num(o.dailyDay, d.dailyDay),
    streak: Math.max(0, num(o.streak, d.streak)),
    bestStreak: Math.max(0, num(o.bestStreak, d.bestStreak)),
  };
}

/** load the save; never throws (blocked storage, a broken or old save: defaults, the game plays on) */
export function loadSave(portal: KeyValueStore | null = null) {
  store = portal ?? local();
  let raw: string | null | undefined = null;
  try {
    raw = store?.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  save = parseSave(raw);
  return save;
}

export function persist() {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {}
}

/** record a finished run; keeps the best of each value; gems collected are added to the wallet */
export function recordLevel(id: string, r: LevelRecord, gemsEarned: number) {
  const old = save.levels[id];
  save.levels[id] = {
    stars: Math.max(old?.stars ?? 0, r.stars),
    acorns: Math.max(old?.acorns ?? 0, r.acorns),
    gems: Math.max(old?.gems ?? 0, r.gems),
    done: true,
  };
  save.gems += gemsEarned;
  if (!id.startsWith('daily')) save.last = id;
  persist();
}

export const today = (now = Date.now()) => Math.floor((now - Date.UTC(2026, 0, 1)) / 86_400_000);

/** the daily challenge was finished today: extend (or restart) the streak */
export function recordDaily(day: number) {
  if (save.dailyDay === day) return;
  save.streak = save.dailyDay === day - 1 ? save.streak + 1 : 1;
  save.bestStreak = Math.max(save.bestStreak, save.streak);
  save.dailyDay = day;
  persist();
}

/** the streak shown today (0 if a day was missed) */
export const currentStreak = (day: number) => (save.dailyDay >= day - 1 ? save.streak : 0);

export function resetProgress() {
  const keep = { music: save.music, sfx: save.sfx, lang: save.lang };
  save = { ...fresh(), ...keep };
  persist();
}
