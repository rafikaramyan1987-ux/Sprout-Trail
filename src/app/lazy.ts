/**
 * Files the game downloads after its main script (the nature models, public/models/nature.glb) are fetched with
 * retries: a request can fail on a flaky connection, and an unhandled failure is an unhandled promise rejection (the
 * portal SDKs report every one as a crash) or a loading screen that never ends. The game has no dynamic `import()`
 * chunks (one main script), so this is the only lazily loaded file; the main script itself is covered by index.html's
 * download watchdog.
 *
 * Every attempt after the first uses a new `?retry=n` URL (a failed request can be cached for the whole page,
 * measured in Chromium for module imports; a new URL is always a fresh request), and every attempt has its own time
 * limit, so a stalled request cannot keep the loading screen up.
 */

/** waits before the retries (ms): `withRetry` tries `RETRY_DELAYS.length + 1` times in all */
export const RETRY_DELAYS = [300, 1200, 3000];
/** one attempt is given up after this long (ms) */
export const ATTEMPT_TIMEOUT = 20_000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `url` with `?retry=n` (or `&retry=n`) for attempt n > 0 */
export function retryUrl(url: string, n: number) {
  return n === 0 ? url : `${url}${url.includes('?') ? '&' : '?'}retry=${n}`;
}

/** `load(url)` with retries and a time limit per attempt; rejects only after every attempt failed (callers handle it) */
export async function withRetry<T>(url: string, load: (url: string) => Promise<T>, delays: number[] = RETRY_DELAYS, timeoutMs = ATTEMPT_TIMEOUT): Promise<T> {
  let err: unknown;
  for (let n = 0; n <= delays.length; n++) {
    if (n > 0) await wait(delays[n - 1]);
    let to: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([load(retryUrl(url, n)), new Promise<never>((_, rej) => (to = setTimeout(() => rej(new Error(`timeout: ${url}`)), timeoutMs)))]);
    } catch (e) {
      err = e;
    } finally {
      clearTimeout(to);
    }
  }
  throw err;
}
