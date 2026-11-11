import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// use a pre-installed Chromium when Playwright's own browser is not installed (CI installs it)
const fallback = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const executablePath = !process.env.CI && existsSync(fallback) ? fallback : undefined;

/** e2e on the web build (desktop + phone); `npm run build:web` first */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { trace: 'off', launchOptions: { args: GL, executablePath } },
  webServer: { command: 'npx vite preview --outDir dist-web --host 127.0.0.1 --port 4180 --strictPort', url: 'http://127.0.0.1:4180/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4180/', viewport: { width: 1280, height: 720 } } },
    { name: 'phone', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4180/', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
