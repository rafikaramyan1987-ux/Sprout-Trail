import { defineConfig } from 'vite';

const PLATFORMS = ['crazygames', 'gd', 'web', 'gamepix', 'playgama'] as const;
type PlatformName = (typeof PLATFORMS)[number];

/**
 * Build target portal: `VITE_PLATFORM=crazygames|gd|web|gamepix|playgama`, or `--mode <platform>`; default
 * CrazyGames. The CrazyGames build goes to dist/, the others to dist-<platform>/. (Phase B adds the portal SDKs.)
 */
function platformFor(mode: string): PlatformName {
  const p = process.env.VITE_PLATFORM || (PLATFORMS.includes(mode as PlatformName) ? mode : 'crazygames');
  if (!PLATFORMS.includes(p as PlatformName)) throw new Error(`unknown VITE_PLATFORM "${p}" (crazygames | gd | web | gamepix | playgama)`);
  return p as PlatformName;
}

export default defineConfig(({ mode }) => {
  const platform = platformFor(mode);
  return {
    base: './',
    define: { __PLATFORM__: JSON.stringify(platform) },
    build: {
      target: 'es2020',
      outDir: platform === 'crazygames' ? 'dist' : `dist-${platform}`,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1200,
    },
    server: { host: true },
  };
});
