/**
 * CrazyGames SDK v3 wrapper with safe fallbacks (works offline / on other hosts).
 * - gameplayStart/Stop, loadingStart/Stop, happytime
 * - midgame ads (rate-limited to one per ~2 min, only between jobs), rewarded ads
 * - Data Module for saves, mute setting, locale
 */

import { AD_MAX, AD_TIMEOUT, MIDGAME_GAP, loadScript, safe, type AdSlot, type KeyValueStore, type Platform } from './types';

interface CGSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void;
  };
  data?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  user?: { systemInfo?: { locale?: string; countryCode?: string } };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CGSdk };
  }
}

export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames';
  readonly autoResume = false;
  private s: CGSdk | null = null;
  private playing = false;
  private lastMidgame = Date.now(); // no ad right after loading
  private busy = false;
  /** the Data Module works (Progress Save enabled for the game); otherwise saves use localStorage */
  private store: KeyValueStore | null = null;
  private loaded = false;
  private heldGameplay = false;
  /** loadingStart came before the SDK was up (the game calls it first thing): sent right after init */
  private loadingAsked = false;
  muted = false;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};

  async init(timeoutMs = 3500) {
    try {
      if (!window.CrazyGames) await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js', timeoutMs);
      const s = window.CrazyGames?.SDK;
      if (!s) return;
      let to: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([s.init(), new Promise((_, rej) => (to = setTimeout(() => rej(new Error('sdk timeout')), timeoutMs)))]).finally(() => clearTimeout(to));
      if (s.environment === 'disabled') return;
      this.s = s;
      if (this.loadingAsked && !this.loaded) safe(() => s.game.loadingStart());
      // the Data Module throws ({ code: 'dataModuleDisabled' }) on every call when Progress Save is off: probe it once,
      // and never let a later call throw into the game
      const d = s.data;
      if (d && safe(() => (d.getItem('sprout-trail-probe'), true)))
        this.store = {
          getItem: (k) => safe(() => d.getItem(k)) ?? null,
          setItem: (k, v) => void safe(() => d.setItem(k, v)),
        };
      this.muted = !!s.game.settings?.muteAudio;
      s.game.addSettingsChangeListener?.((st) => {
        if (st.muteAudio !== undefined) {
          this.muted = st.muteAudio;
          this.onMute(this.muted);
        }
      });
    } catch {
      this.s = null;
    }
  }

  get available() {
    return !!this.s;
  }
  locale(): string | null {
    return this.s?.user?.systemInfo?.locale ?? null;
  }
  data() {
    return this.store;
  }
  loadingStart() {
    this.loadingAsked = true;
    safe(() => this.s?.game.loadingStart());
  }
  loadingStop() {
    if (this.loaded) return;
    this.loaded = true;
    safe(() => this.s?.game.loadingStop());
    // a gameplayStart that came while loading is sent now, after loadingStop
    if (this.heldGameplay) {
      this.heldGameplay = false;
      safe(() => this.s?.game.gameplayStart());
    }
  }
  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    if (!this.loaded) this.heldGameplay = true;
    else safe(() => this.s?.game.gameplayStart());
  }
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.heldGameplay) this.heldGameplay = false;
    else if (this.loaded) safe(() => this.s?.game.gameplayStop());
  }
  happytime() {
    safe(() => this.s?.game.happytime());
  }

  /**
   * Request an ad and settle exactly once: on adFinished / adError, when requestAd throws, when the ad has not
   * started within AD_TIMEOUT (no fill, blocked, SDK stuck), or AD_MAX after it started (never finished) — so the
   * game never hangs waiting for an ad. One ad at a time.
   */
  private requestAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
    const s = this.s!;
    if (this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let done = false;
      let cap: ReturnType<typeof setTimeout> | undefined;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(cap);
        this.busy = false;
        this.onAdPause(false);
        res(ok);
      };
      const timer = setTimeout(() => finish(false), AD_TIMEOUT);
      try {
        s.ad.requestAd(type, {
          adStarted: () => {
            if (done) return;
            clearTimeout(timer); // the ad is playing: wait for it to finish, at most AD_MAX
            cap = setTimeout(() => finish(false), AD_MAX);
            this.onAdPause(true);
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  }

  /** CrazyGames: midgame ads only in the between-jobs slot (Next / Retry / skip) */
  adSlot(slot: AdSlot) {
    return slot === 'between';
  }

  /** Midgame ad between jobs, at most once per ~2 minutes. Resolves when done, skipped, failed or timed out. */
  async midgame(slot: AdSlot = 'between'): Promise<void> {
    if (!this.adSlot(slot) || !this.s || Date.now() - this.lastMidgame < MIDGAME_GAP) return;
    this.lastMidgame = Date.now();
    await this.requestAd('midgame');
  }

  /** Rewarded ad; resolves true only if the ad completed (false on error / timeout). Always optional for the player. */
  async rewarded(): Promise<boolean> {
    // no SDK (blocked, offline): no ad, no reward (the rewarded buttons are hidden then)
    if (!this.s) return false;
    const ok = await this.requestAd('rewarded');
    // a finished rewarded ad also counts as the midgame break
    if (ok) this.lastMidgame = Date.now();
    return ok;
  }
}
