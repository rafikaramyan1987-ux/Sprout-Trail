/**
 * Translations: one JSON file per language, English is the reference (every other file must have all its keys,
 * checked in CI by scripts/check-i18n.mjs). `t(key, params)` with `{name}` placeholders; missing keys fall back to
 * English. The language comes from the player's choice in Settings, else the portal's locale, else the browser.
 */
import en from './en.json';
import fr from './fr.json';
import de from './de.json';
import es from './es.json';
import it from './it.json';
import ru from './ru.json';

export const LANGS = ['en', 'fr', 'de', 'es', 'it', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
/** language names in their own language (never translated) */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', it: 'Italiano', ru: 'Русский' };

type Table = Record<string, string>;
const TABLES: Record<Lang, Table> = { en, fr, de, es, it, ru };

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
