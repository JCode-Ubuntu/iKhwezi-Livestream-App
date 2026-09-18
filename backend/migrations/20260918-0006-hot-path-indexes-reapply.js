'use strict';

/**
 * Re-apply hot-path indexes from 0005.
 *
 * Why: 0005's Postgres table-existence probe (information_schema +
 * current_schema) matched zero tables in practice, so every CREATE INDEX was
 * skipped while SequelizeMeta still recorded 0005 as executed. Fresh installs
 * that run the fixed 0005 are fine; databases that already recorded the
 * no-op need this idempotent IF NOT EXISTS pass.
 */

async function up({ context }) {
  const sequelize = context.sequelize;
  const statements = [
    'CREATE INDEX IF NOT EXISTS "idx_likes_video_id" ON "Likes" ("videoId")',
    'CREATE INDEX IF NOT EXISTS "idx_comments_video_id" ON "Comments" ("videoId")',
    'CREATE INDEX IF NOT EXISTS "idx_stars_video_id" ON "Stars" ("videoId")',
    'CREATE INDEX IF NOT EXISTS "idx_videoreposts_video_id" ON "VideoReposts" ("videoId")',
    'CREATE INDEX IF NOT EXISTS "idx_storycomments_story_id" ON "StoryComments" ("storyId")',
    'CREATE INDEX IF NOT EXISTS "idx_stories_expires_at" ON "Stories" ("expiresAt")',
    'CREATE INDEX IF NOT EXISTS "idx_dm_receiver_read" ON "DirectMessages" ("receiverId", "senderId", "readAt")',
    'CREATE INDEX IF NOT EXISTS "idx_dm_sender_clientmsgid" ON "DirectMessages" ("senderId", "clientMessageId")',
    'CREATE INDEX IF NOT EXISTS "idx_videos_user_published_created" ON "Videos" ("userId", "isPublished", "createdAt" DESC)',
    'CREATE INDEX IF NOT EXISTS "idx_subscriptions_creator_expires" ON "Subscriptions" ("creatorId", "expiresAt")',
  ];

  await sequelize.transaction(async (transaction) => {
    for (const sql of statements) {
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
