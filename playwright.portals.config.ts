import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/** smoke tests of the GameMonetize, Y8 and GameDistribution builds with stubbed SDKs (`npm run build:gamemonetize && npm run build:y8 && npm run build:gd` first) */
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const fallback = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const executablePath = !process.env.CI && existsSync(fallback) ? fallback : undefined;
const server = (dir: string, port: number) => ({ command: `npx vite preview --outDir ${dir} --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 60_000 });

export default defineConfig({
  testDir: 'tests/e2e-portals',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { trace: 'off', launchOptions: { args: GL, executablePath } },
  webServer: [server('dist-gamemonetize', 4181), server('dist-y8', 4182), server('dist-gd', 4183)],
  projects: [
    { name: 'gamemonetize', testMatch: 'gamemonetize.spec.ts', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4181/', viewport: { width: 1280, height: 720 } } },
    { name: 'y8', testMatch: 'y8.spec.ts', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4182/', viewport: { width: 1280, height: 720 } } },
    { name: 'gd', testMatch: 'gd.spec.ts', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4183/', viewport: { width: 1280, height: 720 } } },
  ],
});
