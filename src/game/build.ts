/**
 * Level builder: a small chainable language that walks a cursor along the trail (x) at the current ground height
 * (y) and drops ground, steps, gaps, logs, thorns, pickups, signs and decision points.
 */
import { GRAVITY, RUN, SHROOM_V } from './physics';
import type { DecisionPoint, EnemyDef, EnemyKind, Level, MoverKind, PlantKind, HandHint, Zone } from './types';

export interface DecisionOpts {
  /** ground before the obstacle */
  lead?: number;
  /** plants that also cross but miss the decision point's golden acorn */
  alsoWorks?: PlantKind[];
  /** a golden acorn only the answer collects, relative to the start of the obstacle */
  acornAt?: [number, number];
  /** cliff: how far down the far side is */
  drop?: number;
  /** thorns: height (1.2 tall, 0.8 short) */
  thornH?: number;
}

const DEEP = 30;

export class LevelBuilder {
  x = 0;
  y = 0;
  readonly level: Level;

  constructor(id: string, world: number, n: number, seeds: number, seed = 1, speed = RUN, ramp = 0) {
    this.level = {
      id,
      world,
      n,
      seeds,
      speed,
      ramp,
      startX: 2,
      startY: 0,
      goalX: 0,
      goalY: 0,
      boxes: [],
      hazards: [],
      pickups: [],
      enemies: [],
      signs: [],
      checkpoints: [],
      dps: [],
      water: [],
      killY: -7,
      seed,
      movers: [],
      ropes: [],
      zones: [],
      scenery: [],
      pieces: [],
      difficulty: 0,
    };
    // solid ground behind the start, so the trail does not begin at the edge of the world
    this.level.boxes.push({ x0: -30, x1: 0, y0: -DEEP, y1: 0, kind: 'ground' });
  }

  /** flat ground of this length */
  ground(len: number) {
    const L = this.level;
    const last = L.boxes[L.boxes.length - 1];
    if (last && last.kind === 'ground' && Math.abs(last.x1 - this.x) < 1e-6 && Math.abs(last.y1 - this.y) < 1e-6) last.x1 += len;
    else L.boxes.push({ x0: this.x, x1: this.x + len, y0: this.y - DEEP, y1: this.y, kind: 'ground' });
    this.x += len;
    return this;
  }

  /** the ground steps up (a jump is needed for steps above about 0.3) */
  up(h: number) {
    this.y += h;
    return this;
  }
  down(h: number) {
    this.y -= h;
    return this;
  }

  /** a pit to jump over; `water` fills it with a stream */
  gap(w: number, water = false) {
    if (water) this.level.water.push({ x0: this.x, x1: this.x + w, y: this.y - 1.3 });
    this.x += w;
    return this;
  }

  /** a tree stump to hop over, standing on the ground ahead (consumes `w + after` of ground) */
  stump(h = 0.8, w = 1.0, before = 1, after = 3) {
    this.ground(before);
    this.level.boxes.push({ x0: this.x, x1: this.x + w, y0: this.y, y1: this.y + h, kind: 'stump' });
    return this.ground(w + after);
  }

  /** a fallen trunk lying across the trail with a low gap under it: duck to slide through */
  lowLog(len = 3, before = 1, after = 3) {
    this.ground(before);
    this.level.boxes.push({ x0: this.x, x1: this.x + len, y0: this.y + 0.78, y1: this.y + 3.4, kind: 'log' });
    return this.ground(len + after);
  }

  /** a floating mossy ledge, relative to the cursor (does not move it) */
  ledge(dx: number, dy: number, len: number) {
    this.level.boxes.push({ x0: this.x + dx, x1: this.x + dx + len, y0: this.y + dy - 0.5, y1: this.y + dy, kind: 'ledge', oneWay: true });
    return this;
  }

  /** a thorn patch on the ground ahead (consumes its length) */
  thorns(len: number, h = 1.0) {
    this.level.hazards.push({ x0: this.x, x1: this.x + len, y0: this.y, y1: this.y + h, kind: 'thorns' });
    return this.ground(len);
  }

  /** gems in a line, relative to the cursor */
  gems(n: number, dx = 0.5, dy = 0.7, step = 1) {
    for (let i = 0; i < n; i++) this.level.pickups.push({ x: this.x + dx + i * step, y: this.y + dy, kind: 'gem' });
    return this;
  }

  /** gems along a jump arc from dx over `w`, peaking at `hgt` */
  arc(n: number, dx: number, w: number, hgt: number, base = 0.7) {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      this.level.pickups.push({ x: this.x + dx + k * w, y: this.y + base + hgt * 4 * k * (1 - k), kind: 'gem' });
    }
    return this;
  }

  acorn(dx: number, dy: number) {
    this.level.pickups.push({ x: this.x + dx, y: this.y + dy, kind: 'acorn' });
    return this;
  }

  sign(key: string, hand?: HandHint, dx = 0) {
    this.level.signs.push({ x: this.x + dx, y: this.y, key, hand });
    return this;
  }

  checkpoint(dx = 0) {
    this.level.checkpoints.push({ x: this.x + dx, y: this.y });
    return this;
  }

  beetle(dx: number, range: number, speed = 1.3) {
    return this.enemy('beetle', dx, range, speed);
  }

  /** an enemy relative to the cursor (does not move it); bee: `y` is the extra hover height */
  enemy(kind: EnemyKind, dx: number, range: number, speed = 1.3, extra: Partial<EnemyDef> = {}) {
    this.level.enemies.push({ kind, x0: this.x + dx, x1: this.x + dx + range, y: this.y, speed, ...extra, ...(extra.y !== undefined ? { y: this.y + extra.y } : {}) });
    return this;
  }

  /**
   * A decision point: the sprite stops in front of the obstacle and the player picks a plant.
   * The obstacle starts `lead` units ahead of the cursor.
   */
  decision(obstacle: DecisionPoint['obstacle'], size: number, cards: PlantKind[], answer: PlantKind, opts: DecisionOpts | number = {}) {
    const o: DecisionOpts = typeof opts === 'number' ? { lead: opts } : opts;
    this.ground(o.lead ?? 4.5);
    const anchorX = this.x;
    const y = this.y;
    const dp: DecisionPoint = { obstacle, stopX: anchorX - 2.4, y, anchorX, exitX: 0, cards, answer, width: size, height: 0, alsoWorks: o.alsoWorks ?? [], acorn: -1 };
    if (o.acornAt) {
      dp.acorn = this.level.pickups.length;
      this.level.pickups.push({ x: anchorX + o.acornAt[0], y: y + o.acornAt[1], kind: 'acorn' });
    }
    if (obstacle === 'river' || obstacle === 'gap') {
      this.gap(size, obstacle === 'river');
      dp.exitX = this.x + 1.2;
    } else if (obstacle === 'cliff') {
      dp.drop = o.drop ?? 4;
      this.gap(size);
      this.down(dp.drop);
      dp.exitX = this.x + 1.2;
    } else if (obstacle === 'wall') {
      dp.height = size;
      dp.width = 0;
      this.level.boxes.push({ x0: this.x, x1: this.x + 1.2, y0: this.y, y1: this.y + size, kind: 'wall' });
      this.up(size);
      dp.exitX = this.x + 1.4;
    } else if (obstacle === 'thorns') {
      dp.height = o.thornH ?? 1.2;
      this.thorns(size, dp.height);
      dp.exitX = this.x + 0.9;
    }
    this.level.dps.push(dp);
    return this;
  }

  /* ------------------------------------------------------------- scenery and set pieces */

  /** from here on the trail looks like this scenery variant */
  scene(variant: string) {
    const sc = this.level.scenery;
    if (sc.length && Math.abs(sc[sc.length - 1].x - this.x) < 1) sc[sc.length - 1].variant = variant;
    else if (!sc.length || sc[sc.length - 1].variant !== variant) sc.push({ x: sc.length ? this.x : -40, variant });
    return this;
  }

  private mover(kind: MoverKind, x0: number, w: number, y: number, o: { amp?: number; freq?: number; phase?: number; sinkAfter?: number; bounce?: number } = {}) {
    this.level.movers.push({ kind, x0, x1: x0 + w, y, amp: o.amp ?? 0, freq: o.freq ?? 1, phase: o.phase ?? 0, sinkAfter: o.sinkAfter ?? 0, bounce: o.bounce });
  }

  zone(kind: Zone['kind'], x0: number, x1: number, extra: Partial<Zone> = {}) {
    this.level.zones.push({ kind, x0, x1, ...extra });
    return this;
  }

  /**
   * Planks hanging from branches over a pit: jump plank to plank. `sway` drifts them sideways, `sink` makes them
   * go down a moment after you land. `acornAt`: index of the plank after which a golden acorn hangs in the hop.
   */
  planks(n: number, o: { gap?: number; sway?: number; sink?: number; acornAt?: number; water?: boolean } = {}) {
    const w = 1.7;
    const gap = o.gap ?? 1.8;
    this.ground(1.5);
    const start = this.x;
    const y0 = this.y;
    let x = start + 1.6;
    for (let i = 0; i < n; i++) {
      const y = y0 + (i % 2 ? 1.2 : 0.6);
      this.mover('plank', x, w, y, { amp: o.sway ?? 0, freq: 1.5, phase: i * 1.7, sinkAfter: o.sink ?? 0 });
      this.level.pickups.push({ x: x + w / 2, y: y + 0.8, kind: 'gem' });
      // the golden acorn hangs in the hop from this plank to the next (a full jump from the plank would carry the
      // sprite past the next plank: no human could both collect it and land)
      if (o.acornAt === i) {
        const ny = i + 1 < n ? y0 + ((i + 1) % 2 ? 1.2 : 0.6) : y0;
        const gx = i + 1 < n ? x + w + gap / 2 : x + w + (gap + 0.4) / 2;
        this.level.pickups.push({ x: gx, y: Math.max(y, ny) + 1.8, kind: 'acorn' });
      }
      x += w + gap;
    }
    this.gap(x - start + 0.4 - gap, o.water ?? false);
    return this.ground(3);
  }

  /** a lake with a (cartoon) crocodile and a chain of ropes to swing across; tap to let go */
  ropes(n: number, o: { spacing?: number; acorn?: boolean; croc?: boolean } = {}) {
    const sp = o.spacing ?? 5.6;
    this.ground(2);
    const start = this.x;
    for (let i = 0; i < n; i++) {
      const rx = start + 2.6 + i * sp;
      this.level.ropes.push({ x: rx, y: this.y + 7.6, len: 5.4 });
      this.level.pickups.push({ x: rx, y: this.y + 1.6, kind: 'gem' });
      if (i + 1 < n) this.level.pickups.push({ x: rx + sp / 2, y: this.y + (o.acorn && i === Math.floor((n - 1) / 2) ? 4.4 : 3.2), kind: o.acorn && i === Math.floor((n - 1) / 2) ? 'acorn' : 'gem' });
    }
    const len = 2.6 + (n - 1) * sp + 3.4;
    this.level.water.push({ x0: start, x1: start + len, y: this.y - 1.3, croc: o.croc ?? true });
    this.x += len;
    return this.ground(3);
  }

  /** a river with logs drifting back and forth: hop log to log */
  logs(n: number, o: { croc?: boolean; drift?: number; acornAt?: number } = {}) {
    this.ground(1.5);
    const start = this.x;
    const sp = 3.3;
    for (let i = 0; i < n; i++) {
      const x = start + 1.4 + i * sp;
      this.mover('log', x, 2.2, this.y - 0.5, { amp: o.drift ?? 0.7, freq: 1.1, phase: i * 2.1 });
      this.level.pickups.push({ x: x + 1.1, y: this.y + 0.4, kind: o.acornAt === i ? 'acorn' : 'gem' });
    }
    const len = 1.4 + (n - 1) * sp + 2.2 + 1.6;
    this.level.water.push({ x0: start, x1: start + len, y: this.y - 1.3, croc: o.croc ?? false });
    this.x += len;
    return this.ground(3);
  }

  /** a swamp pool with lily pads (some sink a moment after you land) and stepping stones */
  lily(n: number, o: { sinkEvery?: number; sinkAfter?: number; acornAt?: number } = {}) {
    this.ground(1.5);
    const start = this.x;
    const sp = 2.7;
    for (let i = 0; i < n; i++) {
      const x = start + 1.3 + i * sp;
      const stone = i % 3 === 2;
      const sinks = !stone && o.sinkEvery && i % o.sinkEvery === 0;
      this.mover(stone ? 'stone' : 'lily', x, stone ? 1.1 : 1.4, this.y - (stone ? 0.6 : 0.9), { sinkAfter: sinks ? (o.sinkAfter ?? 0.5) : 0 });
      if (o.acornAt === i) {
        // the golden acorn hangs in the hop to the next pad (on a pad it needed a landing within a hand's width)
        const top = this.y - (stone ? 0.6 : 0.9);
        const nStone = (i + 1) % 3 === 2;
        const ntop = i + 1 < n ? this.y - (nStone ? 0.6 : 0.9) : this.y;
        const nx = i + 1 < n ? start + 1.3 + (i + 1) * sp : start + 1.3 + (n - 1) * sp + 1.4 + 1.4;
        this.level.pickups.push({ x: (x + (stone ? 1.1 : 1.4) + nx) / 2, y: Math.max(top, ntop) + 1.8, kind: 'acorn' });
      } else this.level.pickups.push({ x: x + 0.65, y: this.y + 0.4, kind: 'gem' });
    }
    const len = 1.3 + (n - 1) * sp + 1.4 + 1.4;
    this.level.water.push({ x0: start, x1: start + len, y: this.y - 1.3, croc: true });
    this.x += len;
    return this.ground(3);
  }

  /**
   * Big bouncy mushrooms over a canyon: the first cap starts right at the edge, so the sprite runs onto it by itself,
   * and every bounce is aimed at the next cap (sim.ts), then at the far ground. No input needed at any speed.
   */
  shrooms(n: number, o: { sp?: number; acornAt?: number } = {}) {
    this.ground(1.5);
    const start = this.x;
    const sp = o.sp ?? 6.2;
    const w = 1.8;
    const top = this.y - 0.4;
    for (let i = 0; i < n; i++) {
      const x = start + 0.15 + i * sp;
      this.mover('shroom', x, w, top, { bounce: SHROOM_V });
      // over the middle of each flight, at the top of the arc
      const to = i + 1 < n ? x + sp + w / 2 : x + w + (sp - w) + 1.4;
      this.level.pickups.push({ x: (x + w / 2 + to) / 2, y: top + SHROOM_V ** 2 / (2 * GRAVITY) + 0.35, kind: o.acornAt === i ? 'acorn' : 'gem' });
    }
    // the far ground: as far after the last cap as the caps are apart
    this.gap(0.15 + (n - 1) * sp + w + (sp - w));
    return this.ground(3);
  }

  /** a stretch of wind: gusts (shown by blowing leaves) push jumps forward (+1) or back (-1) */
  wind(len: number, dir: number, o: { strength?: number; period?: number; phase?: number } = {}) {
    this.zone('wind', this.x, this.x + len, { dir, strength: o.strength ?? 2.2, period: o.period ?? 2.6, duty: 0.5, phase: o.phase ?? 0 });
    return this;
  }

  /** an old bridge over a gorge: it breaks behind the sprite, the run speeds up until the far side */
  collapse(len: number) {
    this.ground(1);
    const x0 = this.x;
    for (let x = 0; x < len; x += 1) this.level.boxes.push({ x0: x0 + x, x1: x0 + Math.min(len, x + 1), y0: this.y - 0.35, y1: this.y, kind: 'bridge' });
    this.zone('collapse', x0, x0 + len);
    this.gems(Math.floor(len / 1.5), 0.8, 0.7, 1.5);
    this.x += len;
    return this.ground(3);
  }

  /** a wild boar charges from behind for this stretch; it gives up at the fence at the end */
  chase(len: number) {
    return this.zone('chase', this.x, this.x + len, { y: this.y });
  }

  /** dark cave: only a circle of light around the sprite; hazards glow */
  cave(len: number) {
    return this.zone('cave', this.x, this.x + len);
  }

  /** a waterfall: jump up behind the falling water to a hidden ledge path with a golden acorn */
  waterfall(acorn = true) {
    this.ground(2);
    const x0 = this.x;
    this.ledge(0.5, 2.5, 3.5).ledge(4.6, 3.6, 3.5).ledge(8.7, 2.5, 3);
    this.gems(3, 1, 3.3, 1).gems(3, 5, 4.4, 1);
    if (acorn) this.acorn(6.4, 5.4);
    this.zone('waterfall', x0 + 2, x0 + 10);
    return this.ground(13);
  }

  /** a valley to glide over with dandelion seeds: jump at the edge and keep the finger down */
  glide(width: number, drop = 2) {
    this.ground(2);
    const x0 = this.x;
    this.arc(8, 1, width - 2, 1.5, 2.6);
    this.gap(width);
    this.down(drop);
    this.zone('glide', x0 - 3, this.x + 1);
    return this.ground(3);
  }

  goal(after = 6) {
    this.level.goalX = this.x + 2;
    this.level.goalY = this.y;
    return this.ground(after + 2);
  }

  done(): Level {
    const L = this.level;
    L.checkpoints.sort((a, b) => a.x - b.x);
    L.killY = Math.min(...L.boxes.map((b) => b.y1)) - 7;
    return L;
  }
}
