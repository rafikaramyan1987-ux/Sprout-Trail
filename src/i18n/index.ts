/**
 * Translations: one JSON file per language, English is the reference. `t(key, params)` with `{name}` placeholders;
 * missing keys fall back to English. (Phase B adds fr, de, es, it, ru.)
 */
import en from './en.json';

export const LANGS = ['en'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { en: 'English' };

type Table = Record<string, string>;
const TABLES: Record<Lang, Table> = { en };

let lang: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

export function normalize(locale: string | null | undefined): Lang | null {
  if (!locale) return null;
  const base = locale.toLowerCase().replace('_', '-').split('-')[0];
  return (LANGS as readonly string[]).includes(base) ? (base as Lang) : null;
}

export function pickLang(...candidates: (string | null | undefined)[]): Lang {
  for (const c of candidates) {
    const l = normalize(c);
    if (l) return l;
  }
  return 'en';
}

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  for (const f of listeners) f(l);
}

export function onLang(f: (l: Lang) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const has = (key: string) => key in TABLES.en;

export function t(key: string, params?: Record<string, string | number>): string {
  let s = TABLES[lang][key] ?? TABLES.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
