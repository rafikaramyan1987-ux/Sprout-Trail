/**
 * Last-resort error record. The real fixes are at each source (docs/robustness.md); this only makes sure
 * that whatever is still left is visible and never stops the game:
 * - uncaught errors and unhandled rejections are recorded and logged once, NOT suppressed (the portal SDKs still
 *   see them, e.g. the CrazyGames SDK reports them as crashes)
 * - the frame loop survives an exception in one frame (`report()` from main.ts): logged, recorded, next frame runs
 * `window.__errors` is what the zero-errors e2e suite (tests/e2e-crash) checks.
 */

declare global {
  interface Window {
    __errors?: string[];
  }
}

const seen = new Set<string>();

function text(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** record + log a caught error once per distinct message (the game keeps running) */
export function report(where: string, e: unknown) {
  const msg = `${where}: ${text(e)}`;
  (window.__errors ??= []).push(msg);
  if (seen.has(msg)) return;
  seen.add(msg);
  console.error('[sprout-trail]', msg, e instanceof Error ? e.stack : '');
}

export function installGuard() {
  window.__errors ??= [];
  window.addEventListener('error', (e) => {
    // resource load errors (img / script tags) do not bubble here; this is a script error
    (window.__errors ??= []).push(`error: ${e.message || text(e.error)}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    (window.__errors ??= []).push(`unhandledrejection: ${text(e.reason)}`);
  });
}
