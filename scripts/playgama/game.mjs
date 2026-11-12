// Game-specific settings for the Playgama zip (scripts/playgama/zip.mjs) and its tests (scripts/playgama/test.mjs).
import web from '../web/game.mjs';

export default {
  slug: web.slug,
  title: web.title,
  dist: 'dist-playgama',
  /** the submission zip's version: submission-playgama/<slug>-playgama-v<version>.zip */
  version: 5,
  exclude: web.exclude,
  query: 'capture',
  ready: web.ready,
  play: web.play,
  rewardSelector: web.rewardSelector,
  driver: web.driver,
  money: web.money,
  next: web.next,
  nextLevelOpened: web.nextLevelOpened,
};
