'use strict';

/**
 * Authentication / authorization middleware.
 *
 * Extracted from backend/index.js. Behaviour is identical:
 *  - `authenticate`   optional JWT → req.user (null for anonymous/banned/invalid)
 *  - `requireAuth`    401 when no user
 *  - `requireRegistered` 401 when no user, 403 for guest sessions
 *  - `requireAdmin`   x-admin-key header only (constant-time compare)
 *  - `requireAdminAccess` x-admin-key OR req.user.isAdmin
 *
 * PHASE 3A (RBAC): requireAdmin/requireAdminAccess are DEPRECATED — no route
 * mounts them any more. Admin authorization now flows through
 * ./middleware/rbac.js (DB-checked per-user roles). The shared ADMIN_KEY
 * survives only in rbac.js's narrow transition guard (ban route) and the
 * one-time bootstrap grant, both under ADMIN_KEY_ENABLED. These two
 * functions stay exported for one transition release; delete them when the
 * key is disabled at V2 launch.
 *
 * The JWT identity is authoritative everywhere; nothing here trusts a
 * client-supplied userId.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Activity-tracking write throttle: a user's lastActive is persisted at most
// once per this window (5 minutes). Everything else keeps the in-memory value.
const LAST_ACTIVE_WRITE_INTERVAL_MS = 5 * 60 * 1000;

function buildAuthMiddleware({ User, JWT_SECRET, ADMIN_KEY }) {
  if (!User || !JWT_SECRET || !ADMIN_KEY) {
    throw new Error('buildAuthMiddleware requires User, JWT_SECRET and ADMIN_KEY');
  }

  const adminKeyMatches = (provided) => {
    const a = Buffer.from(String(provided || ''));
    const b = Buffer.from(ADMIN_KEY);
    // Constant-time comparison — a plain !== leaks how many leading characters
    // matched via response timing.
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (user && !user.isBanned) {
        req.user = user;
        // Activity tracking: throttled to one write per user per window.
        // A naive `user.save()` here turns EVERY authenticated request into
        // a Users-row write — lock contention + WAL churn for a statistic
        // nothing reads at request frequency. The timer is unref'd so tests
        // and shutdown never hang on it.
        const lastActive = user.get('lastActive') ? new Date(user.get('lastActive')) : null;
        const stale = !lastActive || (Date.now() - lastActive.getTime()) > LAST_ACTIVE_WRITE_INTERVAL_MS;
        if (stale) {
          const now = new Date();
          user.set('lastActive', now);
          user.save({ fields: ['lastActive'] }).catch((saveErr) => {
            req.logger?.warn('Last active update failed', { error: saveErr?.message || String(saveErr) });
          });
        }
      } else {
        req.user = null;
      }
    } catch (err) {
      req.user = null;
    }
    return next();
  };

  const requireAuth = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    return next();
  };

  /** Block guest sessions from mutations that need a real account. */
  const requireRegistered = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.isGuest) return res.status(403).json({ error: 'Sign in to continue' });
    return next();
  };

  const requireAdmin = (req, res, next) => {
    if (!adminKeyMatches(req.headers['x-admin-key'])) {
      return res.status(403).json({ error: 'Admin access denied' });
    }
    return next();
  };

  /** Admin panel secret key OR logged-in owner account (isAdmin). */
  const requireAdminAccess = (req, res, next) => {
    if (adminKeyMatches(req.headers['x-admin-key']) || req.user?.isAdmin) return next();
    return res.status(403).json({ error: 'Admin access denied' });
  };

  /** Socket.IO handshake middleware — mirrors `authenticate` for sockets. */
  const socketAuth = async (socket, next) => {
    const rawToken = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1]
      || null;
    if (!rawToken) {
      socket.user = null;
      socket.logger = require('../lib/logger').createNoopLogger();
      return next();
    }
    try {
      const decoded = jwt.verify(rawToken, JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      socket.user = user && !user.isBanned ? user : null;
    } catch {
      socket.user = null;
    }
    socket.logger = socket.user?.id
      ? require('../lib/logger').bindCorrelationId(require('../lib/logger').createLogger(), socket.user.id)
      : require('../lib/logger').createNoopLogger();
    return next();
  };

  const signToken = (user) => jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

  return {
    authenticate,
    requireAuth,
    requireRegistered,
    requireAdmin,
    requireAdminAccess,
    socketAuth,
    adminKeyMatches,
    signToken,
  };
}

module.exports = { buildAuthMiddleware };
