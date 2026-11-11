/** Progress and settings, saved as one JSON value (localStorage, or the portal's cloud save in Phase B). */
export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface LevelRecord {
  stars: number;
  acorns: number;
  gems: number;
  done: boolean;
}
export interface Save {
  v: 1;
  levels: Record<string, LevelRecord>;
  gems: number;
  last: string | null;
  music: boolean;
  sfx: boolean;
  lang: string | null;
}

const KEY = 'sprout-trail-save';
const fresh = (): Save => ({ v: 1, levels: {}, gems: 0, last: null, music: true, sfx: true, lang: null });

let store: KeyValueStore | null = null;
export let save: Save = fresh();

function local(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(portal: KeyValueStore | null = null) {
  store = portal ?? local();
  try {
    const raw = store?.getItem(KEY);
    if (raw) save = { ...fresh(), ...(JSON.parse(raw) as Partial<Save>) };
  } catch {
    save = fresh();
  }
  return save;
}

export function persist() {
  try {
    store?.setItem(KEY, JSON.stringify(save));
  } catch {}
}

/** record a finished run; keeps the best of each value */
export function recordLevel(id: string, r: LevelRecord) {
  const old = save.levels[id];
  const gained = Math.max(0, r.gems - (old?.gems ?? 0));
  save.levels[id] = {
    stars: Math.max(old?.stars ?? 0, r.stars),
    acorns: Math.max(old?.acorns ?? 0, r.acorns),
    gems: Math.max(old?.gems ?? 0, r.gems),
    done: true,
  };
  save.gems += gained;
  save.last = id;
  persist();
}

export function resetProgress() {
  const keep = { music: save.music, sfx: save.sfx, lang: save.lang };
  save = { ...fresh(), ...keep };
  persist();
}
