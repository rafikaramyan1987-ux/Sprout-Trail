import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const PLATFORMS = ['crazygames', 'gd', 'web', 'gamepix', 'playgama', 'gamemonetize', 'y8'] as const;
type PlatformName = (typeof PLATFORMS)[number];

/** GamePix JS SDK v3 (manual lifecycle): an external script, loaded before the game bundle, in the GamePix build only */
export const GAMEPIX_SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';

/**
 * Build target portal: `VITE_PLATFORM=crazygames|gd|web|gamepix|playgama|gamemonetize|y8`, or `--mode gd` / `--mode web` / `--mode gamepix` /
 * `--mode playgama`;
 * default CrazyGames. The CrazyGames build goes to dist/, the others to dist-<platform>/.
 */
function platformFor(mode: string): PlatformName {
  const p = process.env.VITE_PLATFORM || (PLATFORMS.includes(mode as PlatformName) ? mode : 'crazygames');
  if (!PLATFORMS.includes(p as PlatformName)) throw new Error(`unknown VITE_PLATFORM "${p}" (crazygames | gd | web | gamepix | playgama | gamemonetize | y8)`);
  return p as PlatformName;
}

/** index.html of the GamePix build: `GamePixConfig` + the SDK script at the top of <head>, before the game bundle */
function gamepixSdk(): Plugin {
  return {
    name: 'gamepix-sdk',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'script', children: "window.GamePixConfig = { lifecycle: 'manual' };", injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: GAMEPIX_SDK_URL }, injectTo: 'head-prepend' },
      ],
    },
  };
}

/**
 * Playgama build, as Playgama's docs set it up for plain JS (wiki.playgama.com/playgama/bridge-sdk/setup and
 * bridge-sdk/api "Required steps"):
 * - the official Bridge from Playgama's CDN, `https://bridge.playgama.com/v2/stable/playgama-bridge.js` (it loads the
 *   adapter of the platform the game runs on), the first script in <head>, loaded normally (not async / defer / module);
 * - right after it, scripts/playgama/boot.js inlined: `bridge.initialize()`, and the game bundle starts only once that
 *   has settled (the module script is held as <script type="text/plain" data-playgama-game data-src=…> until then);
 * - `playgama-bridge-config.json` (`{}`: Bridge's own defaults) beside index.html.
 */
export const PLAYGAMA_BRIDGE_CDN = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
/** scripts/playgama/boot.js without its comment lines */
const playgamaBoot = () => readFileSync('scripts/playgama/boot.js', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').trim();
function playgamaBridge(): Plugin {
  return {
    name: 'playgama-bridge',
    apply: 'build',
    enforce: 'post',
    // the final index.html: Bridge CDN first, boot right after it, every game module script held until boot starts it
    generateBundle: {
      order: 'post',
      handler(_o, bundle) {
        this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: readFileSync('scripts/playgama/playgama-bridge-config.json') });
        const html = Object.values(bundle).find((a) => a.type === 'asset' && a.fileName.endsWith('.html'));
        if (!html || html.type !== 'asset' || typeof html.source !== 'string') return;
        let held = 0;
        let src = html.source.replace(/<script type="module"([^>]*)><\/script>/g, (_m, attrs: string) => {
          held++;
          const u = attrs.match(/\ssrc="([^"]+)"/)?.[1];
          return `<script type="text/plain" data-playgama-game${u ? ` data-src="${u}"` : ''}></script>`;
        });
        if (!held) throw new Error('playgama build: no game module script to hold until bridge.initialize()');
        if (!/<head>/.test(src)) throw new Error('playgama build: no <head> in index.html');
        // Playgama: no localStorage at all (progress and the language come from Bridge); the loading screen's failure
        // card then speaks the browser's language
        const guess = "JSON.parse(localStorage.getItem('sprout-trail-save') || '{}').lang";
        if (!src.includes(guess)) throw new Error('playgama build: the loading screen language guess in index.html changed');
        src = src.replace(guess, 'null');
        src = src.replace('<head>', `<head>\n    <script src="${PLAYGAMA_BRIDGE_CDN}"></script>\n    <script>${playgamaBoot()}</script>`);
        html.source = src;
      },
    },
  };
}

/** the loading screen's failure card in every language (index.html window.__bootFail), from src/i18n/*.json */
function bootStrings(): Plugin {
  return {
    name: 'boot-strings',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const out: Record<string, { loadFailed: string; noWebgl: string; retry: string }> = {};
        for (const f of readdirSync('src/i18n').filter((x) => x.endsWith('.json'))) {
          const d = JSON.parse(readFileSync(`src/i18n/${f}`, 'utf8')) as Record<string, string>;
          out[f.replace('.json', '')] = { loadFailed: d['boot.loadFailed'], noWebgl: d['boot.noWebgl'], retry: d['boot.retry'] };
        }
        if (!html.includes('__BOOT_STRINGS__')) throw new Error('boot-strings: index.html has no __BOOT_STRINGS__');
        return html.replace('__BOOT_STRINGS__', JSON.stringify(out));
      },
    },
  };
}

/** Y8 SDK from Y8's CDN only (docs.y8.com/sdk/intro: `<script src=… async>` in <head>), in the Y8 build only; initialized by src/app/platform/y8.ts */
export const Y8_SDK_CDN = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
function y8Sdk(): Plugin {
  return {
    name: 'y8-sdk',
    transformIndexHtml: { order: 'pre', handler: () => [{ tag: 'script', attrs: { src: Y8_SDK_CDN, async: true }, injectTo: 'head-prepend' }] },
  };
}

export default defineConfig(({ mode }) => {
  const platform = platformFor(mode);
  return {
    base: './',
    plugins: [bootStrings(), ...(platform === 'gamepix' ? [gamepixSdk()] : platform === 'playgama' ? [playgamaBridge()] : platform === 'y8' ? [y8Sdk()] : [])],
    define: { __PLATFORM__: JSON.stringify(platform), __VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version) },
    assetsInclude: ['**/*.glb'],
    build: {
      target: 'es2020',
      outDir: platform === 'crazygames' ? 'dist' : `dist-${platform}`,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1200,
    },
    server: { host: true },
  };
});
