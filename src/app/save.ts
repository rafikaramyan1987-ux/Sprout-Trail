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

export function loadSave(portal: KeyValueStore | null = null) {
  store = portal ?? local();
  try {
    const raw = store?.getItem(SAVE_KEY);
    if (raw) save = { ...fresh(), ...(JSON.parse(raw) as Partial<Save>) };
  } catch {
    save = fresh();
  }
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
