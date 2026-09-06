'use strict';

/**
 * Group Chat — mount point.
 *
 * One entry the host app calls:
 *
 *   require('./groups').mount({ app, io, sequelize, User, DataTypes, Op,
 *     authenticate, requireRegistered, interactionRateLimit, logAudit });
 *
 * It defines the models (so sequelize.sync() creates the tables), builds the
 * service, registers REST routes, and attaches the socket handlers. Nothing
 * else in backend/index.js needs to change.
 */

const { buildGroupModels } = require('./models');
const { buildGroupService } = require('./services');
const { buildGroupRoutes } = require('./routes');
const { buildGroupSocket } = require('./socket');

function mount(deps) {
  const { sequelize, DataTypes, User } = deps;

  const models = { ...buildGroupModels({ sequelize, DataTypes, User }), User };
  const service = buildGroupService(models);
  buildGroupRoutes({ ...deps, models, service });
  buildGroupSocket({ io: deps.io, models, service });

  return { models, service };
}

module.exports = { mount };
