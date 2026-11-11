/** The look of each world: sky, light, hills, terrain colours, trees and ambient particles. */
import type { Theme } from './stage';

export interface Ambient {
  color: string;
  size: number;
  count: number;
  /** drift down (falling leaves) instead of floating */
  fall: number;
  /** blink (fireflies) */
  flicker: boolean;
}

export interface WorldTheme {
  stage: Theme;
  grass: string;
  grassDark: string;
  soil: [string, string, string];
  meadow: string;
  water: string;
  waterFront: string;
  /** near trees behind the trail: model name + colour tint of its foliage */
  near: { name: string; tint?: string }[];
  far: { name: string; tint?: string }[];
  flowers: number;
  shrooms: number;
  giantShrooms: boolean;
  mist: boolean;
  thorn: string;
  ambient: Ambient;
}

export const THEMES: WorldTheme[] = [
  {
    // 1 Spring Meadow
    stage: { skyTop: '#6db9ec', skyBottom: '#fdf3d0', fog: '#dff0e4', hills: ['#8fcf72', '#a7d68e', '#b9dbc0', '#cfe3e6'], sun: '#fff1c9', ambientSky: '#dff3ff', ambientGround: '#6f8f4a', fogNear: 45, fogFar: 230, rays: 0.22 },
    grass: '#86cf5c',
    grassDark: '#5fae47',
    soil: ['#9a6a43', '#6f4a2e', '#b98457'],
    meadow: '#8ccf6a',
    water: '#59b8e6',
    waterFront: '#2f7fb0',
    near: [{ name: 'CommonTree_1' }],
    far: [{ name: 'Pine_3' }, { name: 'Pine_5' }],
    flowers: 1,
    shrooms: 0.3,
    giantShrooms: false,
    mist: false,
    thorn: '#5a3d58',
    ambient: { color: '#fff7c2', size: 0.22, count: 90, fall: 0, flicker: false },
  },
  {
    // 2 Deep Forest
    stage: { skyTop: '#5f9fb8', skyBottom: '#e6efd2', fog: '#a9c9b4', hills: ['#4f8f4a', '#5f9a5a', '#7fae8a', '#a3c4b4'], sun: '#fff0c0', ambientSky: '#cfe8dc', ambientGround: '#3f5f34', fogNear: 30, fogFar: 160, rays: 0.42 },
    grass: '#6fbf55',
    grassDark: '#4a9a3f',
    soil: ['#7e5636', '#573a22', '#9a6a43'],
    meadow: '#5f9a4a',
    water: '#4aa8c8',
    waterFront: '#2a6f90',
    near: [{ name: 'Pine_1' }, { name: 'CommonTree_1', tint: '#4f9a3a' }, { name: 'Pine_3' }],
    far: [{ name: 'Pine_3' }, { name: 'Pine_5' }, { name: 'Pine_1' }],
    flowers: 0.4,
    shrooms: 1,
    giantShrooms: false,
    mist: false,
    thorn: '#4a3550',
    ambient: { color: '#fff3b0', size: 0.18, count: 70, fall: 0, flicker: false },
  },
  {
    // 3 Mushroom Valley
    stage: { skyTop: '#a796e6', skyBottom: '#ffe1ee', fog: '#efd9ef', hills: ['#8fcfa8', '#a8b9e0', '#c7b2e3', '#e4cfee'], sun: '#ffe6f2', ambientSky: '#f3e6ff', ambientGround: '#6a7f5a', fogNear: 40, fogFar: 210, rays: 0.25 },
    grass: '#8fd69a',
    grassDark: '#62b578',
    soil: ['#a0634f', '#74443a', '#bd8068'],
    meadow: '#93cfa2',
    water: '#6fc0e8',
    waterFront: '#3a7fb8',
    near: [{ name: 'CommonTree_1', tint: '#a88ae0' }, { name: 'CommonTree_1', tint: '#6fc0a0' }],
    far: [{ name: 'Pine_5', tint: '#7fa8c8' }],
    flowers: 0.8,
    shrooms: 2.5,
    giantShrooms: true,
    mist: false,
    thorn: '#6a3d6e',
    ambient: { color: '#ffc2f0', size: 0.2, count: 80, fall: -0.05, flicker: true },
  },
  {
    // 4 Autumn Woods
    stage: { skyTop: '#7fb2de', skyBottom: '#ffe2b8', fog: '#f2dcbc', hills: ['#c99a4a', '#d6a865', '#d9bf98', '#e6d5c0'], sun: '#ffd9a0', ambientSky: '#ffeccf', ambientGround: '#7a5a2f', fogNear: 40, fogFar: 210, rays: 0.3 },
    grass: '#c6b85a',
    grassDark: '#9a9a3f',
    soil: ['#8a5a36', '#5f3c22', '#a8724a'],
    meadow: '#c9a85a',
    water: '#5aa8d0',
    waterFront: '#2f6f98',
    near: [{ name: 'CommonTree_1', tint: '#e8862e' }, { name: 'CommonTree_1', tint: '#d9502e' }, { name: 'CommonTree_1', tint: '#e8b22e' }],
    far: [{ name: 'Pine_3' }, { name: 'Pine_5' }],
    flowers: 0.2,
    shrooms: 1.2,
    giantShrooms: false,
    mist: false,
    thorn: '#5a3a2e',
    ambient: { color: '#f08a3a', size: 0.32, count: 70, fall: 0.6, flicker: false },
  },
  {
    // 5 Misty Swamp
    stage: { skyTop: '#6f8d9c', skyBottom: '#cdd8cc', fog: '#aebfb4', hills: ['#5f7f5a', '#6f8a72', '#8a9f94', '#a8b8b0'], sun: '#e6f0d8', ambientSky: '#c8d8d0', ambientGround: '#3f4a34', fogNear: 18, fogFar: 110, rays: 0.12 },
    grass: '#759e5a',
    grassDark: '#4f7a42',
    soil: ['#5f4a36', '#3f3022', '#7a6046'],
    meadow: '#5f7f52',
    water: '#5f9a82',
    waterFront: '#2f5f4f',
    near: [{ name: 'DeadTree_1' }, { name: 'Pine_1', tint: '#5f7f52' }],
    far: [{ name: 'DeadTree_1' }, { name: 'Pine_5', tint: '#6f8a7a' }],
    flowers: 0.1,
    shrooms: 1.5,
    giantShrooms: false,
    mist: true,
    thorn: '#3f3546',
    ambient: { color: '#e8ff7a', size: 0.26, count: 70, fall: 0, flicker: true },
  },
];

export const themeFor = (world: number) => THEMES[Math.max(0, Math.min(THEMES.length - 1, world - 1))];
