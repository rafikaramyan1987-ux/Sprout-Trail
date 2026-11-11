/**
 * Level data: plain numbers in world units (1 unit ≈ the sprite's height). x grows to the right, y up; the
 * sprite's feet are at its y. Everything here is static; the moving state lives in sim.ts.
 */

export type PlantKind = 'bridge' | 'vine' | 'mushroom' | 'tree' | 'leaf' | 'log';
export type ObstacleKind = 'river' | 'gap' | 'wall' | 'thorns' | 'cliff';
export type BoxKind = 'ground' | 'step' | 'ledge' | 'log' | 'wall' | 'plank' | 'stump';

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
  kind: 'beetle';
  /** patrol range of the enemy's centre */
  x0: number;
  x1: number;
  y: number;
  speed: number;
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
  answer: PlantKind;
  /** for the hint text and the failure joke, e.g. the river width */
  width: number;
  height: number;
}

export interface Water {
  x0: number;
  x1: number;
  y: number;
}

export interface Level {
  id: string;
  world: number;
  /** 1-based number in the world */
  n: number;
  seeds: number;
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
}
