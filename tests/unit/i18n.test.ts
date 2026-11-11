import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import en from '../../src/i18n/en.json';
import { allLevels } from '../../src/game/levels';
import { pickLang, t } from '../../src/i18n';

describe('i18n', () => {
  it('every sign and plant name has a text', () => {
    const keys = new Set(Object.keys(en));
    for (const L of allLevels()) {
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
  it('every language file has every key, with the same {placeholders}', () => {
    for (const f of readdirSync('src/i18n').filter((x) => x.endsWith('.json'))) {
      const tab = JSON.parse(readFileSync(`src/i18n/${f}`, 'utf8')) as Record<string, string>;
      for (const [k, v] of Object.entries(en)) {
        expect(tab[k], `${f} ${k}`).toBeTruthy();
        expect((tab[k].match(/\{\w+\}/g) ?? []).sort(), `${f} ${k}`).toEqual((v.match(/\{\w+\}/g) ?? []).sort());
      }
    }
  });
  it('picks the platform / browser language', () => {
    expect(pickLang(null, 'de-DE')).toBe('de');
    expect(pickLang('ru', 'fr')).toBe('ru');
    expect(pickLang('pt-BR')).toBe('en');
  });
  it('falls back to English', () => {
    expect(pickLang('xx-YY')).toBe('en');
    expect(t('title')).toBe('Sprout Trail');
  });
});
