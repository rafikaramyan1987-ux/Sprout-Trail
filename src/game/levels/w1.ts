/** World 1, Spring Meadow. Levels 1-3 teach: jump and duck, the first plant choice, then vine and mushroom. */
import { LevelBuilder } from '../build';
import { RUN } from '../physics';
import type { Level } from '../types';

/** 1-1: tap to jump, hold to jump higher, swipe down to duck */
function l1(): Level {
  const b = new LevelBuilder('1-1', 1, 1, 0, 11, RUN, 0.02);
  b.ground(4).gems(5, 1, 0.7, 1.2);
  b.ground(10);
  // tap to jump
  b.sign('tut.jump', 'tap', 1).ground(5);
  b.arc(3, 0.2, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 6);
  b.arc(3, 0.2, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.gems(4, 0, 0.7, 1).ground(6);
  b.arc(4, -0.4, 3, 1.5).gap(2.4).ground(6);
  b.checkpoint(1).gems(3, 2, 0.7, 1).ground(6);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 4);
  b.arc(4, -0.4, 3, 1.5).gap(2.6).ground(5);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 6);
  // hold to jump higher
  b.checkpoint(0).sign('tut.hold', 'hold', 3.5).ground(6);
  b.gems(3, 0, 0.7, 1).ground(3).up(2.2).ground(8);
  b.acorn(4, 3.4).gems(2, 1, 0.7, 1).ground(8);
  b.down(2.2).ground(6).gems(4, 0, 0.7, 1).ground(4);
  b.up(2.2).ground(3).arc(3, 0, 2, 1).ground(6).down(1).ground(6).down(1.2).ground(6);
  // swipe down to duck
  b.checkpoint(0).sign('tut.duck', 'swipeDown', 3.5).ground(6);
  b.gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.gems(4, 0, 0.7, 1).ground(5);
  b.acorn(1.8, 0.4).lowLog(3.5, 1, 5);
  b.arc(4, -0.4, 3, 1.5).gap(2.4).ground(5);
  b.checkpoint(0).gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  // everything together
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.gems(3, 0, 0.7, 1).ground(4).up(2).ground(4);
  b.ledge(3, 2.6, 4).acorn(5, 3.6).gems(3, 3.5, 3.2, 1).ground(10);
  b.down(2).ground(4).arc(4, -0.4, 3, 1.5).gap(2.6).ground(5);
  b.gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.arc(4, -0.4, 3, 1.5).gap(2.4, true).ground(5);
  b.gems(6, 0, 0.7, 1).ground(8);
  return b.goal().done();
}

/** 1-2: the first plant choice, a bridge over the stream */
function l2(): Level {
  const b = new LevelBuilder('1-2', 1, 2, 3, 23, RUN, 0.02);
  b.ground(6).gems(5, 1, 0.7, 1.2).ground(10);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.arc(4, -0.4, 3, 1.5).gap(2.4, true).ground(5);
  b.gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.gems(3, 0, 0.7, 1).ground(4).up(2.2).ground(5);
  b.acorn(3, 3.4).ground(7).down(2.2).ground(5);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 6);
  b.checkpoint(0).ground(4);
  // the stream is too wide to jump: choose the right plant
  b.sign('tut.choose', 'choose', 1).ground(2);
  b.gems(3, 4, 0.7, 1).decision('river', 5.5, ['bridge', 'vine'], 'bridge');
  b.gems(4, 1.5, 0.7, 1).ground(8);
  b.arc(4, -0.4, 3, 1.5).gap(2.6, true).ground(5);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 4);
  b.ledge(2, 2.6, 4).acorn(4, 3.6).gems(3, 1.5, 3.2, 1).ground(9);
  b.checkpoint(0).gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.gems(3, 0, 0.7, 1).ground(4).up(1.0).ground(5).up(1.0).ground(6);
  b.arc(4, -0.4, 3, 1.5).gap(2.8).ground(6);
  b.down(2).ground(5);
  b.acorn(1.8, 0.4).lowLog(3.5, 1, 5);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.arc(4, -0.4, 3, 1.5).gap(2.4, true).ground(6);
  b.checkpoint(0).gems(5, 0, 0.7, 1).ground(8);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.arc(4, -0.4, 3, 1.5).gap(2.6).ground(5);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 6);
  b.gems(6, 0, 0.7, 1).ground(8);
  return b.goal().done();
}

/** 1-3: two decision points, a vine ladder at a high wall and a mushroom over thorns; first beetles */
function l3(): Level {
  const b = new LevelBuilder('1-3', 1, 3, 4, 37, RUN, 0.02);
  b.ground(6).gems(5, 1, 0.7, 1.2).ground(10);
  b.sign('tut.stomp', 'tap', 0).ground(3);
  b.beetle(3, 4).gems(3, 3, 2.2, 1).ground(10);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.arc(4, -0.4, 3, 1.5).gap(2.6, true).ground(5);
  b.gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.acorn(5, 5.6).ground(2).up(2.2).ground(8).down(2.2).ground(4);
  b.checkpoint(0).ground(4);
  // a wall too high for any jump
  b.gems(3, 3, 0.7, 1).decision('wall', 5, ['bridge', 'vine', 'mushroom'], 'vine');
  b.gems(4, 1, 0.7, 1).ground(8);
  b.beetle(2, 4.5).ground(9);
  b.arc(4, -0.4, 3, 1.5).gap(2.6).ground(5);
  b.ledge(2, 2.6, 4).acorn(4, 3.6).gems(3, 1.5, 3.2, 1).ground(9);
  b.down(2.5).ground(6).down(2.5).ground(5);
  b.checkpoint(0).gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.beetle(1, 5).ground(10);
  // thorns too long to jump
  b.checkpoint(0).ground(2);
  b.arc(5, 1.5, 5, 2.4, 1.5).decision('thorns', 5, ['bridge', 'mushroom', 'vine'], 'mushroom');
  b.gems(4, 1.5, 0.7, 1).ground(8);
  b.arc(4, -0.4, 3, 1.5).gap(2.6, true).ground(5);
  b.acorn(1.8, 0.4).lowLog(3.5, 1, 5);
  b.beetle(2, 4).ground(10);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 4);
  b.gems(3, 0, 0.7, 1).ground(4).up(1.1).ground(5).down(1.1).ground(5);
  b.checkpoint(0).gems(6, 0, 0.7, 1).ground(8);
  return b.goal().done();
}

export const WORLD1: Level[] = [l1(), l2(), l3()];
