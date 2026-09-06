'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { buildGuestCleanupJob } = require('../jobs/guestCleanup');

/**
 * Guest cleanup — the purge must be surgical:
 *  - only guests (never real users, admins, banned guests)
 *  - only stale ones (idle 14+ days by lastActive/createdAt)
 *  - never guests that own visible content (videos/stories/posts)
 *  - children deleted before the User, atomically, so no row survives
 *    pointing at a deleted account
 *
 * This harness boots a fresh in-memory DB per test and ages users directly,
 * so runs are fast and order-independent.
 */

async function boot() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const core = require('../models').defineCoreModels(sequelize, DataTypes);
  await sequelize.sync();
  return { sequelize, ...core };
}

async function mkUser(models, overrides = {}) {
  const n = Math.floor(Math.random() * 1e9);
  return models.User.create({
    username: overrides.username || `u${n}`,
    email: overrides.email || `${overrides.username || `u${n}`}@test.local`,
    password: await bcrypt.hash('pw', 4),
    isGuest: !!overrides.isGuest,
    isBanned: !!overrides.isBanned,
    isAdmin: !!overrides.isAdmin,
    lastActive: overrides.lastActive,
  });
}

// daysAgo / daysAhead helpers keep the aging readable
const DAY = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(Date.now() - d * DAY);

test('purges a stale guest with all companion/child rows atomically', async () => {
  const ctx = await boot();
  try {
    const guest = await mkUser(ctx, { isGuest: true, lastActive: ago(30) });
    const real = await mkUser(ctx, { lastActive: ago(30) }); // not a guest
    const video = await ctx.Video.create({ userId: real.id, filename: 'v.mp4' });
    await ctx.DirectMessage.create({ senderId: guest.id, receiverId: real.id, content: 'hi' });
    await ctx.Like.create({ userId: guest.id, videoId: video.id });
    await ctx.Wallet.create({ userId: guest.id, coins: 500 });
    await ctx.Points.create({ creatorId: guest.id, totalPoints: 0, lifetimePoints: 0 });

    const job = buildGuestCleanupJob({ sequelize: ctx.sequelize, models: ctx, logger: { info() {} } });
    const result = await job.runOnce();

    assert.equal(result.purged, 1);
    assert.ok(await ctx.User.findByPk(guest.id) === null, 'guest user row gone');
    assert.ok(await ctx.User.findByPk(real.id) !== null, 'real user untouched');
    assert.equal(await ctx.Wallet.count({ where: { userId: guest.id } }), 0);
    assert.equal(await ctx.Points.count({ where: { creatorId: guest.id } }), 0);
    assert.equal(await ctx.DirectMessage.count({ where: { senderId: guest.id } }), 0, 'DM from purged guest removed');
    assert.equal(await ctx.Like.count({ where: { userId: guest.id } }), 0);
    // The real user's own content is untouched by the purge.
    assert.ok(await ctx.Video.findByPk(video.id) !== null, 'video owned by real user intact');
  } finally {
    await ctx.sequelize.close();
  }
});

test('never purges recent guests, admins, banned guests, or real users', async () => {
  const ctx = await boot();
  try {
    await mkUser(ctx, { isGuest: true, lastActive: ago(1), username: 'freshguest' });    // active guest
    await mkUser(ctx, { isGuest: true, lastActive: ago(30), isAdmin: true, username: 'admin' }); // admin
    await mkUser(ctx, { isGuest: true, lastActive: ago(30), isBanned: true, username: 'banned' }); // banned (record)
    await mkUser(ctx, { lastActive: ago(90), username: 'realdormant' });                 // real dormant user

    const before = await ctx.User.count();
    const job = buildGuestCleanupJob({ sequelize: ctx.sequelize, models: ctx, logger: { info() {} } });
    const result = await job.runOnce();

    assert.equal(result.purged, 0);
    assert.equal(await ctx.User.count(), before, 'no row removed');
  } finally {
    await ctx.sequelize.close();
  }
});

test('protects stale guests that own visible content (video/story/post)', async () => {
  const ctx = await boot();
  try {
    const ownerGuest = await mkUser(ctx, { isGuest: true, lastActive: ago(30), username: 'owner' });
    const plainGuest = await mkUser(ctx, { isGuest: true, lastActive: ago(30), username: 'plain' });
    await ctx.Video.create({ userId: ownerGuest.id, filename: 'a.mp4' });
    await ctx.Story.create({ userId: ownerGuest.id, type: 'image', url: '/x.jpg', expiresAt: ago(-1) });

    const job = buildGuestCleanupJob({ sequelize: ctx.sequelize, models: ctx, logger: { info() {} } });
    const result = await job.runOnce();

    assert.equal(result.purged, 1, 'only the contentless guest is purged');
    assert.equal((await job.runOnce()).purged, 0, 'idempotent second run');
    assert.ok(await ctx.User.findByPk(ownerGuest.id) !== null, 'content owner kept');
    assert.ok(await ctx.User.findByPk(plainGuest.id) === null, 'contentless guest purged');
  } finally {
    await ctx.sequelize.close();
  }
});

test('uses createdAt as the age fallback when lastActive is null', async () => {
  const ctx = await boot();
  try {
    // Model default sets lastActive=NOW at insert; force null to exercise the
    // defensive fallback (e.g. rows imported/edited outside the ORM). The
    // createdAt aging needs raw SQL — the ORM protects timestamp columns
    // from instance.update().
    const fresh = await ctx.User.create({
      username: 'neveropened', email: 'neveropened@guest.local', password: await bcrypt.hash('pw', 4),
      isGuest: true,
    });
    await ctx.sequelize.query('UPDATE Users SET lastActive = NULL, createdAt = :createdAt WHERE id = :id', {
      replacements: { createdAt: ago(1), id: fresh.id },
    });

    const job = buildGuestCleanupJob({ sequelize: ctx.sequelize, models: ctx, logger: { info() {} } });
    assert.equal((await job.runOnce()).purged, 0);
    assert.ok(await ctx.User.findByPk(fresh.id) !== null, '1-day-old guest kept');

    // Age beyond cutoff → stale via the createdAt fallback.
    await ctx.sequelize.query('UPDATE Users SET lastActive = NULL, createdAt = :createdAt WHERE id = :id', {
      replacements: { createdAt: ago(30), id: fresh.id },
    });
    assert.equal((await job.runOnce()).purged, 1);
    assert.ok(await ctx.User.findByPk(fresh.id) === null);
  } finally {
    await ctx.sequelize.close();
  }
});

test('idle window is configurable (GUEST_IDLE_DAYS), boundary respected', async () => {
  const ctx = await boot();
  try {
    const young = await mkUser(ctx, { isGuest: true, lastActive: ago(20), username: 'twenty' });
    const old = await mkUser(ctx, { isGuest: true, lastActive: ago(40), username: 'forty' });
    const job = buildGuestCleanupJob({ sequelize: ctx.sequelize, models: ctx, logger: { info() {} } });

    // Default 14 days: both stale.
    let r = await job.runOnce();
    assert.equal(r.purged >= 1, true);

    // Re-boot fresh users for a boundary test at 30 days.
    const g1 = await mkUser(ctx, { isGuest: true, lastActive: ago(29) });
    const g2 = await mkUser(ctx, { isGuest: true, lastActive: ago(31) });
    r = await job.runOnce({ idleDays: 30 });
    assert.ok(await ctx.User.findByPk(g1.id) !== null, '29-day guest kept at 30-day cutoff');
    assert.ok(await ctx.User.findByPk(g2.id) === null, '31-day guest purged at 30-day cutoff');
  } finally {
    await ctx.sequelize.close();
  }
});
