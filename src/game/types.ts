/**
 * Level data: plain numbers in world units (1 unit ≈ the sprite's height). x grows to the right, y up; the
 * sprite's feet are at its y. Everything here is static; the moving state lives in sim.ts.
 */

export type PlantKind = 'bridge' | 'vine' | 'mushroom' | 'tree' | 'leaf' | 'log';
export type ObstacleKind = 'river' | 'gap' | 'wall' | 'thorns' | 'cliff';
export type EnemyKind = 'beetle' | 'snail' | 'bee' | 'roller';
export type BoxKind = 'ground' | 'step' | 'ledge' | 'log' | 'wall' | 'plank' | 'stump' | 'bridge';

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  kind: BoxKind;
  /** can be jumped onto from below (ledges, planks) */
  oneWay?: boolean;
}

export interface Hazard {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  kind: 'thorns';
}

export interface Pickup {
  x: number;
  y: number;
  kind: 'gem' | 'acorn';
}

export interface EnemyDef {
  /** beetle: walks, can be stomped; snail: crawls, spiky shell (jump over); bee: hovers up and down (duck or jump);
   *  roller: a golden-brown acorn that starts rolling towards the sprite once it is on screen (jump over) */
  kind: EnemyKind;
  /** patrol range of the enemy's centre (roller: x0 is where it waits) */
  x0: number;
  x1: number;
  /** ground height under it (bee: the centre of its hover) */
  y: number;
  speed: number;
  /** bee: hover amplitude and phase */
  amp?: number;
  phase?: number;
}

export type HandHint = 'tap' | 'hold' | 'swipeDown' | 'choose';

export interface Sign {
  x: number;
  y: number;
  /** i18n key of the one short line on the board */
  key: string;
  hand?: HandHint;
}

export interface DecisionPoint {
  obstacle: ObstacleKind;
  /** the sprite stops here (its centre) */
  stopX: number;
  /** ground height where the sprite stands */
  y: number;
  /** where the plant grows */
  anchorX: number;
  /** the crossing is done once the sprite stands at or past this x */
  exitX: number;
  cards: PlantKind[];
  /** the best plant: it crosses and (if the decision point has one) collects its golden acorn */
  answer: PlantKind;
  /** plants that also cross but miss the golden acorn */
  alsoWorks?: PlantKind[];
  /** the golden acorn only the answer's path collects (pickup index), or -1 */
  acorn?: number;
  /** cliff: how far the far side is below */
  drop?: number;
  /** for the hint text and the failure joke, e.g. the river width */
  width: number;
  height: number;
}

export interface Water {
  x0: number;
  x1: number;
  y: number;
  /** a (cartoon) crocodile lives here: falling in costs a heart, back to the last checkpoint */
  croc?: boolean;
}

/**
 * Platforms that are not part of the ground: hanging planks, drifting logs, lily pads, stepping stones and big
 * bouncy mushrooms. Their top is at `y`; they may drift sideways (amp/freq/phase, by the world clock) and sink after
 * the sprite has stood on them for `sinkAfter` seconds (0 = never).
 */
export type MoverKind = 'plank' | 'log' | 'lily' | 'stone' | 'shroom';
export interface Mover {
  kind: MoverKind;
  x0: number;
  x1: number;
  y: number;
  amp: number;
  freq: number;
  phase: number;
  sinkAfter: number;
  /** shroom: launch speed */
  bounce?: number;
}

/** a hanging rope / vine: anchor point and length; the sprite grabs it in the air and lets go on tap */
export interface Rope {
  x: number;
  y: number;
  len: number;
}

/**
 * Stretches of the trail with a special rule or look:
 * wind (gusts push jumps forward / back), chase (a wild boar charges from behind until the fence at x1),
 * collapse (an old bridge breaks behind the sprite, the run speeds up), cave (dark, light around the sprite),
 * glide (dandelion seeds: hold to glide), waterfall (a hidden path behind the falling water).
 */
export type ZoneKind = 'wind' | 'chase' | 'collapse' | 'cave' | 'glide' | 'waterfall';
export interface Zone {
  kind: ZoneKind;
  x0: number;
  x1: number;
  /** wind: +1 pushes forward, -1 back; strength (units/s added in the air), gust period and active part */
  dir?: number;
  strength?: number;
  period?: number;
  duty?: number;
  phase?: number;
  /** chase: ground height of the run */
  y?: number;
}

/** the main set piece of a level (title card, schedule) */
export type SetPiece = 'planks' | 'shrooms' | 'ropes' | 'logs' | 'collapse' | 'glide' | 'chase' | 'cave' | 'waterfall' | 'wind' | 'lily';

/** a scenery stretch: from x on, the trail looks like this variant */
export interface Scenery {
  x: number;
  variant: string;
}

export interface Level {
  id: string;
  world: number;
  /** 1-based number in the world */
  n: number;
  seeds: number;
  /** run speed at the start (units/s) and the speed gain at each checkpoint flower (0.05 = +5 %) */
  speed: number;
  ramp: number;
  /** special (bonus) level of the world, daily challenge */
  special?: boolean;
  daily?: boolean;
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
  boxes: Box[];
  hazards: Hazard[];
  pickups: Pickup[];
  enemies: EnemyDef[];
  signs: Sign[];
  checkpoints: { x: number; y: number }[];
  dps: DecisionPoint[];
  water: Water[];
  /** below this the sprite has fallen */
  killY: number;
  /** decoration seed (render only) */
  seed: number;
  movers: Mover[];
  ropes: Rope[];
  zones: Zone[];
  /** scenery variants along the trail (sorted by x, the first one from the start) */
  scenery: Scenery[];
  /** the signature moment(s) of the level, the first is the main one */
  pieces: SetPiece[];
  /** designed difficulty 0..1 (rises through the whole game) */
  difficulty: number;
}
