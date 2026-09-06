'use strict';

/**
 * Guest-account cleanup.
 *
 * Why: every app install creates a guest User row (@guest.local email,
 * Points + 500-coin Wallet) so anonymous browsing works. Guests never
 * convert, never log in again, and nothing has ever deleted them — the
 * Users table grows by one row (plus 2 companion rows) per install that
 * ever opened the app, forever.
 *
 * What this job does:
 *   1. Collects guest candidates: isGuest, not banned (kept for record),
 *      not admin, and inactive — lastActive (or createdAt when never seen)
 *      older than GUEST_IDLE_DAYS (default 14).
 *   2. Protects guests that still own visible content (videos / stories /
 *      text posts). The API gates guests from creating any (requireRegistered),
 *      so this is defensive — a purge must never orphan community-visible
 *      content, whatever wrote it (seeds, imports, pre-gate installs).
 *   3. Deletes FK-safe, children before the User, inside ONE transaction per
 *      batch, using direct model references (no table-name guessing).
 *
 * Idempotent: run as often as you like; only stale rows disappear.
 * Dialect-agnostic: Sequelize calls only — SQLite today, PostgreSQL ready.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_IDLE_DAYS = 14;

function buildGuestCleanupJob({ sequelize, models, logger = console }) {
  const {
    User, Like, VideoSave, VideoRepost, Comment, StoryView, StoryComment,
    PostLike, DirectMessage, Follow, GiftLog,
    Subscription, Star, Video, Story, TextPost, Points, Wallet,
    GroupMember, GroupBan, GroupMessage, MeetingParticipant,
  } = models;

  const log = (...args) => { (logger.info || logger.log).apply(logger, args); };

  /** Child rows that may reference a user, in delete order, by model. */
  const childRefs = [
    [Like, 'userId'],
    [VideoSave, 'userId'],
    [VideoRepost, 'userId'],
    [Comment, 'userId'],
    [StoryView, 'viewerId'],
    [StoryComment, 'userId'],
    [PostLike, 'userId'],
    [Star, 'userId'],
    [DirectMessage, 'senderId'],
    [DirectMessage, 'receiverId'],
    [Follow, 'followerId'],
    [Follow, 'followingId'],
    [GiftLog, 'fromUserId'],
    [GiftLog, 'toUserId'],
    [Subscription, 'subscriberId'],
    [Subscription, 'creatorId'],
    // Optional modular models — present when groups/meetings are mounted.
    [GroupMember, 'userId'],
    [GroupBan, 'userId'],
    [GroupMessage, 'senderId'],
    [MeetingParticipant, 'userId'],
  ].filter(([Model]) => !!Model);

  /** Content ownership protects a guest from the purge. */
  const ownershipRefs = [
    [Video, 'userId'],
    [Story, 'userId'],
    [TextPost, 'userId'],
  ].filter(([Model]) => !!Model);

  /**
   * One idempotent run. Returns { purged, protected, keptActive, considered }.
   */
  async function runOnce({ idleDays = DEFAULT_IDLE_DAYS } = {}) {
    const idleCutoff = Date.now() - idleDays * DAY_MS;

    const guests = await User.findAll({
      where: { isGuest: true, isBanned: false, isAdmin: false },
      attributes: ['id', 'lastActive', 'createdAt'],
    });
    const considered = guests.length;

    const staleIds = guests
      .filter((g) => new Date(g.lastActive || g.createdAt).getTime() < idleCutoff)
      .map((g) => g.id);

    if (!staleIds.length) {
      return { purged: 0, protected: 0, keptActive: considered, considered };
    }

    // Protect guests owning visible content (grouped queries, no N+1).
    const protectedIds = new Set();
    for (const [Model, col] of ownershipRefs) {
      const rows = await Model.findAll({ where: { [col]: staleIds }, attributes: [col], raw: true });
      rows.forEach((r) => protectedIds.add(r[col]));
    }
    const purgedIds = staleIds.filter((id) => !protectedIds.has(id));

    if (purgedIds.length) {
      await sequelize.transaction(async (t) => {
        for (const [Model, col] of childRefs) {
          await Model.destroy({ where: { [col]: purgedIds }, transaction: t });
        }
        // 1:1 companions of the User row.
        await Wallet.destroy({ where: { userId: purgedIds }, transaction: t });
        await Points.destroy({ where: { creatorId: purgedIds }, transaction: t });
        // Parent last — every referencing child is already gone.
        await User.destroy({ where: { id: purgedIds }, transaction: t });
      });
    }

    const result = {
      purged: purgedIds.length,
      protected: protectedIds.size,
      keptActive: considered - staleIds.length,
      considered,
    };
    if (result.purged > 0) {
      log(`guest cleanup: purged ${result.purged} stale guest account(s) (${result.protected} content-protected, ${result.keptActive} active kept)`);
    }
    return result;
  }

  let timer = null;

  /** Run on boot, then repeat daily. Unref'd so it never blocks shutdown. */
  function start({ intervalMs = DAY_MS, idleDays = DEFAULT_IDLE_DAYS } = {}) {
    runOnce({ idleDays }).catch((e) => logger.error?.('guest cleanup failed on boot:', e.message));
    timer = setInterval(() => {
      runOnce({ idleDays }).catch((e) => logger.error?.('guest cleanup failed:', e.message));
    }, intervalMs);
    timer.unref?.();
    return stop;
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  return { runOnce, start, stop };
}

module.exports = { buildGuestCleanupJob, DEFAULT_IDLE_DAYS };
