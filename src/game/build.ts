/**
 * Level builder: a small chainable language that walks a cursor along the trail (x) at the current ground height
 * (y) and drops ground, steps, gaps, logs, thorns, pickups, signs and decision points.
 */
import { RUN } from './physics';
import type { DecisionPoint, EnemyDef, EnemyKind, Level, PlantKind, HandHint } from './types';

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
