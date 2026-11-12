/**
 * The two camera rules the fairness check depends on (pure, unit-tested):
 *  - at a decision point the shot shows the obstacle and as much trail after it as the run needs, so nothing is
 *    revealed late once the sprite runs on;
 *  - while running, whatever the smoothing does, at least viewAhead(speed) of trail ahead of the sprite is on screen.
 */
import * as P from '../game/physics';

/** the world x range a decision point's shot must show */
export function dpFrame(stopX: number, exitX: number, speed: number) {
  return { left: stopX - 1.5, right: exitX + P.viewAhead(speed) };
}

/**
 * The camera x so the screen's right edge is at least `need` ahead of the sprite at `x` (the camera puts its x at
 * the screen fraction `sx` of a view `visW` wide).
 */
export function keepAhead(camX: number, sx: number, visW: number, x: number, need: number) {
  const right = camX + (1 - sx) * visW;
  return right < x + need ? camX + (x + need - right) : camX;
}
