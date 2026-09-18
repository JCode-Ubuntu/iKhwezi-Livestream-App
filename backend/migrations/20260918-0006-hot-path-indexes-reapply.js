'use strict';

/**
 * Re-apply hot-path indexes from 0005.
 *
 * Why: 0005's Postgres table-existence probe (information_schema +
 * current_schema) matched zero tables in practice, so every CREATE INDEX was
 * skipped while SequelizeMeta still recorded 0005 as executed. Fresh installs
 * that run the fixed 0005 are fine; databases that already recorded the
 * no-op need this idempotent IF NOT EXISTS pass.
 *
 * Table guards: legacy V1 baseline-adopt DBs (and partial schemas) may lack
 * some feature tables — skip those indexes rather than failing the migrate.
 */

async function up({ context }) {
  const sequelize = context.sequelize;
  const qi = context;
  const statements = [
    ['Likes', 'CREATE INDEX IF NOT EXISTS "idx_likes_video_id" ON "Likes" ("videoId")'],
    ['Comments', 'CREATE INDEX IF NOT EXISTS "idx_comments_video_id" ON "Comments" ("videoId")'],
    ['Stars', 'CREATE INDEX IF NOT EXISTS "idx_stars_video_id" ON "Stars" ("videoId")'],
    ['VideoReposts', 'CREATE INDEX IF NOT EXISTS "idx_videoreposts_video_id" ON "VideoReposts" ("videoId")'],
    ['StoryComments', 'CREATE INDEX IF NOT EXISTS "idx_storycomments_story_id" ON "StoryComments" ("storyId")'],
    ['Stories', 'CREATE INDEX IF NOT EXISTS "idx_stories_expires_at" ON "Stories" ("expiresAt")'],
    ['DirectMessages', 'CREATE INDEX IF NOT EXISTS "idx_dm_receiver_read" ON "DirectMessages" ("receiverId", "senderId", "readAt")'],
    ['DirectMessages', 'CREATE INDEX IF NOT EXISTS "idx_dm_sender_clientmsgid" ON "DirectMessages" ("senderId", "clientMessageId")'],
    ['Videos', 'CREATE INDEX IF NOT EXISTS "idx_videos_user_published_created" ON "Videos" ("userId", "isPublished", "createdAt" DESC)'],
    ['Subscriptions', 'CREATE INDEX IF NOT EXISTS "idx_subscriptions_creator_expires" ON "Subscriptions" ("creatorId", "expiresAt")'],
  ];

  await sequelize.transaction(async (transaction) => {
    const tables = await qi.showAllTables({ transaction });
    const names = new Set(tables.map((t) => String(t).toLowerCase()));
    for (const [table, sql] of statements) {
      if (!names.has(table.toLowerCase())) continue;
      await sequelize.query(sql, { transaction });
    }
  });
}

async function down({ context }) {
  const sequelize = context.sequelize;
  const indexNames = [
    'idx_likes_video_id',
    'idx_comments_video_id',
    'idx_stars_video_id',
    'idx_videoreposts_video_id',
    'idx_storycomments_story_id',
    'idx_stories_expires_at',
    'idx_dm_receiver_read',
    'idx_dm_sender_clientmsgid',
    'idx_videos_user_published_created',
    'idx_subscriptions_creator_expires',
  ];
  await sequelize.transaction(async (transaction) => {
    for (const name of indexNames) {
      await sequelize.query(`DROP INDEX IF EXISTS "${name}"`, { transaction });
    }
  });
}

module.exports = { up, down };
