'use strict';

/**
 * Role-Based Access Control middleware (Phase 3A — replaces shared-secret admin access).
 *
 * Design decisions (principal-engineer standard: fail closed, DB-authoritative):
 *
 *  - `requireRole('admin')` / `requireRole('moderator', 'admin')` ALWAYS loads
 *    the caller's user row from the DB inside the check. A JWT proves identity,
 *    not current privileges: roles can be granted/revoked/banned AFTER the
 *    token was minted (30-day expiry), so a stale claim must never authorize.
 *    We never trust a client-sent role claim, and the JWT itself carries no
 *    role claim at all — the DB is the single source of truth.
 *
 *  - FAIL CLOSED everywhere: no token → 401; unknown/invalid user, banned user,
 *    deleted user, or a role column value outside the allowed set → 403.
 *    Nobody "defaults into" privileges: the schema default is 'user', and
 *    'user' passes no requireRole gate.
 *
 *  - `requireAdminAccess` (JWT-admin OR legacy ADMIN_KEY) is the_transition
 *    shim for the shared-key admin panel. Every legacy-key use is AUDITED and
 *    logs a loud deprecation warning; the key can be hard-disabled with
 *    ADMIN_KEY_ENABLED=false (the V2-launch intent — see final report).
 *    It deliberately grants only what requireAdmin granted before (ban
 *    toggle) — no new powers for the shared key.
 *
 *  - `moderator` scope (honest, existing powers only): ban/unban users.
 *    That is the only moderation action the platform supports TODAY
 *    (PATCH /api/admin/users/:id/ban). Not video deletion, not ads, not
 *    admin grants — a moderator is a user-trust guardian, not a content
 *    editor. When new moderation tools land they opt in explicitly.
 *
 *  - ADMIN_KEY bootstrap: POST /api/admin/bootstrap/grant (mounted in
 *    index.js) is the ONLY privileged operation the shared key keeps beyond
 *    the transition shim: promote one user to 'admin'. Intended to be used
 *    exactly ONCE per deployment, after which the owner sets
 *    ADMIN_KEY_ENABLED=false.
 */

const crypto = require('crypto');

const ROLES = Object.freeze(['user', 'moderator', 'admin']);

function buildRbacMiddleware({ User, JWT_SECRET, ADMIN_KEY, logAudit, adminKeyEnabled, logger = require('../lib/logger').createLogger() }) {
  if (!User || !JWT_SECRET || !ADMIN_KEY) {
    throw new Error('buildRbacMiddleware requires User, JWT_SECRET and ADMIN_KEY');
  }
  const isKeyEnabled = adminKeyEnabled !== false; // default true (transition)

  /** Constant-time ADMIN_KEY compare (same property as middleware/auth.js). */
  const adminKeyMatches = (provided) => {
    const a = Buffer.from(String(provided || ''));
    const b = Buffer.from(ADMIN_KEY);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  /**
   * Gate a route by role. Usage: app.get('/x', authenticate, requireRole('admin'), handler).
   * REQUIRES `authenticate` to have run first (it populates req.user from the JWT).
   */
  function requireRole(...allowedRoles) {
    if (!allowedRoles.length || allowedRoles.some((r) => !ROLES.includes(r))) {
      throw new Error(`requireRole: invalid roles [${allowedRoles.join(', ')}]`);
    }
    return async (req, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        // DB lookup INSIDE the check — never stale, never client-supplied.
        const user = await User.findByPk(req.user.id);
        if (!user || user.isBanned) return res.status(403).json({ error: 'Access denied' });
        if (!ROLES.includes(user.role)) return res.status(403).json({ error: 'Access denied' });
        if (!allowedRoles.includes(user.role)) return res.status(403).json({ error: 'Access denied' });
        req.user = user; // authoritative instance for the handler
        return next();
      } catch (err) {
        logger.error?.('requireRole check failed:', err?.message || err);
        // Fail closed on any internal error — never let a broken check authorize.
        return res.status(403).json({ error: 'Access denied' });
      }
    };
  }

  /**
   * Legacy ADMIN_KEY evaluation. Returns true (key allowed) or writes the
   * denial. Every SUCCESSFUL key use is audited + warned — the key is
   * scheduled for removal (ADMIN_KEY_ENABLED=false at V2 launch).
   */
  function legacyAdminKeyPasses(req, res) {
    if (!isKeyEnabled) {
      if (req.headers['x-admin-key']) {
        logger.warn('⚠️  ADMIN_KEY use rejected — admin key is disabled (ADMIN_KEY_ENABLED=false).');
      }
      return false;
    }
    if (!adminKeyMatches(req.headers['x-admin-key'])) return false;
    logger.warn(
      '⚠️  DEPRECATED: admin request authorized via shared ADMIN_KEY header — '
      + 'no per-user attribution. Log in as an admin account instead. '
      + 'Set ADMIN_KEY_ENABLED=false to disable this path (V2 launch intent).'
    );
    logAudit?.('ADMIN_KEY_USE', { path: req.path }, req.ip).catch?.(() => {});
    return true;
  }

  /**
   * Ban-toggle transition guard: logged-in admin/moderator (per DB role) OR
   * the legacy shared key during transition. This is the ONLY place the key
   * still authorizes an action — one narrow, loudly-logged path.
   */
  const requireModerationAccess = async (req, res, next) => {
    let roleOk = false;
    if (req.user) {
      const user = await User.findByPk(req.user.id);
      if (user && !user.isBanned && (user.role === 'admin' || user.role === 'moderator')) {
        req.user = user;
        roleOk = true;
      }
    }
    if (roleOk) return next();
    if (legacyAdminKeyPasses(req, res)) return next();
    return res.status(403).json({ error: 'Admin access denied' });
  };

  return { requireRole, requireModerationAccess, legacyAdminKeyPasses, adminKeyMatches, ROLES };
}

module.exports = { buildRbacMiddleware, ROLES };
