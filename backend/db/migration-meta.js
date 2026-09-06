'use strict';

/**
 * Shared constants for the migration system (runner + tests).
 *
 * SequelizeStorage (umzug@3.8.3) syncs its model as `SequelizeMeta` with a
 * primary-key `name` column. Baseline detection must know these names without
 * instantiating storage (storage auto-creates the table on `executed()` —
 * so the adopt probe must run BEFORE any umzug storage call).
 */

module.exports = {
  SequelizeMetaName: 'SequelizeMeta',
  SequelizeMetaFileSafe: 'SequelizeMeta',
};
