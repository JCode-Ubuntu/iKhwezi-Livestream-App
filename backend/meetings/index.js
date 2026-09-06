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
 *
 * Audio/video: when the host configures LiveKit (LIVEKIT_URL,
 * LIVEKIT_PUBLIC_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET), mount wires in the
 * live provider from ./av, and meeting payloads report audio/video/screenShare
 * as available. Without full config the null provider keeps this a
 * presence-only app (501 on the token route) — the UI stays honest.
 */

const { defineMeetingModels } = require('./models');
const { buildMeetingService } = require('./services');
const { buildMeetingRoutes } = require('./routes');
const { buildAvProviderFromEnv } = require('./av');

function mount(deps) {
  const { sequelize, DataTypes, User, groups, env } = deps;
  if (!groups?.models?.Group || !groups?.service) {
    throw new Error('meetings.mount requires the mounted groups module ({ models, service })');
  }

  const av = (typeof deps.av === 'function'
    ? deps.av(deps)
    : deps.av) || buildAvProviderFromEnv(env);

  const models = defineMeetingModels({ sequelize, DataTypes, User, Group: groups.models.Group });
  const service = buildMeetingService({ ...models, User, groups, av });
  buildMeetingRoutes({ ...deps, service, av });

  if (typeof groups.service.onGroupDeleted === 'function') {
    groups.service.onGroupDeleted((groupId, transaction) => service.deleteForGroup(groupId, transaction));
  }

  return { models, service, av };
}

module.exports = { mount };
