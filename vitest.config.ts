import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'] }, define: { __PLATFORM__: '"web"' } });
