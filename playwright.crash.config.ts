import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Zero-errors suite (tests/e2e-crash, docs/robustness.md) on all three engines, desktop and phone, on the CrazyGames
// build (`npm run build` first; CRASH_DIR=<dir> tests another build folder). Firefox runs headed: its software WebGL
// needs a display (`xvfb-run -a` on Linux).
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const dir = process.env.CRASH_DIR || 'dist';
const port = Number(process.env.CRASH_PORT || 4176);
// a pre-installed Chromium when Playwright's own build is not installed (CI installs it)
const fallback = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const executablePath = !process.env.CI && existsSync(fallback) ? fallback : undefined;
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true };

export default defineConfig({
  testDir: 'tests/e2e-crash',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}/`, trace: 'off' },
  webServer: { command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir ${dir}`, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 60_000 },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 }, launchOptions: { args: GL, executablePath } } },
    { name: 'chromium-phone', use: { ...devices['Pixel 7'], launchOptions: { args: GL, executablePath } } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1280, height: 720 } } },
    { name: 'webkit-phone', use: { ...devices['iPhone 13'] } },
    { name: 'firefox-desktop', use: { browserName: 'firefox', viewport: { width: 1280, height: 720 }, headless: false } },
    { name: 'firefox-phone', use: { browserName: 'firefox', ...phone, headless: false } },
  ],
});
