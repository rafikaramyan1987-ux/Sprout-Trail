/** Physics constants shared by the simulation, the level builder and the validator. Fixed timestep. */

export const DT = 1 / 60;
/** run speed of level 1-1 (the crossings at decision points always use it, so plant results never depend on speed) */
export const RUN = 4.6;
/** the run speed never goes above this (1.5x level 1) */
export const MAX_SPEED = RUN * 1.5;
/**
 * How far ahead of the sprite the camera always shows the trail at a run speed (units): at least 1.2 s of running
 * plus a margin, so every hazard is on screen well over 1 second before it must be dodged.
 */
export const viewAhead = (speed: number) => speed * 1.2 + 2;
/** rolling acorns roll this fast towards the sprite */
export const ROLL_SPEED = 2;
export const GRAVITY = 34;
export const JUMP_V = 10.4;
/** gravity factor while the jump is held and the sprite still rises */
export const HOLD_G = 0.42;
/** the hold boost lasts at most this long */
export const HOLD_MAX = 0.3;
export const FALL_MAX = 20;
export const COYOTE = 0.1;
export const JUMP_BUFFER = 0.12;
export const W = 0.7;
export const H_STAND = 1.25;
export const H_DUCK = 0.6;
/** one swipe down ducks for this long (holding Down keeps ducking) */
export const DUCK_TIME = 0.65;
export const INVULN = 1.6;
export const STOMP_BOUNCE = 9;

/** plants */
export const BRIDGE_LEN = 6.5;
export const VINE_H = 5.6;
export const CLIMB_V = 4.2;
export const VINE_HOP_V = 5.5;
export const MUSHROOM_V = 16;
export const MUSHROOM_VX = 8.5;
export const MUSHROOM_TOP = 0.7;
export const TREE_LEN = 9.5;
export const LOG_LEN = 4.4;
export const LOG_TOP = 0.95;
export const LEAF_FALL = 1.3;

/** decision points: the sprite slows down over this distance before stopping */
export const DP_SLOW = 1.6;
/** a crossing with no forward progress for this long has failed (bonked into a wall) */
export const STUCK_TIME = 0.7;
export const GROW_TIME = 1.1;
export const FAIL_TIME = 1.5;
