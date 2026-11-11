/** World 1, Spring Meadow: the hand-made tutorial levels 1-1 (jump, duck, hanging planks) and 1-2 (the first plant choice, bouncy mushrooms). */
import { LevelBuilder } from '../build';
import { RUN } from '../physics';
import type { Level } from '../types';

/** 1-1: tap to jump, hold to jump higher, swipe down to duck */
function l1(): Level {
  const b = new LevelBuilder('1-1', 1, 1, 0, 11, RUN, 0.02);
  b.level.pieces = ['planks'];
  b.level.difficulty = 0.04;
  b.scene('meadow');
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
  // the flower field at sunset: planks hanging over a little gully
  b.scene('sunset');
  b.checkpoint(0).sign('piece.planks', 'tap', 2).ground(5);
  b.planks(4, { gap: 1.4 });
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
  b.level.pieces = ['shrooms'];
  b.level.difficulty = 0.08;
  b.scene('sunset');
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
  // the rainy meadow: big bouncy mushrooms over a little canyon
  b.scene('rain');
  b.checkpoint(0).sign('piece.shrooms', undefined, 2).ground(5);
  b.shrooms(2);
  b.gems(5, 0, 0.7, 1).ground(8);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 5);
  b.gems(3, 0.5, 0.45, 1).lowLog(3, 1, 4);
  b.arc(4, -0.4, 3, 1.5).gap(2.6).ground(5);
  b.arc(3, 0.3, 2.2, 1.2, 1.2).stump(0.9, 1, 1, 6);
  b.gems(6, 0, 0.7, 1).ground(8);
  return b.goal().done();
}

export const WORLD1: Level[] = [l1(), l2()];
