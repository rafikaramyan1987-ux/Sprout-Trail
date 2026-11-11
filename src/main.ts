/**
 * Sprout Trail: boot (loading screen, models, save), the menus and the main loop.
 * `?capture` drives the game frame by frame from Playwright (preview screenshots, video, e2e) via `window.__game`.
 */
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/cyrillic-700.css';
import './ui/style.css';
import { Stage, SPRING } from './render/stage';
import { loadModels } from './render/assets';
import { Play } from './play/play';
import { LEVELS, levelById, nextLevel } from './game/levels';
import { Replay } from './game/bot';
import { controls } from './app/input';
import { prepareMusic, setMusic, setSfx, sfx, startMusic, unlockAudio } from './app/audio';
import { loadSave, persist, recordLevel, resetProgress, save } from './app/save';
import { LANGS, LANG_NAMES, pickLang, setLang, t, getLang, type Lang } from './i18n';
import { el, esc, hide, ico, label, onClick, show, starsHtml, tickMessages, timedRemove, toast } from './ui/ui';
import type { Level } from './game/types';
import type { SimState, Input } from './game/sim';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');

const canvas = document.getElementById('game') as HTMLCanvasElement;
const stage = new Stage(canvas);
stage.setTheme(SPRING);
let play: Play | null = null;
let screen: 'title' | 'play' | 'pause' | 'end' | 'menu' = 'title';

function resize() {
  const w = window.innerWidth,
    h = window.innerHeight;
  stage.resize(w, h, Math.min(window.devicePixelRatio || 1, CAPTURE ? 2 : 2));
}
window.addEventListener('resize', resize);
resize();

const click = () => sfx('click');

/* ------------------------------------------------------------------ levels */

function startLevel(level: Level, frozen = false) {
  play?.dispose();
  hide('title');
  hide('end');
  hide('pause');
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
    void startMusic();
  }
  return play;
}

/** the level the Play / Continue button starts */
function continueLevel(): Level {
  for (const l of LEVELS) if (!save.levels[l.id]?.done) return l;
  return levelById(save.last ?? LEVELS[0].id) ?? LEVELS[0];
}

/* ------------------------------------------------------------------ screens */

function showTitle() {
  screen = 'title';
  controls.enabled = false;
  hide('end');
  hide('pause');
  hide('worlds');
  hide('settings');
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
        <button class="btn wood" data-act="settings">${ico('gear')}${label('menu.settings')}</button>
      </div></div>
    </div>`),
  );
  onClick(n, '[data-act=play]', () => {
    hide('title');
    if (play) {
      play.frozen = false;
      controls.release();
      controls.enabled = true;
      screen = 'play';
      void startMusic();
    }
  }, click);
  onClick(n, '[data-act=worlds]', () => showWorlds(), click);
  onClick(n, '[data-act=daily]', () => toast(t('menu.soon')), click);
  onClick(n, '[data-act=settings]', () => showSettings(), click);
}

function showWorlds() {
  const n = show(
    el(`<div id="worlds" class="screen dim"><div class="panel worlds">
      <h2>${label('menu.worlds')}</h2>
      <div class="tabs">${[1, 2, 3, 4, 5].map((w) => `<button class="tab${w === 1 ? ' on' : ''}" ${w > 1 ? 'disabled' : ''}>${w > 1 ? ico('lock') : ''}${label(`world.${w}`)}</button>`).join('')}</div>
      <div class="grid">${Array.from({ length: 12 }, (_, i) => {
        const lv = LEVELS[i];
        if (!lv) return `<button class="lvl locked" disabled>${ico('lock', 'ico lk')}</button>`;
        const rec = save.levels[lv.id];
        const open = i === 0 || !!save.levels[LEVELS[i - 1].id]?.done;
        if (!open) return `<button class="lvl locked" disabled>${ico('lock', 'ico lk')}</button>`;
        return `<button class="lvl" data-lv="${lv.id}">${lv.n}<span class="st">${starsHtml(rec?.stars ?? 0)}</span></button>`;
      }).join('')}</div>
      <button class="btn wood" data-act="back">${label('back')}</button>
    </div></div>`),
  );
  onClick(n, '[data-lv]', (b) => {
    hide('worlds');
    hide('title');
    startLevel(levelById(b.dataset.lv!)!);
  }, click);
  onClick(n, '[data-act=back]', () => hide('worlds'), click);
}

function showSettings() {
  const n = show(
    el(`<div id="settings" class="screen dim"><div class="panel">
      <h2>${label('settings.title')}</h2>
      <div class="set-row"><span class="lbl">${ico('music')}${label('settings.music')}</span><button class="toggle${save.music ? ' on' : ''}" data-set="music">${label(save.music ? 'settings.on' : 'settings.off')}</button></div>
      <div class="set-row"><span class="lbl">${ico('sound')}${label('settings.sfx')}</span><button class="toggle${save.sfx ? ' on' : ''}" data-set="sfx">${label(save.sfx ? 'settings.on' : 'settings.off')}</button></div>
      <div class="set-row"><span class="lbl">${ico('map')}${label('settings.language')}</span><select class="lang">${LANGS.map((l) => `<option value="${l}" ${l === getLang() ? 'selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}</select></div>
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
    showSettings();
  });
  onClick(n, '[data-act=reset]', () => {
    const c = show(
      el(`<div id="confirm" class="screen dim"><div class="panel"><p>${label('settings.resetAsk')}</p><div class="row">
        <button class="btn danger" data-act="yes">${label('settings.resetYes')}</button><button class="btn" data-act="no">${label('settings.resetNo')}</button></div></div></div>`),
    );
    onClick(c, '[data-act=yes]', () => {
      resetProgress();
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
}

function endPanel(html: string, level: Level, next: Level | null) {
  controls.enabled = false;
  screen = 'end';
  const n = show(el(`<div id="end" class="screen dim"><div class="panel">${html}<div class="col">
      ${next ? `<button class="btn big" data-act="next">${ico('play')}${label('win.next')}</button>` : ''}
      <div class="row"><button class="btn wood" data-act="retry">${ico('retry')}${label('win.retry')}</button>
      <button class="btn wood" data-act="menu">${ico('home')}${label('win.menu')}</button></div></div></div></div>`));
  onClick(n, '[data-act=next]', () => next && startLevel(next), click);
  onClick(n, '[data-act=retry]', () => startLevel(level), click);
  onClick(n, '[data-act=menu]', () => showTitle(), click);
}

function showWin(level: Level, s: SimState, st: number) {
  recordLevel(level.id, { stars: st, acorns: s.acorns, gems: s.gems, done: true });
  const next = nextLevel(level.id);
  endPanel(
    `<h2>${label('win.title')}</h2><div class="stars">${starsHtml(st)}</div>
     <div class="tally">
       ${ico('acorn')}<span>${label('win.acorns')}</span><span class="val">${[0, 1, 2].map((i) => ico(i < s.acorns ? 'acorn' : 'acornEmpty')).join('')}</span>
       ${ico('gem')}<span>${label('win.gems')}</span><span class="val">${s.gems}</span>
       ${level.dps.length ? `${ico('seed')}<span>${label('win.seeds')}</span><span class="val">${s.seeds}</span>` : ''}
     </div>${next ? '' : `<p>${label('win.allDone')}</p>`}`,
    level,
    next,
  );
}

function showLost(level: Level) {
  endPanel(`<h2>${label('lost.title')}</h2><p>${label('lost.text')}</p>`, level, null);
}

function showNoSeeds(level: Level) {
  endPanel(`<h2>${label('seeds.title')}</h2><p>${label('seeds.text')}</p>`, level, null);
}

function applySettings() {
  setMusic(save.music);
  setSfx(save.sfx);
}

/* ------------------------------------------------------------------ loop */

let lastT = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  tick(dt);
  requestAnimationFrame(frame);
}

function tick(dt: number, render = true) {
  play?.update(dt);
  if (!play?.paused) tickMessages(dt);
  stage.update(dt);
  if (render) stage.render();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') pause();
});

/* ------------------------------------------------------------------ boot */

async function boot() {
  const bar = document.querySelector<HTMLElement>('#loading .bar i');
  const setP = (k: number) => bar && (bar.style.width = `${Math.round(k * 100)}%`);
  setP(0.15);
  loadSave();
  setLang(pickLang(save.lang, navigator.language));
  applySettings();
  controls.attach(document.body);
  controls.onAny = () => unlockAudio();
  controls.onGesture = (g) => play?.gesture(g);
  void prepareMusic();
  await Promise.all([
    loadModels(`${import.meta.env.BASE_URL}models/nature.glb`).then(() => setP(0.8)),
    document.fonts?.load('700 40px Fredoka').catch(() => {}),
  ]);
  setP(1);
  showTitle();
  stage.render();
  document.getElementById('loading')?.remove();
  if (CAPTURE) exposeCapture();
  else requestAnimationFrame((t) => {
    lastT = t;
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
  }
}

/** a soft finger mark where a player would touch (preview video) */
function fingerDot(kind: 'tap' | 'swipeDown') {
  const w = window.innerWidth,
    h = window.innerHeight;
  const d = el(`<div class="finger ${kind}" style="left:${Math.round(w * 0.66)}px;top:${Math.round(h * 0.62)}px"></div>`);
  document.getElementById('ui')!.append(d);
  timedRemove(d, kind === 'tap' ? 0.3 : 0.45);
}

function exposeCapture() {
  window.__game = {
    tick: (dt: number, render = true) => tick(dt, render),
    render: () => stage.render(),
    state: () => (play ? { mode: play.sim.mode, x: play.sim.x, y: play.sim.y, level: play.level.id, screen, acorns: play.sim.acorns, gems: play.sim.gems, seeds: play.sim.seeds, finished: play.finished } : null),
    start: (id: string) => startLevel(levelById(id)!),
    /** replay a bot plan in the current level (inputs encoded as in scripts/plan.ts) */
    replay: (inputs: string, choices: string[], think = 1.1) => {
      if (!play) return;
      play.replay = new Replay({ inputs: decodeInputs(inputs), choices: choices as never });
      play.botThink = think;
      play.onBotGesture = (k) => fingerDot(k);
    },
    screen: () => screen,
    sim: () => play?.sim,
    /** put the sprite just before the next decision point (e2e) */
    teleportToDecision: () => {
      if (!play) return;
      const i = play.nextDecision();
      if (i < 0) return;
      const dp = play.level.dps[i];
      Object.assign(play.sim, { x: dp.stopX - 3, y: dp.y, vx: 0, vy: 0, grounded: true });
    },
    lang: (l: string) => setLang(l as Lang),
  };
  window.__ready = true;
}

const SPROUT_SVG =
  '<svg viewBox="0 0 64 64"><path d="M32 60 C31 48 32 40 33 30" stroke="#2f7a1c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M33 32 C18 32 8 22 8 10 C22 10 32 18 33 32Z" fill="#7bd05a" stroke="#2f7a1c" stroke-width="3.5" stroke-linejoin="round"/><path d="M33 26 C44 26 56 18 56 6 C42 6 34 14 33 26Z" fill="#9fe070" stroke="#2f7a1c" stroke-width="3.5" stroke-linejoin="round"/></svg>';

void boot();
