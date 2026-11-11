/**
 * Scenery variants: four per world, each with its own sky and time of day, light, hills, weather / particles and
 * backdrop props. A level wanders through two or three of them (level.scenery); the sky, light and fog blend
 * smoothly as the camera moves from one stretch to the next, and each stretch gets its own props.
 */
import type { Theme, AmbientConfig } from './stage';

export interface Variant {
  id: string;
  world: number;
  stage: Theme;
  ambient: AmbientConfig;
  /** light: 1 = day, lower = dusk / night */
  light: number;
  rain: number;
  /** backdrop props */
  trees: { name: string; tint?: string }[];
  treeDensity: number;
  far: { name: string; tint?: string }[];
  flowers: number;
  shrooms: number;
  giantShrooms: boolean;
  glowCaps: boolean;
  crystals: boolean;
  roots: boolean;
  lake: boolean;
  falls: boolean;
  puddles: boolean;
  mist: boolean;
  reeds: boolean;
  fireflies: boolean;
}

const T = (skyTop: string, skyBottom: string, fog: string, hills: string[], sun: string, ambientSky: string, ambientGround: string, fogNear: number, fogFar: number, rays: number): Theme => ({
  skyTop,
  skyBottom,
  fog,
  hills,
  sun,
  ambientSky,
  ambientGround,
  fogNear,
  fogFar,
  rays,
});
const A = (color: string, size: number, count: number, fall: number, flicker: boolean): AmbientConfig => ({ color, size, count, fall, flicker });
const base = { treeDensity: 1, far: [{ name: 'Pine_3' }, { name: 'Pine_5' }], flowers: 0.4, shrooms: 0.4, giantShrooms: false, glowCaps: false, crystals: false, roots: false, lake: false, falls: false, puddles: false, mist: false, reeds: false, fireflies: false, rain: 0, light: 1 };

export const VARIANT_DEFS: Variant[] = [
  // ---- 1 Spring Meadow
  { ...base, id: 'meadow', world: 1, stage: T('#6db9ec', '#fdf3d0', '#dff0e4', ['#8fcf72', '#a7d68e', '#b9dbc0', '#cfe3e6'], '#fff1c9', '#dff3ff', '#6f8f4a', 45, 230, 0.22), ambient: A('#fff7c2', 0.22, 90, 0, false), trees: [{ name: 'CommonTree_1' }], flowers: 1 },
  { ...base, id: 'sunset', world: 1, stage: T('#f39a6b', '#ffd9a0', '#f6c9a0', ['#c9b06a', '#d8a878', '#e0b49a', '#efc9b8'], '#ffb070', '#ffd8c0', '#7a6a4a', 40, 200, 0.45), ambient: A('#ffe0a0', 0.24, 90, 0, false), light: 0.85, trees: [{ name: 'CommonTree_1', tint: '#e8c060' }], flowers: 2.2, treeDensity: 0.6 },
  { ...base, id: 'rain', world: 1, stage: T('#8a9bab', '#c9d3d8', '#b9c5c8', ['#6f9a5f', '#8aa883', '#a3b7ab', '#b9c6c4'], '#e0e8f0', '#c8d4dc', '#55704a', 25, 140, 0.05), ambient: A('#e8f4ff', 0.12, 120, 6, false), light: 0.7, rain: 1, puddles: true, trees: [{ name: 'CommonTree_1', tint: '#4f8f3a' }], flowers: 0.5 },
  { ...base, id: 'lake', world: 1, stage: T('#5fb4ea', '#e9f6f4', '#d6ecf0', ['#7fc6a0', '#9fd0c4', '#b6dbe2', '#cde6ee'], '#fff6d8', '#e3f4ff', '#6f8f6a', 50, 240, 0.25), ambient: A('#ffffff', 0.18, 70, 0, false), lake: true, reeds: true, trees: [{ name: 'CommonTree_1' }, { name: 'Pine_5' }], treeDensity: 0.5, flowers: 0.6 },
  // ---- 2 Deep Forest
  { ...base, id: 'pines', world: 2, stage: T('#5f9fb8', '#e6efd2', '#a9c9b4', ['#4f8f4a', '#5f9a5a', '#7fae8a', '#a3c4b4'], '#fff0c0', '#cfe8dc', '#3f5f34', 30, 160, 0.42), ambient: A('#fff3b0', 0.18, 70, 0, false), trees: [{ name: 'Pine_1' }, { name: 'Pine_3' }], treeDensity: 1.8, far: [{ name: 'Pine_3' }, { name: 'Pine_5' }, { name: 'Pine_1' }], shrooms: 1 },
  { ...base, id: 'roots', world: 2, stage: T('#6faa9a', '#e8ecc8', '#b4ccb0', ['#5a8a4a', '#6f9a5f', '#8aac88', '#a8c0aa'], '#ffe8b0', '#d8ead0', '#4a5f34', 30, 170, 0.5), ambient: A('#ffe9a0', 0.2, 60, 0, false), roots: true, trees: [{ name: 'CommonTree_1', tint: '#3f8a35' }], treeDensity: 0.7, shrooms: 1.4 },
  { ...base, id: 'glow', world: 2, stage: T('#2f4a6a', '#6f8a8a', '#3a5458', ['#24443a', '#2f5248', '#3f6058', '#55706a'], '#b0d8ff', '#6f90b0', '#1a2a20', 18, 110, 0.1), ambient: A('#d8ff7a', 0.26, 90, 0, true), light: 0.45, fireflies: true, glowCaps: true, trees: [{ name: 'Pine_1', tint: '#2f5a3a' }, { name: 'CommonTree_1', tint: '#2a5a40' }], treeDensity: 1.2 },
  { ...base, id: 'falls', world: 2, stage: T('#62b0d8', '#eef4e0', '#c6dcd4', ['#5f9a68', '#7aa88a', '#9cbcb0', '#c0d4d0'], '#fff6d0', '#e0f0f0', '#4f6a44', 40, 200, 0.35), ambient: A('#ffffff', 0.16, 90, -0.1, false), falls: true, trees: [{ name: 'Pine_3' }, { name: 'CommonTree_1' }], treeDensity: 0.8 },
  // ---- 3 Mushroom Valley
  { ...base, id: 'caps', world: 3, stage: T('#2a2a5a', '#7a5aa0', '#4a3a6a', ['#3a5a5a', '#4a4a7a', '#5a4a8a', '#7a6aa0'], '#e0c8ff', '#8a7ab0', '#2a3a2a', 22, 130, 0.08), ambient: A('#ff9ef0', 0.24, 90, -0.05, true), light: 0.5, glowCaps: true, giantShrooms: true, fireflies: true, trees: [{ name: 'CommonTree_1', tint: '#6a4aa0' }], treeDensity: 0.6, shrooms: 2.5 },
  { ...base, id: 'canyon', world: 3, stage: T('#c9a0e0', '#ffe0d0', '#f0d0d8', ['#c08a7a', '#d0a08a', '#e0b8a8', '#ecd0c8'], '#ffe8d0', '#ffe8f0', '#7a5a4a', 40, 210, 0.3), ambient: A('#ffd0f0', 0.2, 80, -0.05, true), giantShrooms: true, trees: [{ name: 'CommonTree_1', tint: '#a8c070' }], treeDensity: 0.4, shrooms: 1.5 },
  { ...base, id: 'pastel', world: 3, stage: T('#a796e6', '#ffe1ee', '#efd9ef', ['#8fcfa8', '#a8b9e0', '#c7b2e3', '#e4cfee'], '#ffe6f2', '#f3e6ff', '#6a7f5a', 40, 210, 0.25), ambient: A('#ffc2f0', 0.2, 80, -0.05, true), giantShrooms: true, trees: [{ name: 'CommonTree_1', tint: '#a88ae0' }, { name: 'CommonTree_1', tint: '#6fc0a0' }], flowers: 0.8, shrooms: 2 },
  { ...base, id: 'grotto', world: 3, stage: T('#3a3a6a', '#8aa0c8', '#5a6a8a', ['#4a5a7a', '#5a6a8a', '#7a88a8', '#9aa8c0'], '#c8e0ff', '#9ab0d0', '#2a3040', 20, 120, 0.15), ambient: A('#9ff0ff', 0.22, 80, -0.05, true), light: 0.55, crystals: true, glowCaps: true, trees: [{ name: 'Pine_5', tint: '#5a7aa0' }], treeDensity: 0.4, shrooms: 1.5 },
  // ---- 4 Autumn Woods
  { ...base, id: 'golden', world: 4, stage: T('#7fb2de', '#ffe2b8', '#f2dcbc', ['#c99a4a', '#d6a865', '#d9bf98', '#e6d5c0'], '#ffd9a0', '#ffeccf', '#7a5a2f', 40, 210, 0.3), ambient: A('#f0a03a', 0.3, 60, 0.6, false), trees: [{ name: 'CommonTree_1', tint: '#e8b22e' }, { name: 'CommonTree_1', tint: '#e8862e' }], flowers: 0.2, shrooms: 1 },
  { ...base, id: 'ridge', world: 4, stage: T('#8ab4d0', '#f0e4c8', '#e0d4bc', ['#a8884a', '#b89a6a', '#c8b494', '#dacdb8'], '#fff0d0', '#f0ecdc', '#6a5a3a', 45, 220, 0.2), ambient: A('#e8702a', 0.34, 90, 0.9, false), trees: [{ name: 'CommonTree_1', tint: '#d9502e' }, { name: 'Pine_3' }], treeDensity: 0.5 },
  { ...base, id: 'dusk', world: 4, stage: T('#c8607a', '#ffb070', '#e8a080', ['#9a5a3a', '#b0704a', '#c8907a', '#dcb0a0'], '#ff9050', '#ffc0a0', '#5a3a2a', 30, 180, 0.4), ambient: A('#ffd070', 0.28, 70, 0.5, false), light: 0.75, trees: [{ name: 'CommonTree_1', tint: '#c03a2a' }, { name: 'CommonTree_1', tint: '#e8862e' }], fireflies: true },
  { ...base, id: 'drizzle', world: 4, stage: T('#8a8a8a', '#c8bca8', '#b8ac98', ['#8a6a3a', '#9a7a5a', '#aa9a80', '#beb4a4'], '#e8e0d0', '#d0c8bc', '#4a3a2a', 25, 140, 0.05), ambient: A('#e0e8f0', 0.12, 120, 6, false), light: 0.7, rain: 1, puddles: true, trees: [{ name: 'CommonTree_1', tint: '#b8602a' }] },
  // ---- 5 Misty Swamp
  { ...base, id: 'marsh', world: 5, stage: T('#6f8d9c', '#cdd8cc', '#aebfb4', ['#5f7f5a', '#6f8a72', '#8a9f94', '#a8b8b0'], '#e6f0d8', '#c8d8d0', '#3f4a34', 18, 110, 0.12), ambient: A('#e8ff7a', 0.26, 70, 0, true), mist: true, reeds: true, trees: [{ name: 'DeadTree_1' }, { name: 'Pine_1', tint: '#5f7f52' }], far: [{ name: 'DeadTree_1' }, { name: 'Pine_5', tint: '#6f8a7a' }], flowers: 0.1, shrooms: 1.5 },
  { ...base, id: 'lagoon', world: 5, stage: T('#7ab8b0', '#e0ecd0', '#c0d8c8', ['#5f9a7a', '#7aaa90', '#98c0ac', '#b8d4c8'], '#f0f8e0', '#d8ece0', '#4a6a44', 30, 160, 0.25), ambient: A('#ffffff', 0.16, 60, 0, false), lake: true, reeds: true, trees: [{ name: 'CommonTree_1', tint: '#4f8f5a' }, { name: 'DeadTree_1' }], treeDensity: 0.6, flowers: 0.5 },
  { ...base, id: 'moon', world: 5, stage: T('#1a2a4a', '#4a5a7a', '#2f3f50', ['#2a3a3a', '#34444a', '#40505a', '#56646e'], '#c8d8ff', '#5a6a8a', '#1a2420', 15, 100, 0.06), ambient: A('#d8ff7a', 0.28, 100, 0, true), light: 0.4, fireflies: true, mist: true, trees: [{ name: 'DeadTree_1' }], far: [{ name: 'DeadTree_1' }], shrooms: 1 },
  { ...base, id: 'mangrove', world: 5, stage: T('#7a9a8a', '#d8dcc0', '#a8b8a0', ['#4f6a4a', '#5f7a5a', '#7a8f78', '#98a898'], '#f0f0d0', '#d0dcc8', '#3a4a2f', 22, 130, 0.2), ambient: A('#e8ff9a', 0.22, 70, 0, true), roots: true, mist: true, reeds: true, trees: [{ name: 'Pine_1', tint: '#4f6a42' }, { name: 'DeadTree_1' }], treeDensity: 1.2 },
];

const byKey = new Map(VARIANT_DEFS.map((v) => [`${v.world}:${v.id}`, v]));
export const variantOf = (world: number, id: string) => byKey.get(`${world}:${id}`) ?? VARIANT_DEFS[(world - 1) * 4];
