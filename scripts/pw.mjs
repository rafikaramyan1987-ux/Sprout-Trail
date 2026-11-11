// Shared Playwright launch settings: software WebGL (SwiftShader) so the 3D scene renders headless.
// PW_CHROMIUM (or a pre-installed /opt/pw-browsers/chromium) is used when Playwright's own browser is missing.
import { existsSync } from 'node:fs';
import { chromium as pw } from 'playwright';

export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const fallback = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
export const EXECUTABLE = !existsSync(pw.executablePath()) && existsSync(fallback) ? fallback : undefined;
export const chromium = {
  launch: (opts = {}) => pw.launch({ executablePath: EXECUTABLE, ...opts }),
};
