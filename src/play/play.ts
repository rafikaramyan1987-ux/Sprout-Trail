/**
 * One level being played: runs the simulation at a fixed 60 Hz, feeds it the player's input (or a bot replay),
 * keeps the 3D scene, camera, sounds, particles, HUD and the seed cards in step with it.
 */
import * as P from '../game/physics';
import { addSeeds, choose, newSim, nextDp, revive, step, stars, type Input, type SimState } from '../game/sim';
import type { Level, PlantKind } from '../game/types';
import type { Replay } from '../game/bot';
import { controls } from '../app/input';
import { sfx } from '../app/audio';
import { t } from '../i18n';
import { Fx } from '../render/fx';
import * as THREE from 'three';
import { leafShapeGeo, makePlant, type PlantView } from '../render/plants';
import { themeFor } from '../render/themes';
import { variantOf } from '../render/variants';
import { buildPieces, dandelion, type PiecesView } from '../render/pieces';
import { cosmetics } from '../app/cosmetics';
import { Sprite } from '../render/sprite';
import type { Stage } from '../render/stage';
import { buildWorld, signText, touchFirst, type WorldView } from '../render/world';
import { bubble, el, esc, ico, onPress, timedClass, timedRemove, toast, ui } from '../ui/ui';
import { PLANT_ART } from '../ui/icons';
import { dpFrame, keepAhead } from './camera';

export interface PlayHooks {
  onWin(s: SimState, stars: number): void;
  onLose(s: SimState): void;
  onNoSeeds(s: SimState): void;
  onPause(): void;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class Play {
  readonly sim: SimState;
  private world: WorldView;
  private sprite = new Sprite();
  private fx: Fx;
  private plantViews: { dp: number; view: PlantView; at: number }[] = [];
  private acc = 0;
  private prevX: number;
  private prevY: number;
  private phase = 0;
  private squash = 0;
  private shake = 0;
  private time = 0;
  private cam = { x: 0, y: 0, w: 11, sx: 0.3, sy: 0.4, init: false };
  private camGroundY = 0;
  private hud: HTMLElement;
  private dpSheet: HTMLElement | null = null;
  private usedCards = new Set<string>();
  private hand: HTMLElement | null = null;
  private handSign = -1;
  private handDone = new Set<number>();
  private ended = false;
  private endT = 0;
  paused = false;
  /** bot replay instead of the player's input (preview video, autoplay) */
  replay: Replay | null = null;
  /** seconds a bot waits at the cards before choosing */
  botThink = 1.1;
  private botT = 0;
  private hitStop = 0;
  private pieces!: PiecesView;
  private vignette!: HTMLElement;
  private placeShown = 0;
  private glideSeed = dandelion(0.8);
  private glideLeaf = (() => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(leafShapeGeo(1.3, 0.75), new THREE.MeshStandardMaterial({ color: '#5fbf45', side: THREE.DoubleSide, roughness: 0.6 }));
    m.rotation.x = -Math.PI / 2 + 0.75;
    m.position.z = -0.6;
    m.castShadow = true;
    g.add(m);
    g.rotation.y = -Math.PI / 2 + 0.5;
    return g;
  })();
  private won = false;
  private noSeeds = false;
  /** the "continue with 1 heart" reward was used in this run (offered once) */
  revived = false;
  /** store art: tighter framing around the sprite */
  coverZoom = 0;
  /** render only (title screen behind the menu) */
  frozen = false;

  constructor(
    private stage: Stage,
    readonly level: Level,
    private hooks: PlayHooks,
  ) {
    this.sim = newSim(level);
    this.prevX = this.sim.x;
    this.prevY = this.sim.y;
    this.camGroundY = this.sim.y;
    stage.world.clear();
    const th = themeFor(level.world);
    const v0 = variantOf(level.world, level.scenery[0]?.variant ?? '');
    stage.setTheme(v0.stage ?? th.stage);
    stage.setAmbient(v0.ambient ?? th.ambient);
    this.world = buildWorld(level);
    this.pieces = buildPieces(level);
    this.world.root.add(this.pieces.root);
    this.vignette = el('<div id="vignette"></div>');
    ui().prepend(this.vignette);
    this.titleCard();
    this.sprite.setColor(cosmetics.color);
    this.sprite.setHat(cosmetics.hat);
    stage.world.add(this.world.root, this.sprite.root, this.sprite.shadow);
    this.fx = new Fx(stage.fx);
    this.fx.clear();
    this.hud = this.buildHud();
    ui().append(this.hud);
    this.updateHud(true);
  }

  dispose() {
    this.hud.remove();
    this.vignette.remove();
    document.getElementById('titlecard')?.remove();
    this.stage.lamp.intensity = 0;
    this.dpSheet?.remove();
    this.hand?.remove();
    document.querySelectorAll('.bubble').forEach((b) => b.remove());
    this.fx.clear();
    this.stage.world.clear();
  }

  /* --------------------------------------------------------------- HUD */

  private buildHud() {
    const h = el(`<div id="hud">
      <div class="hud-left">
        <div class="pill" data-hearts></div>
        <div class="pill" data-gems>${ico('gem')}<b data-v>0</b></div>
      </div>
      <div class="progress"><i></i><b></b></div>
      <div class="hud-right">
        <div class="hud-row">
          <div class="pill" data-acorns></div>
          <button class="btn wood" id="btn-pause" aria-label="${esc(t('pause.title'))}">${ICON_PAUSE}</button>
        </div>
        <div class="pill" data-seeds>${ico('seed')}<b data-v>0</b></div>
      </div>
    </div>`);
    onPress(h.querySelector<HTMLElement>('#btn-pause')!, () => {
      sfx('click');
      this.hooks.onPause();
    });
    return h;
  }

  private last = { hearts: -1, gems: -1, acorns: -1, seeds: -1 };
  private updateHud(force = false) {
    const s = this.sim;
    const q = (k: string) => this.hud.querySelector<HTMLElement>(`[data-${k}]`)!;
    const bump = (n: HTMLElement) => {
      n.classList.remove('bump');
      void n.offsetWidth;
      n.classList.add('bump');
    };
    if (force || s.hearts !== this.last.hearts) {
      q('hearts').innerHTML = [0, 1, 2].map((i) => ico(i < s.hearts ? 'heart' : 'heartEmpty')).join('');
      if (!force) bump(q('hearts'));
    }
    if (force || s.gems !== this.last.gems) {
      q('gems').querySelector('[data-v]')!.textContent = String(s.gems);
      if (!force) bump(q('gems'));
    }
    if (force || s.acorns !== this.last.acorns) {
      q('acorns').innerHTML = [0, 1, 2].map((i) => ico(i < s.acorns ? 'acorn' : 'acornEmpty')).join('');
      if (!force) bump(q('acorns'));
    }
    if (force || s.seeds !== this.last.seeds) {
      q('seeds').querySelector('[data-v]')!.textContent = String(s.seeds);
      q('seeds').classList.toggle('hidden', this.level.dps.length === 0);
      if (!force) bump(q('seeds'));
    }
    this.last = { hearts: s.hearts, gems: s.gems, acorns: s.acorns, seeds: s.seeds };
    const k = Math.max(0, Math.min(1, (s.x - this.level.startX) / (this.level.goalX - this.level.startX)));
    (this.hud.querySelector('.progress i') as HTMLElement).style.width = `${k * 100}%`;
    (this.hud.querySelector('.progress b') as HTMLElement).style.left = `${k * 100}%`;
  }

  /* --------------------------------------------------------------- decision cards */

  private showCards() {
    const s = this.sim;
    const dp = this.level.dps[s.dp];
    this.dpSheet?.remove();
    this.dpSheet = null;
    if (s.seeds <= 0) {
      if (!this.noSeeds) this.hooks.onNoSeeds(s);
      this.noSeeds = true;
      return;
    }
    const cards = dp.cards
      .map((k) => {
        const used = this.usedCards.has(`${s.dp}:${k}`);
        return `<button class="card${used ? ' used' : ''}" data-plant="${k}" ${used ? 'disabled' : ''}>
          <span class="art">${PLANT_ART[k]}</span><span class="name">${esc(t(`plant.${k}`))}</span></button>`;
      })
      .join('');
    this.dpSheet = el(`<div id="dp" class="ui-block">
      <div class="dp-prompt"><span>${esc(t('dp.prompt'))}</span><span class="seeds">${ico('seed')}${s.seeds}</span></div>
      <div class="cards">${cards}</div></div>`);
    this.dpSheet.querySelectorAll<HTMLButtonElement>('.card').forEach((b) =>
      onPress(b, () => {
        if (this.replay) return;
        this.pick(b.dataset.plant as PlantKind);
      }),
    );
    ui().append(this.dpSheet);
  }

  pick(kind: PlantKind) {
    const s = this.sim;
    if (s.mode !== 'decide') return;
    // the events of the last tick were handled already: only the planting's own events are new (a card picked in
    // the same frame the sprite stopped would otherwise handle 'dpStop' again and, with the last seed planted,
    // show the "out of seeds" screen)
    s.events.length = 0;
    const card = this.dpSheet?.querySelector<HTMLElement>(`[data-plant="${kind}"]`);
    card?.classList.add('picked');
    sfx('card');
    if (choose(this.level, s, kind)) {
      this.usedCards.add(`${s.dp}:${kind}`);
      this.handleEvents();
    }
  }

  /* --------------------------------------------------------------- loop */

  /** the input of the last simulation tick (playtest traces) */
  lastInput: Input | null = null;
  /** the bot pressed something (the preview video draws a finger dot) */
  onBotGesture: ((kind: 'tap' | 'swipeDown') => void) | null = null;

  private input(): Input {
    if (this.replay) {
      const i = this.replay.input(this.sim);
      if (i.jumpPressed) this.onBotGesture?.('tap');
      if (i.duckPressed) this.onBotGesture?.('swipeDown');
      return i;
    }
    return controls.sample();
  }

  /** advance by dt seconds of real (or captured) time */
  update(dt: number) {
    if (this.paused) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.hud.classList.toggle('hidden', this.frozen);
    if (this.frozen) {
      this.render(dt);
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
    } else {
      this.acc += dt;
      while (this.acc >= P.DT) {
        this.acc -= P.DT;
        this.prevX = this.sim.x;
        this.prevY = this.sim.y;
        const inp = this.input();
        this.lastInput = inp;
        step(this.level, this.sim, inp);
        this.handleEvents();
        if (this.ended) break;
      }
    }
    // bot at the cards
    if (this.replay && this.sim.mode === 'decide' && this.dpSheet) {
      this.botT += dt;
      if (this.botT > this.botThink) {
        this.botT = 0;
        const k = this.replay.choice();
        if (k) this.pick(k);
      }
    } else this.botT = 0;
    if (this.ended) {
      this.endT += dt;
      if (this.endT > (this.won ? 1.6 : 1.1) && this.endT - dt <= (this.won ? 1.6 : 1.1)) {
        if (this.won) this.hooks.onWin(this.sim, stars(this.level, this.sim));
        else this.hooks.onLose(this.sim);
      }
    }
    this.render(dt);
  }

  private handleEvents() {
    const s = this.sim;
    for (const e of s.events) {
      switch (e) {
        case 'jump':
          sfx('jump');
          this.fx.dust(s.x, s.y, 4, 0.6);
          break;
        case 'land':
          if (s.landV > 6) {
            this.squash = Math.min(1, s.landV / 18);
            this.fx.dust(s.x, s.y, s.landV > 12 ? 10 : 5);
            sfx('land');
          }
          break;
        case 'duck':
          sfx('duck');
          if (s.grounded) this.fx.dust(s.x - 0.3, s.y, 5, 0.8);
          break;
        case 'gem': {
          const p = this.level.pickups[s.lastPickup];
          sfx('gem');
          this.fx.sparkle(p.x, p.y, '#9ff0ff', 8);
          break;
        }
        case 'acorn': {
          const p = this.level.pickups[s.lastPickup];
          sfx('acorn');
          this.fx.sparkle(p.x, p.y, '#ffe27a', 22);
          this.world.hidePickup(s.lastPickup);
          break;
        }
        case 'hit':
          sfx('hit');
          this.shake = 0.35;
          break;
        case 'stomp': {
          sfx('stomp');
          const en = this.level.enemies[s.lastEnemy];
          this.fx.dust(s.x, en.y + 0.3, 10, 1.2);
          this.fx.sparkle(s.x, en.y + 0.5, '#fff0a0', 8);
          this.hitStop = 0.06;
          break;
        }
        case 'fall':
          sfx('fall');
          break;
        case 'die':
          // every death: one heart (the HUD flashes), an "ouch", the camera jumps back to the checkpoint
          sfx('ouch');
          this.shake = 0.3;
          this.cam.init = false;
          {
            const h = this.hud.querySelector<HTMLElement>('[data-hearts]')!;
            h.classList.remove('hurt');
            void h.offsetWidth;
            h.classList.add('hurt');
          }
          break;
        case 'respawn':
          // a puff where the sprite comes back
          this.fx.dust(s.x, s.y, 16, 1.4);
          this.fx.sparkle(s.x, s.y + 0.8, '#ffffff', 14);
          this.prevX = s.x;
          this.prevY = s.y;
          break;
        case 'checkpoint':
          sfx('checkpoint');
          {
            const c = this.level.checkpoints[s.cp];
            this.fx.sparkle(c.x, c.y + 1.7, '#ffb8e0', 12);
          }
          break;
        case 'dpStop':
          sfx('stop');
          this.showCards();
          break;
        case 'plant': {
          this.dpSheet?.classList.add('hidden');
          const p = s.plants[s.plants.length - 1];
          const view = makePlant(p.kind);
          view.root.position.set(p.x, p.y, 0);
          view.grow(0);
          this.world.root.add(view.root);
          this.plantViews.push({ dp: p.dp, view, at: this.time });
          sfx('grow');
          this.fx.magic(p.x + (p.kind === 'bridge' ? 2.5 : 0), p.y, p.kind === 'vine' ? 5 : 1.2);
          this.fx.leaves(p.x, p.y + 0.2, 10);
          break;
        }
        case 'grab':
          sfx('grab');
          break;
        case 'release':
          sfx('jump');
          break;
        case 'croc':
          sfx('splash');
          {
            const w = this.level.water.find((q) => s.deathX >= q.x0 && s.deathX <= q.x1);
            this.fx.splash(s.deathX, w ? w.y : s.deathY);
          }
          bubble(t('piece.crocBite'), false, 1600);
          this.shake = 0.35;
          break;
        case 'boar':
          sfx('boar');
          bubble(t('piece.chaseGo'), false, 1600);
          break;
        case 'boarStop':
          sfx('checkpoint');
          break;
        case 'crack':
          sfx('crack');
          this.shake = 0.25;
          break;
        case 'sink':
          sfx('duck');
          break;
        case 'bounce':
          if (s.mode === 'run') this.pieces.squish(s.lastEnemy);
          sfx('bounce');
          this.plantViews[this.plantViews.length - 1]?.view.poke();
          this.squash = 0.8;
          break;
        case 'climb':
          sfx('climb');
          break;
        case 'hop':
          if (this.plantViews.length && s.plants[s.plants.length - 1]?.kind === 'log') sfx('jump');
          break;
        case 'glide':
          sfx('glide');
          break;
        case 'roll':
          sfx('roll');
          break;
        case 'speed':
          speedToast();
          break;
        case 'success':
          sfx('checkpoint');
          bubble(t('nice'), true, 1200);
          this.fx.leaves(s.x, s.y + 0.5, 12);
          this.dpSheet?.remove();
          this.dpSheet = null;
          break;
        case 'fail': {
          const r = s.failReason;
          sfx(r === 'splash' ? 'splash' : r === 'thorns' ? 'thorns' : r === 'bonk' ? 'bonk' : 'fall');
          if (r === 'splash') {
            const w = this.level.water.find((q) => s.x >= q.x0 - 1 && s.x <= q.x1 + 1);
            this.fx.splash(s.x, w ? w.y : s.y);
          }
          if (r === 'thorns' || r === 'bonk') this.shake = 0.3;
          bubble(t(`fail.${r || 'fall'}`), false, 2200);
          break;
        }
        case 'win':
          sfx('win');
          this.ended = true;
          this.won = true;
          this.fx.leaves(s.x, s.y + 1, 30);
          this.fx.sparkle(s.x, s.y + 1.5, '#ffe27a', 30);
          break;
        case 'lose':
          sfx('lose');
          this.ended = true;
          break;
      }
    }
    // a failed plant is gone once the sprite is back at the cards
    if (s.mode === 'decide' && !this.noSeeds && (!this.dpSheet?.isConnected || this.dpSheet.classList.contains('hidden'))) this.showCards();
    this.updateHud();
  }

  /* --------------------------------------------------------------- render */

  private render(dt: number) {
    const s = this.sim;
    const a = this.acc / P.DT;
    const x = lerp(this.prevX, s.x, a);
    const y = lerp(this.prevY, s.y, a);
    this.squash = Math.max(0, this.squash - dt * 5);
    this.phase += Math.abs(s.vx) * dt * 3.2;
    const sp = this.sprite;
    sp.root.position.set(x, y, 0);
    sp.update({
      phase: this.phase,
      speed: Math.abs(s.vx),
      vy: s.vy,
      grounded: s.grounded,
      ducking: s.ducking,
      climbing: s.climbing,
      squash: this.squash,
      hurt: s.invuln > 0 && s.mode === 'run',
      dizzy: s.mode === 'fail' && (s.failReason === 'bonk' || s.failReason === 'thorns'),
      idle: s.mode === 'decide' || s.mode === 'grow' || this.frozen,
      cheer: s.mode === 'won',
      t: this.time,
    });
    const seedGlide = s.gliding && s.mode === 'run';
    sp.setGlide(s.gliding && (s.mode === 'cross' || s.mode === 'fail' || seedGlide), seedGlide ? this.glideSeed : this.glideLeaf);
    if (s.mode === 'fail' && s.failReason === 'thorns') sp.root.position.y += Math.abs(Math.sin(s.modeT * 9)) * 0.4 * Math.max(0, 1 - s.modeT);
    // blob shadow on the ground below
    const gy = this.groundBelow(x, y);
    sp.shadow.position.set(x, gy + 0.03, 0.05);
    const hgt = Math.max(0, y - gy);
    sp.shadow.visible = gy > -50;
    sp.shadow.scale.setScalar(Math.max(0.3, 1 - hgt * 0.15));

    // plants: grow, wilt, drop failed ones
    for (let i = this.plantViews.length - 1; i >= 0; i--) {
      const pv = this.plantViews[i];
      const alive = s.plants.some((p) => p.dp === pv.dp && p.kind === pv.view.kind);
      if (!alive) {
        this.world.root.remove(pv.view.root);
        this.plantViews.splice(i, 1);
        continue;
      }
      const k = Math.min(1, (this.time - pv.at) / P.GROW_TIME);
      pv.view.grow(k);
      if (s.mode === 'fail' && s.dp === pv.dp && i === this.plantViews.length - 1) pv.view.wilt(Math.min(1, s.modeT / (P.FAIL_TIME * 0.7)));
      pv.view.update(dt, this.time);
    }
    this.world.update(s, this.time, dt);
    this.pieces.update(s, this.time, dt);
    this.updateScenery(x, y);
    this.fx.update(dt);
    this.updateCamera(x, y, dt);
    this.updateHand(x);
  }

  private groundBelow(x: number, y: number) {
    let best = -100;
    for (const b of this.level.boxes) if (x > b.x0 && x < b.x1 && b.y1 <= y + 0.05 && b.y1 > best) best = b.y1;
    for (const p of this.sim.plants) if (p.kind === 'bridge' && x > p.x && x < p.x + P.BRIDGE_LEN && p.y <= y + 0.05 && p.y > best) best = p.y;
    return best;
  }

  /** the scenery stretch around the camera: blend sky and light into the next one, darken caves, name new places */
  private updateScenery(x: number, y: number) {
    const sc = this.level.scenery;
    const cx = this.stage.camera.position.x;
    let i = 0;
    while (i + 1 < sc.length && cx >= sc[i + 1].x) i++;
    const W = 9;
    let a = sc[i],
      b = sc[i],
      k = 0;
    if (i + 1 < sc.length && cx > sc[i + 1].x - W) {
      b = sc[i + 1];
      k = (cx - (sc[i + 1].x - W)) / W;
    } else if (i > 0 && cx < sc[i].x + 1) {
      a = sc[i];
    }
    const va = variantOf(this.level.world, a?.variant ?? ''),
      vb = variantOf(this.level.world, b?.variant ?? '');
    const cave = this.pieces.caveAt(x);
    const dark = 1 - 0.75 * cave;
    this.stage.blend(va.stage, vb.stage, k, va.light * dark, vb.light * dark, va.ambient, vb.ambient, (va.rain + (vb.rain - va.rain) * k) * (1 - cave));
    // a light around the sprite in caves and at night
    const night = 1 - Math.min(va.light, vb.light);
    this.stage.lamp.intensity = Math.max(cave * 3.2, night > 0.4 ? night * 2.2 : 0);
    this.stage.lamp.position.set(x, y + 1.4, 1.2);
    this.vignette.style.opacity = String(Math.max(cave * 0.85, night > 0.4 ? night * 0.35 : 0));
    // the name of a new place, once per stretch
    const si = sc.findIndex((q, j) => x >= q.x && (j + 1 >= sc.length || x < sc[j + 1].x));
    if (si > this.placeShown) {
      this.placeShown = si;
      if (si > 0) placeToast(t(`place.${sc[si].variant}`));
    }
  }

  /** the level's title card: world and number, the place, the signature moment */
  private titleCard() {
    const L = this.level;
    const place = t(`place.${L.scenery[0]?.variant ?? ''}`);
    const head = L.daily ? t('daily.title') : L.special ? t('world.special') : t('card.level', { w: L.world, n: L.n });
    const pieces = L.pieces.map((p) => t(`piece.${p}.name`)).join(' · ');
    const card = el(`<div id="titlecard"><small>${esc(head)}</small><b>${esc(place)}</b><span>${esc(pieces)}</span></div>`);
    document.getElementById('titlecard')?.remove();
    ui().append(card);
    timedClass(card, 'bye', 2.3);
    timedRemove(card, 2.8);
  }

  private updateCamera(x: number, y: number, dt: number) {
    const st = this.stage;
    const portrait = st.width / st.height < 1;
    const s = this.sim;
    let tx: number, ty: number, tw: number, tsx: number, tsy: number;
    const dp = s.dp >= 0 && (s.mode === 'decide' || s.mode === 'grow' || s.mode === 'cross' || s.mode === 'fail') ? this.level.dps[s.dp] : null;
    if (s.grounded) this.camGroundY = y;
    else if (y < this.camGroundY - 0.5) this.camGroundY = y + 0.5;
    else if (y > this.camGroundY + 3.2) this.camGroundY = y - 3.2;
    if (dp) {
      // the obstacle, and as much of the trail after it as the run needs (no catching up after the crossing)
      const { left, right } = dpFrame(dp.stopX, dp.exitX, s.speed);
      tx = (left + right) / 2;
      ty = dp.y + (dp.obstacle === 'wall' ? dp.height * 0.45 : 1);
      tw = Math.max(portrait ? 10.5 : 0, right - left);
      tsx = 0.5;
      tsy = portrait ? 0.56 : 0.5;
    } else {
      // follow tightly (the lead term cancels the smoothing lag) and always show viewAhead(speed) units ahead,
      // so every hazard is on screen at least 1.2 s before the sprite reaches it (checked by the level validator)
      tx = x + s.vx / 12;
      ty = this.camGroundY + 0.8;
      // during a chase the sprite moves to the middle so the boar behind it is on screen too
      const chasing = !Number.isNaN(s.boarX) && !s.boarDone;
      tsx = chasing ? (portrait ? 0.5 : 0.45) : portrait ? 0.25 : 0.3;
      tsy = portrait ? 0.33 : 0.36;
      tw = Math.max(portrait ? 9.6 : 0, P.viewAhead(Math.max(s.speed, s.vx)) / (1 - tsx) + 0.4);
    }
    const k = this.cam.init ? 1 - Math.exp(-dt * (dp ? 2.5 : 12)) : 1;
    const ky = this.cam.init ? 1 - Math.exp(-dt * 3.5) : 1;
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, ky);
    this.cam.w = lerp(this.cam.w, tw, this.cam.init ? 1 - Math.exp(-dt * (tw > this.cam.w ? 14 : 2.5)) : 1);
    this.cam.sx = lerp(this.cam.sx, tsx, this.cam.init ? 1 - Math.exp(-dt * 2.5) : 1);
    this.cam.sy = lerp(this.cam.sy, tsy, this.cam.init ? 1 - Math.exp(-dt * 2.5) : 1);
    this.cam.init = true;
    const viewH = portrait ? 0 : dp ? Math.max(10.5, (dp.height || 0) + (dp.drop || 0) + 6) : 10.5;
    if (!dp && s.mode === 'run') {
      // whatever the smoothing does: always at least viewAhead(speed) of trail ahead of the sprite on screen (the
      // fairness check counts on it), so a hazard is never revealed late after a decision point or a fast flight
      const visW = Math.max(this.cam.w, viewH * (st.width / st.height));
      this.cam.x = keepAhead(this.cam.x, this.cam.sx, visW, x, P.viewAhead(Math.max(s.speed, s.vx)) + 0.2);
    }
    if (this.coverZoom) {
      const z = this.coverZoom;
      st.frame(x + (portrait ? 1 : 1.6), this.camGroundY + 1.2, (portrait ? 9 : 0) * z, 10.5 * z * (portrait ? 0 : 1), 0.42, portrait ? 0.55 : 0.5);
      return;
    }
    st.frame(this.cam.x, this.cam.y, this.cam.w, viewH, this.cam.sx, this.cam.sy);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      st.camera.position.x += Math.sin(this.time * 60) * this.shake * 0.25;
      st.camera.position.y += Math.cos(this.time * 47) * this.shake * 0.2;
    }
  }

  /** the tutorial hand next to a sign, until the player has done the gesture once */
  private updateHand(x: number) {
    const s = this.sim;
    let idx = -1;
    this.level.signs.forEach((sg, i) => {
      if (!sg.hand || this.handDone.has(i)) return;
      if (sg.hand === 'choose') {
        if (s.mode === 'decide' && s.dp >= 0 && Math.abs(this.level.dps[s.dp].stopX - sg.x) < 10) idx = i;
      } else if (x > sg.x - 1 && x < sg.x + 9 && s.mode === 'run') idx = i;
    });
    if (idx !== this.handSign) {
      this.handSign = idx;
      this.hand?.remove();
      this.hand = null;
      if (idx >= 0) {
        const kind = this.level.signs[idx].hand!;
        if (kind !== 'choose' && !touchFirst() && controls.keyboard && this.handDone.size > 0) return;
        const sg = this.level.signs[idx];
        const cap = kind === 'choose' ? '' : `<span class="cap">${esc(signText(sg.key))}</span>`;
        this.hand = el(`<div id="hand" class="${kind}"><span class="ring"></span>${HAND_SVG}${cap}</div>`);
        ui().append(this.hand);
      }
    }
    if (this.hand && idx >= 0) {
      const kind = this.level.signs[idx].hand!;
      const w = this.stage.width,
        h = this.stage.height;
      if (kind === 'choose') {
        const r = this.dpSheet?.querySelector('.cards')?.getBoundingClientRect();
        if (r) {
          this.hand.style.left = `${r.left + r.width / 2}px`;
          this.hand.style.top = `${r.top + r.height * 0.45}px`;
        }
      } else {
        this.hand.style.left = `${w * 0.62}px`;
        this.hand.style.top = `${h * (w < h ? 0.62 : 0.6)}px`;
      }
    }
  }

  /** called by the input layer when a gesture happened (the hand goes away once used) */
  gesture(kind: 'tap' | 'swipeDown') {
    if (this.handSign < 0) return;
    const sg = this.level.signs[this.handSign];
    if ((sg.hand === 'tap' || sg.hand === 'hold') && kind === 'tap') this.handDone.add(this.handSign);
    if (sg.hand === 'swipeDown' && kind === 'swipeDown') this.handDone.add(this.handSign);
  }

  /** after a completed rewarded ad: continue from the last checkpoint with one heart */
  reviveWithHeart() {
    revive(this.sim);
    this.ended = false;
    this.endT = 0;
    this.prevX = this.sim.x;
    this.prevY = this.sim.y;
    this.cam.init = false;
    this.updateHud(true);
  }

  /** after a completed rewarded ad: two more seeds, the cards come back */
  addTwoSeeds() {
    addSeeds(this.sim, 2);
    this.noSeeds = false;
    this.updateHud(true);
    if (this.sim.mode === 'decide') this.showCards();
  }

  /** tests: out of hearts right now */
  forceLose() {
    this.sim.hearts = 0;
    this.sim.mode = 'lost';
    this.ended = true;
    this.won = false;
    this.endT = 0;
  }

  nextDecision() {
    return nextDp(this.level, this.sim);
  }

  get finished() {
    return this.ended;
  }
}

const ICON_PAUSE = '<svg viewBox="0 0 64 64"><rect x="15" y="12" width="12" height="40" rx="4" fill="#fff"/><rect x="37" y="12" width="12" height="40" rx="4" fill="#fff"/></svg>';
const HAND_SVG =
  '<svg viewBox="0 0 64 64"><path d="M26 30 V10 a5 5 0 0 1 10 0 V28 l2 -1 a5 5 0 0 1 8 2 l1 1 a5 5 0 0 1 8 3 V44 C55 54 48 60 38 60 H34 C26 60 22 56 18 50 L10 38 a5 5 0 0 1 8 -6 Z" fill="#fff" stroke="#4a2e1a" stroke-width="3.5" stroke-linejoin="round"/></svg>';


let lastSpeedToast = -99;
function speedToast() {
  const now = performance.now() / 1000;
  if (now - lastSpeedToast < 4) return;
  lastSpeedToast = now;
  toast(t('faster'), 1200);
}

/** a small label when the trail enters a new place */
function placeToast(text: string) {
  document.querySelectorAll('.place').forEach((p) => p.remove());
  const n = el(`<div class="place">${esc(text)}</div>`);
  ui().append(n);
  timedRemove(n, 2.2);
}
