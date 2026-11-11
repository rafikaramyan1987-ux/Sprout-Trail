// Build size budget: the whole build folder must stay under 4 MB.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2] ?? 'dist';
const LIMIT = 4 * 1024 * 1024;
const size = (p) => (statSync(p).isDirectory() ? readdirSync(p).reduce((a, f) => a + size(join(p, f)), 0) : statSync(p).size);
const total = size(dir);
console.log(`${dir}: ${(total / 1024 / 1024).toFixed(2)} MB`);
if (total > LIMIT) {
  console.error(`${dir} is over the 4 MB budget`);
  process.exit(1);
}
