/**
 * Sprout Trail: boot (loading screen, portal SDK, models, save), the menus, ads and the main loop.
 * `?capture` drives the game frame by frame from Playwright (preview shots, videos, e2e) via `window.__game`.
 */
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/cyrillic-700.css';
import './ui/style.css';
import * as THREE from 'three';
import { Stage, SPRING } from './render/stage';
import { forgetLostContext } from './render/dispose';
import { installGuard, report } from './app/guard';
import { loadModels } from './render/assets';
import { Play } from './play/play';
import { dailyLevel, level as levelAt, levelById, LEVEL_IDS, nextLevel, PER_WORLD, specialLevel, WORLDS } from './game/levels';
import { Replay } from './game/bot';
import { controls } from './app/input';
import { prepareMusic, setMusic, setMuted, setSfx, sfx, startMusic, unlockAudio } from './app/audio';
import { currentStreak, loadSave, persist, recordDaily, recordLevel, resetProgress, save, today } from './app/save';
import { buyOrEquip, COLORS, equipped, HATS, owned, type Item } from './app/cosmetics';
import { sdk, type AdSlot } from './app/sdk';
import { LANGS, LANG_NAMES, getLang, onLang, pickLang, setLang, t, type Lang } from './i18n';
import { el, esc, hide, ico, label, onClick, onPress, show, starsHtml, tickMessages, timedRemove, toast } from './ui/ui';
import type { Level } from './game/types';
import type { Input, SimState } from './game/sim';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
/** rewarded ad buttons: portal builds only (never in the web build), and only where the portal's SDK is up and has
 *  rewarded ads (not with an ad blocker; never on GameMonetize, whose SDK has no rewarded API) */
const ads = () => __PLATFORM__ !== 'web' && sdk.available;

// the game's module runs: from here on a failed download is the game's own business (index.html watchdog)
window.__booted = true;
installGuard();

const canvas = document.getElementById('game') as HTMLCanvasElement;
/** created in boot(): without WebGL the loading screen says so instead of throwing here */
let stage!: Stage;
/** the WebGL context is lost (GPU reset, too many contexts): the game pauses until it is restored */
let glLost = false;
let play: Play | null = null;
let screen: 'title' | 'play' | 'pause' | 'end' | 'menu' | 'ad' = 'title';
/** an ad is playing: everything is paused and silent */
let adPaused = false;

function resize() {
  if (!stage) return;
  stage.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', resize);

const click = () => sfx('click');

/* ------------------------------------------------------------------ progress */

const worldDone = (w: number) => !!save.levels[`${w}-${PER_WORLD}`]?.done;
const worldOpen = (w: number) => w === 1 || worldDone(w - 1);
function levelOpen(id: string) {
  const m = /^(\d)-(\d+|S)$/.exec(id);
  if (!m) return true;
  const w = +m[1];
  if (!worldOpen(w)) return false;
  if (m[2] === 'S') return worldDone(w);
  const n = +m[2];
  return n === 1 || !!save.levels[`${w}-${n - 1}`]?.done;
}
const worldStars = (w: number) => Array.from({ length: PER_WORLD }, (_, i) => save.levels[`${w}-${i + 1}`]?.stars ?? 0).reduce((a, b) => a + b, 0);

/** the level the Play / Continue button starts */
function continueLevel(): Level {
  for (const id of LEVEL_IDS) if (!save.levels[id]?.done && levelOpen(id)) return levelById(id)!;
  return levelById(save.last ?? LEVEL_IDS[0]) ?? levelAt(1, 1);
}

/* ------------------------------------------------------------------ levels */

function startLevel(level: Level, frozen = false) {
  play?.dispose();
  for (const id of ['title', 'end', 'pause', 'worlds', 'daily', 'wardrobe', 'settings']) hide(id);
  play = new Play(stage, level, {
    onWin: (s, st) => showWin(level, s, st),
    onLose: () => showLost(level),
    onNoSeeds: () => showNoSeeds(level),
    onPause: () => pause(),
  });
  play.frozen = frozen;
  controls.release();
  controls.enabled = !frozen;
  if (!frozen) {
    screen = 'play';
    sdk.gameplayStart();
    void startMusic();
  }
  return play;
}

/** interstitial at a result-screen break (Next / Retry: `between`, Menu: `menu`), then go on; the platform layer
 *  decides whether one shows (pacing, never during a level) and every request settles (see platform/types.ts) */
async function between(next: () => void, slot: AdSlot = 'between') {
  // a second click while the ad runs does nothing
  if (screen === 'ad') return;
  if (__PLATFORM__ !== 'web' && sdk.adSlot(slot)) {
    screen = 'ad';
    await sdk.midgame(slot);
  }
  next();
}

/** the pre-roll: only from the first Play click of the session (title Play, a level tile or the daily trail) */
let prerollAsked = false;
let prerollBusy = false;
async function firstPlay(go: () => void) {
  // a second click while the pre-roll runs does nothing
  if (prerollBusy) return;
  if (!prerollAsked && __PLATFORM__ !== 'web' && sdk.adSlot('preroll')) {
    prerollBusy = true;
    prerollAsked = true;
    const was = screen;
    screen = 'ad';
    await sdk.midgame('preroll');
    screen = was;
    prerollBusy = false;
  }
  prerollAsked = true;
  go();
}

/** a rewarded ad from a clearly labelled button; `grant` runs only if the ad really completed */
async function rewarded(btn: HTMLElement, grant: () => void) {
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy');
  const ok = await sdk.rewarded();
  btn.classList.remove('busy');
  if (ok) {
    sfx('reward');
    grant();
  } else toast(t('ad.none'), 2500);
}
const adButton = (act: string, key: string) => (ads() ? `<button class="btn ad" data-ad="${act}">${ico('tv')}<span>${label(key)}</span></button>` : '');

/* ------------------------------------------------------------------ screens */

function showTitle() {
  sdk.gameplayStop();
  controls.enabled = false;
  startLevel(continueLevel(), true);
  screen = 'title';
  const started = Object.keys(save.levels).length > 0;
  const n = show(
    el(`<div id="title" class="screen">
      <div class="top"><div class="logo"><span class="sprout">${SPROUT_SVG}</span>${esc(t('title'))}<small>${esc(t('tagline'))}</small></div></div>
      <div class="bottom"><div class="menu">
        <button class="btn big" data-act="play">${ico('play')}${label(started ? 'menu.continue' : 'menu.play')}</button>
        <div class="two">
          <button class="btn wood" data-act="worlds">${ico('map')}${label('menu.worlds')}</button>
          <button class="btn wood" data-act="daily">${ico('calendar')}${label('menu.daily')}</button>
        </div>
        <div class="two">
          <button class="btn wood" data-act="wardrobe">${ico('hat')}${label('menu.wardrobe')}</button>
          <button class="btn wood" data-act="settings">${ico('gear')}${label('menu.settings')}</button>
        </div>
      </div></div>
      <div class="version">v${esc(__VERSION__)}</div>
    </div>`),
  );
  onClick(n, '[data-act=play]', () => void firstPlay(() => {
    hide('title');
    if (play) {
      play.frozen = false;
      play.paused = false;
      controls.release();
      controls.enabled = true;
      screen = 'play';
      sdk.gameplayStart();
      void startMusic();
    }
  }), click);
  onClick(n, '[data-act=worlds]', () => showWorlds(), click);
  onClick(n, '[data-act=daily]', () => showDaily(), click);
  onClick(n, '[data-act=wardrobe]', () => showWardrobe(), click);
  onClick(n, '[data-act=settings]', () => showSettings(), click);
}

let worldTab = 1;
function showWorlds(w = worldTab) {
  worldTab = w;
  const open = worldOpen(w);
  const tiles = Array.from({ length: PER_WORLD }, (_, i) => {
    const id = `${w}-${i + 1}`;
    if (!levelOpen(id)) return `<button class="lvl locked" disabled>${ico('lock', 'ico lk')}</button>`;
    return `<button class="lvl" data-lv="${id}">${i + 1}<span class="st">${starsHtml(save.levels[id]?.stars ?? 0)}</span></button>`;
  }).join('');
  const sp = `${w}-S`;
  const special = levelOpen(sp)
    ? `<button class="btn special" data-lv="${sp}">${ico('star')}${label('world.special')}<span class="st">${starsHtml(save.levels[sp]?.stars ?? 0)}</span></button>`
    : `<button class="btn special locked" disabled>${ico('lock')}${label('world.special')}<small>${label('world.specialLocked')}</small></button>`;
  const n = show(
    el(`<div id="worlds" class="screen dim"><div class="panel worlds">
      <h2>${label('menu.worlds')}</h2>
      <div class="tabs">${Array.from({ length: WORLDS }, (_, k) => k + 1)
        .map((k) => `<button class="tab${k === w ? ' on' : ''}" data-w="${k}">${worldOpen(k) ? k : ico('lock')}</button>`)
        .join('')}</div>
      <div class="wname">${label(`world.${w}`)} <span>${ico('star')}${worldStars(w)}/${PER_WORLD * 3}</span></div>
      ${open ? `<div class="grid">${tiles}</div>${special}` : `<p class="locked-note">${ico('lock')}${label('world.locked')}</p>`}
      <button class="btn wood" data-act="back">${label('back')}</button>
    </div></div>`),
  );
  onClick(n, '[data-w]', (b) => showWorlds(+b.dataset.w!), click);
  onClick(n, '[data-lv]', (b) => void firstPlay(() => startLevel(levelById(b.dataset.lv!)!)), click);
  onClick(n, '[data-act=back]', () => hide('worlds'), click);
}

function showDaily() {
  const day = today();
  const done = save.dailyDay === day;
  const n = show(
    el(`<div id="daily" class="screen dim"><div class="panel">
      <h2>${label('daily.title')}</h2>
      <div class="streak">${ico('calendar')}<b>${label('daily.streak', { n: currentStreak(day) })}</b><span>${label('daily.best', { n: save.bestStreak })}</span></div>
      <p>${label(done ? 'daily.done' : 'daily.text')}</p>
      <div class="col">
        <button class="btn big" data-act="go">${ico('play')}${label(done ? 'daily.again' : 'daily.play')}</button>
        <button class="btn wood" data-act="back">${label('back')}</button>
      </div></div></div>`),
  );
  onClick(n, '[data-act=go]', () => void firstPlay(() => startLevel(dailyLevel(day))), click);
  onClick(n, '[data-act=back]', () => hide('daily'), click);
}

function showWardrobe() {
  const item = (it: Item) => {
    const has = owned(it),
      on = equipped(it);
    const swatch = it.kind === 'color' ? `<span class="swatch" style="background:${it.value}"></span>` : `<span class="hat-ico">${HAT_ART[it.id] ?? ''}</span>`;
    const act = on ? label('wardrobe.equipped') : has ? label('wardrobe.equip') : `${ico('gem', 'ico sm')}${it.price}`;
    return `<button class="item${on ? ' on' : ''}${has ? '' : ' buy'}" data-item="${it.id}">${swatch}<span class="nm">${label(`${it.kind === 'hat' ? 'hat' : 'color'}.${it.id}`)}</span><span class="act">${act}</span></button>`;
  };
  const n = show(
    el(`<div id="wardrobe" class="screen dim"><div class="panel wardrobe">
      <h2>${label('wardrobe.title')}</h2>
      <div class="wallet">${ico('gem')}<b>${save.gems}</b></div>
      <h3>${label('wardrobe.hats')}</h3><div class="items">${HATS.map(item).join('')}</div>
      <h3>${label('wardrobe.colors')}</h3><div class="items">${COLORS.map(item).join('')}</div>
      <button class="btn wood" data-act="back">${label('back')}</button>
    </div></div>`),
  );
  onClick(n, '[data-item]', (b) => {
    const it = [...HATS, ...COLORS].find((x) => x.id === b.dataset.item)!;
    const r = buyOrEquip(it);
    if (r === 'poor') {
      toast(t('wardrobe.poor'), 2000);
      return;
    }
    sfx(r === 'bought' ? 'buy' : 'click');
    if (screen === 'title') startLevel(continueLevel(), true);
    showWardrobe();
  });
  onClick(n, '[data-act=back]', () => hide('wardrobe'), click);
}

function showSettings() {
  const n = show(
    el(`<div id="settings" class="screen dim"><div class="panel">
      <h2>${label('settings.title')}</h2>
      <div class="set-row"><span class="lbl">${ico('music')}${label('settings.music')}</span><button class="toggle${save.music ? ' on' : ''}" data-set="music">${label(save.music ? 'settings.on' : 'settings.off')}</button></div>
      <div class="set-row"><span class="lbl">${ico('sound')}${label('settings.sfx')}</span><button class="toggle${save.sfx ? ' on' : ''}" data-set="sfx">${label(save.sfx ? 'settings.on' : 'settings.off')}</button></div>
      <div class="set-row"><span class="lbl">${ico('globe')}${label('settings.language')}</span><select class="lang">${LANGS.map((l) => `<option value="${l}" ${l === getLang() ? 'selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}</select></div>
      <button class="btn danger" data-act="reset">${label('settings.reset')}</button>
      <button class="btn wood" data-act="back">${label('back')}</button>
    </div></div>`),
  );
  onClick(n, '[data-set]', (b) => {
    const k = b.dataset.set as 'music' | 'sfx';
    save[k] = !save[k];
    persist();
    applySettings();
    showSettings();
  }, click);
  n.querySelector('select')!.addEventListener('change', (e) => {
    save.lang = (e.target as HTMLSelectElement).value;
    persist();
    setLang(save.lang as Lang);
  });
  onClick(n, '[data-act=reset]', () => {
    const c = show(
      el(`<div id="confirm" class="screen dim"><div class="panel"><p>${label('settings.resetAsk')}</p><div class="row">
        <button class="btn danger" data-act="yes">${label('settings.resetYes')}</button><button class="btn" data-act="no">${label('settings.resetNo')}</button></div></div></div>`),
    );
    onClick(c, '[data-act=yes]', () => {
      resetProgress();
      applySettings();
      hide('confirm');
      hide('settings');
      if (screen === 'title') showTitle();
    }, click);
    onClick(c, '[data-act=no]', () => hide('confirm'), click);
  }, click);
  onClick(n, '[data-act=back]', () => hide('settings'), click);
}

function pause() {
  if (!play || screen !== 'play') return;
  play.paused = true;
  controls.enabled = false;
  screen = 'pause';
  sdk.gameplayStop();
  const n = show(
    el(`<div id="pause" class="screen dim"><div class="panel">
      <h2>${label('pause.title')}</h2>
      <div class="col">
        <button class="btn big" data-act="resume">${ico('play')}${label('pause.resume')}</button>
        <button class="btn wood" data-act="restart">${ico('retry')}${label('pause.restart')}</button>
        <button class="btn wood" data-act="settings">${ico('gear')}${label('menu.settings')}</button>
        <button class="btn wood" data-act="menu">${ico('home')}${label('pause.menu')}</button>
      </div></div></div>`),
  );
  onClick(n, '[data-act=resume]', () => resume(), click);
  onClick(n, '[data-act=restart]', () => play && startLevel(play.level), click);
  onClick(n, '[data-act=settings]', () => showSettings(), click);
  onClick(n, '[data-act=menu]', () => showTitle(), click);
}

function resume() {
  hide('pause');
  if (!play) return;
  play.paused = false;
  controls.release();
  controls.enabled = true;
  screen = 'play';
  sdk.gameplayStart();
}

function endPanel(html: string, level: Level, next: Level | null, ads = '') {
  controls.enabled = false;
  screen = 'end';
  sdk.gameplayStop();
  const n = show(
    el(`<div id="end" class="screen dim"><div class="panel">${html}<div class="col">
      ${ads}
      ${next ? `<button class="btn big" data-act="next">${ico('play')}${label('win.next')}</button>` : ''}
      <div class="row"><button class="btn wood" data-act="retry">${ico('retry')}${label('win.retry')}</button>
      <button class="btn wood" data-act="menu">${ico('home')}${label('win.menu')}</button></div></div></div></div>`),
  );
  onClick(n, '[data-act=next]', () => void between(() => next && startLevel(next)), click);
  onClick(n, '[data-act=retry]', () => void between(() => startLevel(level)), click);
  onClick(n, '[data-act=menu]', () => void between(() => (level.daily ? (showTitle(), showDaily()) : (showTitle(), showWorlds(level.world))), 'menu'), click);
  return n;
}

function showWin(level: Level, s: SimState, st: number) {
  recordLevel(level.id, { stars: st, acorns: s.acorns, gems: s.gems, done: true }, s.gems);
  if (level.daily) recordDaily(today());
  sdk.happytime();
  sdk.levelEnd?.(true);
  const next = level.daily || level.special ? null : nextLevel(level.id);
  const n = endPanel(
    `<h2>${label('win.title')}</h2><div class="stars">${starsHtml(st)}</div>
     <div class="tally">
       ${ico('acorn')}<span>${label('win.acorns')}</span><span class="val">${[0, 1, 2].map((i) => ico(i < s.acorns ? 'acorn' : 'acornEmpty')).join('')}</span>
       ${ico('gem')}<span>${label('win.earned')}</span><span class="val" data-earned>${s.gems}</span>
       ${level.dps.length ? `${ico('seed')}<span>${label('win.seeds')}</span><span class="val">${s.seeds}</span>` : ''}
     </div>
     ${level.daily ? `<p class="streak-line">${ico('calendar')}${label('daily.streak', { n: currentStreak(today()) })}</p>` : ''}`,
    level,
    next,
    s.gems > 0 ? adButton('gems', 'ad.gems') : '',
  );
  const b = n.querySelector<HTMLElement>('[data-ad=gems]');
  if (b)
    onPress(b, () => {
    void rewarded(b, () => {
      save.gems += s.gems;
      persist();
      n.querySelector('[data-earned]')!.textContent = String(s.gems * 2);
      b.remove();
      toast(t('ad.doubled'), 1800);
    });
  });
}

function showLost(level: Level) {
  sdk.sadMoment?.('lost');
  sdk.levelEnd?.(false);
  const n = endPanel(`<h2>${label('lost.title')}</h2><p>${label('lost.text')}</p>`, level, null, play?.revived ? '' : adButton('heart', 'ad.heart'));
  const b = n.querySelector<HTMLElement>('[data-ad=heart]');
  if (b)
    onPress(b, () => {
    void rewarded(b, () => {
      hide('end');
      if (!play) return;
      play.revived = true;
      play.paused = false;
      play.reviveWithHeart();
      controls.release();
      controls.enabled = true;
      screen = 'play';
      sdk.gameplayStart();
    });
  });
}

function showNoSeeds(level: Level) {
  const n = endPanel(`<h2>${label('seeds.title')}</h2><p>${label('seeds.text')}</p>`, level, null, adButton('seeds', 'ad.seeds'));
  const b = n.querySelector<HTMLElement>('[data-ad=seeds]');
  if (b)
    onPress(b, () => {
    void rewarded(b, () => {
      hide('end');
      if (!play) return;
      play.paused = false;
      play.addTwoSeeds();
      controls.release();
      controls.enabled = true;
      screen = 'play';
      sdk.gameplayStart();
    });
  });
}

function applySettings() {
  setMusic(save.music);
  setSfx(save.sfx);
}

/** the language changed: rebuild what is on screen */
onLang(() => {
  if (document.getElementById('settings')) {
    const titleUp = screen === 'title';
    if (titleUp) showTitle();
    showSettings();
  }
});

/* ------------------------------------------------------------------ loop */

let lastT = performance.now();
function frame(now: number) {
  // the next frame first: an exception in this one is recorded and the game keeps running
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  try {
    if (!adPaused) tick(dt);
  } catch (e) {
    report('frame', e);
  }
}

function tick(dt: number, render = true) {
  if (glLost) return;
  play?.update(dt);
  if (!play?.paused) tickMessages(dt);
  stage.update(dt);
  if (render) stage.render();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') pause();
});

/* ------------------------------------------------------------------ boot */

/** the WebGL renderer, or null without WebGL (the loading screen then says so) */
function createStage(): boolean {
  try {
    stage = new Stage(canvas);
    stage.setTheme(SPRING);
  } catch (e) {
    report('boot: WebGL', e);
    window.__bootFail?.('webgl');
    return false;
  }
  resize();
  // a lost context (GPU reset, too many contexts on a phone): pause and draw nothing until it is restored
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    glLost = true;
    if (play) play.paused = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    forgetLostContext([stage.scene]);
    glLost = false;
    if (play) play.paused = adPaused || screen !== 'play';
  });
  return true;
}

async function boot() {
  if (!createStage()) return;
  const bar = document.querySelector<HTMLElement>('#loading .bar i');
  let shown = 0.05;
  const setP = (k: number) => {
    shown = Math.max(shown, k);
    if (bar) bar.style.width = `${Math.round(shown * 100)}%`;
  };
  sdk.loadingStart();
  setP(0.1);
  controls.attach(document.body);
  controls.onAny = () => unlockAudio();
  controls.onGesture = (g) => play?.gesture(g);
  sdk.onMute = (m) => setMuted(m || adPaused);
  sdk.onAdPause = (p) => {
    adPaused = p;
    setMuted(p || sdk.muted);
    if (play) play.paused = p || screen !== 'play';
  };
  void prepareMusic();
  const sdkReady = CAPTURE && params.has('nosdk') ? Promise.resolve() : sdk.init(3000);
  await Promise.all([
    sdkReady.then(() => setP(0.3)),
    loadModels(`${import.meta.env.BASE_URL}models/nature.glb`).then(() => setP(0.85)),
    document.fonts?.load('700 40px Fredoka').catch(() => {}),
  ]);
  loadSave(sdk.data());
  setLang(pickLang(save.lang, sdk.locale(), navigator.language));
  setMuted(sdk.muted);
  applySettings();
  setP(1);
  sdk.loadingStop();
  await sdk.ready?.();
  showTitle();
  stage.render();
  document.getElementById('loading')?.remove();
  sdk.gameReady?.();
  try {
    sessionStorage.removeItem('st-reload');
  } catch {
    /* private mode */
  }
  if (CAPTURE) exposeCapture();
  else
    requestAnimationFrame((tm) => {
      lastT = tm;
      requestAnimationFrame(frame);
    });
}

/* ------------------------------------------------------------------ capture API (Playwright) */

function decodeInputs(s: string): Input[] {
  return [...s].map((c) => {
    const b = c.charCodeAt(0) - 65;
    return { jumpPressed: !!(b & 1), jumpHeld: !!(b & 2), duckPressed: !!(b & 4), duckHeld: !!(b & 8) };
  });
}

declare global {
  interface Window {
    __ready?: boolean;
    __game?: unknown;
    /** set once the game module runs (index.html's download watchdog stops then) */
    __booted?: boolean;
    /** index.html: show the loading screen's failure card ('load' | 'webgl') */
    __bootFail?: (kind: 'load' | 'webgl') => void;
  }
}

/** a soft finger mark where a player would touch (preview videos) */
function fingerDot(kind: 'tap' | 'swipeDown') {
  const d = el(`<div class="finger ${kind}" style="left:${Math.round(window.innerWidth * 0.66)}px;top:${Math.round(window.innerHeight * 0.62)}px"></div>`);
  document.getElementById('ui')!.append(d);
  timedRemove(d, kind === 'tap' ? 0.3 : 0.45);
}

function exposeCapture() {
  window.__game = {
    tick: (dt: number, render = true) => tick(dt, render),
    render: () => stage.render(),
    state: () =>
      play
        ? { mode: play.sim.mode, x: play.sim.x, y: play.sim.y, level: play.level.id, screen, acorns: play.sim.acorns, gems: play.sim.gems, seeds: play.sim.seeds, hearts: play.sim.hearts, speed: play.sim.speed, finished: play.finished }
        : null,
    start: (id: string) => startLevel(levelById(id)!),
    special: (w: number) => startLevel(specialLevel(w)),
    replay: (inputs: string, choices: string[], think = 1.1, dots = true) => {
      if (!play) return;
      play.replay = new Replay({ inputs: decodeInputs(inputs), choices: choices as never });
      play.botThink = think;
      play.onBotGesture = dots ? (k) => fingerDot(k) : null;
    },
    screen: () => screen,
    sim: () => play?.sim,
    level: () => play?.level,
    lastInput: () => play?.lastInput,
    /** GPU objects alive (geometries, textures, shader programs): a finished level must free its own (zero-errors tests) */
    gpu: () => ({ ...stage.renderer.info.memory, programs: stage.renderer.info.programs?.length ?? 0 }),
    /** the world x range the real camera shows at the trail (z = 0), at height y (playtest) */
    view: (y: number) => {
      const cam = stage.camera;
      cam.updateMatrixWorld();
      const at = (sx: number) => {
        // the ray through the screen point (sx, the row of height y) meets the trail plane z = 0
        const p = new THREE.Vector3(0, y, 0).project(cam);
        const a = new THREE.Vector3(sx, p.y, -1).unproject(cam);
        const b = new THREE.Vector3(sx, p.y, 1).unproject(cam);
        const k = a.z / (a.z - b.z);
        return a.x + (b.x - a.x) * k;
      };
      return { left: at(-1), right: at(1) };
    },
    /** screen position (0..1) of a world point on the trail (playtest) */
    screenOf: (x: number, y: number) => {
      const p = new THREE.Vector3(x, y, 0).project(stage.camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
    },
    save: () => save,
    setSave: (patch: Partial<typeof save>) => {
      Object.assign(save, patch);
      persist();
    },
    title: () => showTitle(),
    showWorlds: (w: number) => showWorlds(w),
    showDaily: () => showDaily(),
    showWardrobe: () => showWardrobe(),
    showSettings: () => showSettings(),
    /** put the sprite just before the next decision point (e2e) */
    teleportToDecision: () => {
      if (!play) return;
      const i = play.nextDecision();
      if (i < 0) return;
      const dp = play.level.dps[i];
      Object.assign(play.sim, { x: dp.stopX - 3, y: dp.y, vx: 0, vy: 0, grounded: true });
    },
    lose: () => play?.forceLose(),
    lang: (l: string) => setLang(l as Lang),
    /** store art: hide the HUD and cards, show the big logo at the bottom (the top-left corner stays clear) */
    cover: (on: boolean, zoom = 0.62) => {
      document.body.classList.toggle('cover', on);
      if (play) play.coverZoom = on ? zoom : 0;
      document.getElementById('cover-logo')?.remove();
      if (on) document.getElementById('ui')!.append(el(`<div id="cover-logo" class="logo">${esc(t('title'))}<small>${esc(t('tagline'))}</small></div>`));
    },
    platform: __PLATFORM__,
  };
  window.__ready = true;
}

const SPROUT_SVG =
  '<svg viewBox="0 0 64 64"><path d="M32 60 C31 48 32 40 33 30" stroke="#2f7a1c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M33 32 C18 32 8 22 8 10 C22 10 32 18 33 32Z" fill="#7bd05a" stroke="#2f7a1c" stroke-width="3.5" stroke-linejoin="round"/><path d="M33 26 C44 26 56 18 56 6 C42 6 34 14 33 26Z" fill="#9fe070" stroke="#2f7a1c" stroke-width="3.5" stroke-linejoin="round"/></svg>';

/** small pictures of the hats for the wardrobe */
const HAT_ART: Record<string, string> = {
  none: '<svg viewBox="0 0 64 64"><circle cx="32" cy="36" r="20" fill="#9fd66b" stroke="#2f7a1c" stroke-width="3"/></svg>',
  acorn: '<svg viewBox="0 0 64 64"><path d="M10 40 C10 22 22 14 32 14 C42 14 54 22 54 40Z" fill="#9a6a3a" stroke="#5a3a20" stroke-width="3"/><path d="M36 14 L42 6" stroke="#5a3a20" stroke-width="4"/></svg>',
  flower: '<svg viewBox="0 0 64 64">' + [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${32 + Math.cos(i) * 14}" cy="${32 + Math.sin(i) * 14}" r="9" fill="#ff8fc0"/>`).join('') + '<circle cx="32" cy="32" r="8" fill="#ffd23a"/></svg>',
  bow: '<svg viewBox="0 0 64 64"><path d="M32 32 L8 18 L8 46Z M32 32 L56 18 L56 46Z" fill="#7fb8ff" stroke="#3a6fc0" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="#5a8fe0"/></svg>',
  mushroom: '<svg viewBox="0 0 64 64"><path d="M6 40 C6 18 22 10 32 10 C42 10 58 18 58 40Z" fill="#ff6b6b" stroke="#a8243c" stroke-width="3"/><circle cx="24" cy="24" r="5" fill="#fff"/><circle cx="40" cy="28" r="4" fill="#fff"/></svg>',
  straw: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="42" rx="28" ry="7" fill="#f0cf7a" stroke="#b08a3a" stroke-width="3"/><path d="M18 42 C18 24 46 24 46 42Z" fill="#f0cf7a" stroke="#b08a3a" stroke-width="3"/><path d="M18 38 H46" stroke="#e0566a" stroke-width="5"/></svg>',
  crown: '<svg viewBox="0 0 64 64"><path d="M8 46 L12 18 L24 32 L32 12 L40 32 L52 18 L56 46Z" fill="#7bd05a" stroke="#2f7a1c" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="38" r="4" fill="#ffd23a"/></svg>',
};

boot().catch((e) => {
  // never an unhandled rejection, never a loading screen that waits forever
  report('boot', e);
  window.__bootFail?.('load');
});
