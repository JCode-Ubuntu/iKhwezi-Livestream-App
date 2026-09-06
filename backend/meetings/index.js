'use strict';

/**
 * Meetings — mount point.
 *
 *   const groups = require('./groups').mount({...});
 *   require('./meetings').mount({ app, io, sequelize, DataTypes, User,
 *     authenticate, requireRegistered, interactionRateLimit, logAudit, groups });
 *
 * Depends on the groups module for models (Group, GroupMember, GroupMessage)
 * and membership checks; registers a cascade so deleting a group removes its
 * meetings.
 */

const { defineMeetingModels } = require('./models');
const { buildMeetingService } = require('./services');
const { buildMeetingRoutes } = require('./routes');

function mount(deps) {
  const { sequelize, DataTypes, User, groups } = deps;
  if (!groups?.models?.Group || !groups?.service) {
    throw new Error('meetings.mount requires the mounted groups module ({ models, service })');
  }

  const models = defineMeetingModels({ sequelize, DataTypes, User, Group: groups.models.Group });
  const service = buildMeetingService({ ...models, User, groups });
  buildMeetingRoutes({ ...deps, service });

  if (typeof groups.service.onGroupDeleted === 'function') {
    groups.service.onGroupDeleted((groupId, transaction) => service.deleteForGroup(groupId, transaction));
  }

  return { models, service };
}

module.exports = { mount };
