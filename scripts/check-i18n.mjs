// Every language file in src/i18n has every key of en.json (and no empty values).
import { readFileSync, readdirSync } from 'node:fs';
const dir = 'src/i18n';
const en = JSON.parse(readFileSync(`${dir}/en.json`, 'utf8'));
let bad = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const k of Object.keys(en))
    if (typeof j[k] !== 'string' || !j[k].trim()) {
      console.error(`${f}: missing "${k}"`);
      bad++;
    }
  console.log(`${f}: ${Object.keys(j).length} keys`);
}
process.exit(bad ? 1 : 0);
