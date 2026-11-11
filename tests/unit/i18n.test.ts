import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import en from '../../src/i18n/en.json';
import { LEVELS } from '../../src/game/levels';
import { pickLang, t } from '../../src/i18n';

describe('i18n', () => {
  it('every sign and plant name has a text', () => {
    const keys = new Set(Object.keys(en));
    for (const L of LEVELS) {
      for (const s of L.signs) expect(keys.has(s.key) || keys.has(`${s.key}.touch`)).toBe(true);
      for (const d of L.dps) for (const c of d.cards) expect(keys.has(`plant.${c}`)).toBe(true);
    }
  });
  it('every t("...") key used in the source exists', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []));
    for (const f of files('src')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(?:t|label)\('([a-zA-Z0-9_.]+)'/g)) expect(m[1] in en, `${f}: ${m[1]}`).toBe(true);
    }
  });
  it('falls back to English', () => {
    expect(pickLang('xx-YY')).toBe('en');
    expect(t('title')).toBe('Sprout Trail');
  });
});
