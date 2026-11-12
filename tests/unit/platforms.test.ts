/**
 * The release changes to the existing portal adapters: the real GameDistribution ID, the AD_MAX upper bound on every
 * ad (a started ad that never ends cannot leave the game paused), CrazyGames (no free reward without the SDK, the Data
 * Module probe, gameplayStart after loadingStop) and Playgama (game_ready before any gameplay message, Bridge from the
 * CDN boot).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GDPlatform, GD_GAME_ID } from '../../src/app/platform/gd';
import { CrazyGamesPlatform } from '../../src/app/platform/crazygames';
import { GamePixPlatform } from '../../src/app/platform/gamepix';
import { PlaygamaPlatform, type BridgeSdk } from '../../src/app/platform/playgama';
import { AD_MAX, AD_TIMEOUT } from '../../src/app/platform/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GameDistribution', () => {
  it('carries the real game ID (not the placeholder)', () => {
    expect(GD_GAME_ID).toBe('cc966171a12a4fa68ea6b94b0bf1f757');
    expect(GD_GAME_ID).not.toMatch(/^0+$/);
  });

  it('pre-roll only once from Play; SDK_GAME_PAUSE pauses + mutes, SDK_GAME_START resumes; a stuck ad ends after AD_MAX', async () => {
    const gd = new GDPlatform();
    const log: string[] = [];
    gd.onAdPause = (p) => log.push(p ? 'pause' : 'resume');
    gd.onMute = (m) => log.push(m ? 'mute' : 'unmute');
    const showAd = vi.fn(() => {
      gd.onEvent({ name: 'SDK_GAME_PAUSE' });
      return new Promise(() => {}); // never answers
    });
    vi.stubGlobal('window', { gdsdk: { showAd } });
    let done = false;
    void gd.midgame('preroll').then(() => (done = true));
    expect(log).toEqual(['mute', 'pause']);
    // the pre-roll is not shown a second time
    await gd.midgame('preroll');
    expect(showAd).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(AD_MAX - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(log).toEqual(['mute', 'pause', 'unmute', 'resume']);
  });

  it('SDK_GAME_START resumes and settles the interstitial', async () => {
    const gd = new GDPlatform();
    const log: string[] = [];
    gd.onAdPause = (p) => log.push(p ? 'pause' : 'resume');
    vi.stubGlobal('window', {
      gdsdk: {
        showAd: () => {
          gd.onEvent({ name: 'SDK_GAME_PAUSE' });
          setTimeout(() => gd.onEvent({ name: 'SDK_GAME_START' }), 500);
          return new Promise(() => {});
        },
      },
    });
    let done = false;
    void gd.midgame('preroll').then(() => (done = true));
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(true);
    expect(log).toEqual(['pause', 'resume']);
  });
});

describe('CrazyGames', () => {
  const sdk = (opts: { dataThrows?: boolean; ad?: (cb: { adStarted?: () => void; adFinished?: () => void }) => void } = {}) => {
    const calls: string[] = [];
    const thrower = () => {
      throw { code: 'dataModuleDisabled' };
    };
    const s = {
      init: async () => {},
      environment: 'crazygames',
      game: {
        gameplayStart: () => calls.push('gameplayStart'),
        gameplayStop: () => calls.push('gameplayStop'),
        loadingStart: () => calls.push('loadingStart'),
        loadingStop: () => calls.push('loadingStop'),
        happytime: () => {},
      },
      ad: { requestAd: (_t: string, cb: { adStarted?: () => void; adFinished?: () => void }) => opts.ad?.(cb) },
      data: opts.dataThrows ? { getItem: thrower, setItem: thrower, removeItem: thrower } : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    };
    vi.stubGlobal('window', { CrazyGames: { SDK: s } });
    return { calls };
  };

  it('no SDK (blocked): no reward and no rewarded buttons', async () => {
    vi.stubGlobal('window', {});
    const cg = new CrazyGamesPlatform();
    expect(cg.available).toBe(false);
    expect(await cg.rewarded()).toBe(false);
  });

  it('a Data Module that throws (Progress Save off) falls back to localStorage (data() = null); a working one is used', async () => {
    sdk({ dataThrows: true });
    const a = new CrazyGamesPlatform();
    await a.init(1000);
    expect(a.data()).toBeNull();
    sdk();
    const b = new CrazyGamesPlatform();
    await b.init(1000);
    expect(b.data()).not.toBeNull();
  });

  it('gameplayStart while loading is sent after loadingStop', async () => {
    const { calls } = sdk();
    const cg = new CrazyGamesPlatform();
    await cg.init(1000);
    cg.loadingStart();
    cg.gameplayStart();
    cg.loadingStop();
    expect(calls).toEqual(['loadingStart', 'loadingStop', 'gameplayStart']);
  });

  it('a started ad that never finishes settles after AD_MAX; one ad at a time', async () => {
    sdk({ ad: (cb) => cb.adStarted?.() });
    const cg = new CrazyGamesPlatform();
    await cg.init(1000);
    const log: boolean[] = [];
    cg.onAdPause = (p) => log.push(p);
    let r: boolean | null = null;
    void cg.rewarded().then((v) => (r = v));
    expect(await cg.rewarded()).toBe(false); // a second request while one runs
    await vi.advanceTimersByTimeAsync(AD_MAX);
    expect(r).toBe(false);
    expect(log).toEqual([true, false]);
  });
});

describe('GamePix', () => {
  it('a started ad that never answers settles after AD_MAX (the game resumes)', async () => {
    const gp = new GamePixPlatform();
    const g = gp as unknown as { s: unknown; loaded: boolean; onPause(): void; paused: boolean };
    g.s = { ads: { reward: () => (setTimeout(() => g.onPause(), 100), new Promise(() => {})), interstitial: () => new Promise(() => {}) } };
    g.loaded = true;
    let r: boolean | null = null;
    void gp.rewarded().then((v) => (r = v));
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT + 1000);
    expect(r).toBeNull(); // started: longer than the "not started" timeout
    await vi.advanceTimersByTimeAsync(AD_MAX);
    expect(r).toBe(false);
  });
});

describe('Playgama', () => {
  function bridge() {
    const sent: string[] = [];
    const b = {
      initialize: async () => {},
      EVENT_NAME: { INTERSTITIAL_STATE_CHANGED: 'i', REWARDED_STATE_CHANGED: 'r', AUDIO_STATE_CHANGED: 'a', PAUSE_STATE_CHANGED: 'p' },
      platform: { id: 'mock', language: 'en', isAudioEnabled: true, sendMessage: (m: string) => (sent.push(m), Promise.resolve()), on: () => {} },
      advertisement: { isInterstitialSupported: true, isRewardedSupported: false, showInterstitial: () => {}, showRewarded: () => {}, on: () => {} },
      storage: { get: async () => [null], set: async () => {} },
    } as unknown as BridgeSdk;
    vi.stubGlobal('window', { bridge: b, __playgamaBridgeInit: Promise.resolve(null) });
    vi.stubGlobal('document', { addEventListener: () => {}, documentElement: { style: { setProperty: () => {} } }, hidden: false });
    return sent;
  }

  it('game_ready is the first message: gameplay messages before it are held and sent right after it', async () => {
    const sent = bridge();
    const pg = new PlaygamaPlatform();
    await pg.init();
    pg.gameplayStart();
    expect(sent).toEqual([]);
    pg.gameReady();
    expect(sent).toEqual(['game_ready', 'level_started']);
    pg.levelEnd(true);
    expect(sent).toEqual(['game_ready', 'level_started', 'level_completed']);
  });

  it('no interstitial before the first level has ended, never a pre-roll; rewarded hidden where Bridge has none', async () => {
    bridge();
    const pg = new PlaygamaPlatform();
    await pg.init();
    expect(pg.adSlot('preroll')).toBe(false);
    expect(pg.available).toBe(false);
  });
});
