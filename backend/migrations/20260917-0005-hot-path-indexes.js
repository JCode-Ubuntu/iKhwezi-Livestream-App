'use strict';

/**
 * HOT-PATH INDEXES — unindexed columns backing the app's hottest queries.
 *
 * Evidence (query audit, 2026-09-17):
 *   - attachVideoMeta() (feed + profile video lists) runs four
 *     `GROUP BY videoId` aggregations (Likes, Comments, Stars, VideoReposts).
 *     Likes/Stars/VideoReposts had only composite uniques led by userId
 *     (idx_*_user_*), which cannot serve videoId-only filters; Comments had
 *     NO index on videoId at all. Every feed page = four table scans.
 *   - /api/stories groups + comment-counts by storyId on every load →
 *     StoryComments.storyId unindexed.
 *   - /api/messages/conversations filters DirectMessages by
 *     (receiverId, senderId IN (...), readAt IS NULL) for unread counts and
 *     by sender+clientMessageId for idempotency → unindexed.
 *   - Feed/videos lists filter by (userId, isPublished) ordered by
 *     createdAt; /api/stories filters expiresAt > now → unindexed.
 *   - /api/users/:id counts Subscriptions by creatorId (active subs) →
 *     unindexed; creator profile page hits it on every view.
 *
 * SQLite note: CREATE INDEX IF NOT EXISTS is supported since 3.3 (ancient);
 * Postgres supports it natively. Both dialects take the statements verbatim.
 */

async function up({ context }) {
  const sequelize = context.sequelize;
  const qi = sequelize.getQueryInterface();

  const statements = [
    // Feed aggregations (attachVideoMeta) — videoId-led indexes
    ['Likes', 'idx_likes_video_id', 'CREATE INDEX IF NOT EXISTS "idx_likes_video_id" ON "Likes" ("videoId")'],
    ['Comments', 'idx_comments_video_id', 'CREATE INDEX IF NOT EXISTS "idx_comments_video_id" ON "Comments" ("videoId")'],
    ['Stars', 'idx_stars_video_id', 'CREATE INDEX IF NOT EXISTS "idx_stars_video_id" ON "Stars" ("videoId")'],
    ['VideoReposts', 'idx_videoreposts_video_id', 'CREATE INDEX IF NOT EXISTS "idx_videoreposts_video_id" ON "VideoReposts" ("videoId")'],

    // Stories hot path
    ['StoryComments', 'idx_storycomments_story_id', 'CREATE INDEX IF NOT EXISTS "idx_storycomments_story_id" ON "StoryComments" ("storyId")'],
    ['Stories', 'idx_stories_expires_at', 'CREATE INDEX IF NOT EXISTS "idx_stories_expires_at" ON "Stories" ("expiresAt")'],

    // Direct messages: unread counts + idempotency lookups
    ['DirectMessages', 'idx_dm_receiver_read', 'CREATE INDEX IF NOT EXISTS "idx_dm_receiver_read" ON "DirectMessages" ("receiverId", "senderId", "readAt")'],
    ['DirectMessages', 'idx_dm_sender_clientmsgid', 'CREATE INDEX IF NOT EXISTS "idx_dm_sender_clientmsgid" ON "DirectMessages" ("senderId", "clientMessageId")'],

    // Feed / profile video lists (userId, isPublished, createdAt DESC)
    ['Videos', 'idx_videos_user_published_created', 'CREATE INDEX IF NOT EXISTS "idx_videos_user_published_created" ON "Videos" ("userId", "isPublished", "createdAt" DESC)'],

    // Creator profile active-subscriber counts
    ['Subscriptions', 'idx_subscriptions_creator_expires', 'CREATE INDEX IF NOT EXISTS "idx_subscriptions_creator_expires" ON "Subscriptions" ("creatorId", "expiresAt")'],
  ];

  await sequelize.transaction(async (transaction) => {
    // Prefer QueryInterface.showAllTables — information_schema + current_schema()
    // silently matched zero tables on Postgres in CI (indexes skipped, migration
    // still recorded as executed). showAllTables is the same path the rest of
    // the suite already trusts.
    const tables = await qi.showAllTables({ transaction });
    const names = new Set(tables.map((t) => String(t).toLowerCase()));

    for (const [table, indexName, sql] of statements) {
      if (!names.has(table.toLowerCase())) {
        continue; // table absent on this database — index is irrelevant
      }
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
  const qi = sequelize.getQueryInterface();
  await sequelize.transaction(async (transaction) => {
    for (const name of indexNames) {
      // Both dialects accept DROP INDEX IF EXISTS with unqualified names
      // (Postgres: in the current search_path schema).
      await sequelize.query(`DROP INDEX IF EXISTS "${name}"`, { transaction });
    }
  });
}

module.exports = { up, down };
