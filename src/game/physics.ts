/** Physics constants shared by the simulation, the level builder and the validator. Fixed timestep. */

export const DT = 1 / 60;
export const RUN = 4.6;
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
export const SLIDE = RUN;
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

/** decision points: the sprite slows down over this distance before stopping */
export const DP_SLOW = 1.6;
/** a crossing with no forward progress for this long has failed (bonked into a wall) */
export const STUCK_TIME = 0.7;
export const GROW_TIME = 1.1;
export const FAIL_TIME = 1.5;
