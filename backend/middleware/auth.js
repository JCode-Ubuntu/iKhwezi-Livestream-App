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
 * The JWT identity is authoritative everywhere; nothing here trusts a
 * client-supplied userId.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

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
        // Keep requests authenticated even if optional activity tracking write fails.
        user.lastActive = new Date();
        user.save().catch((saveErr) => {
          console.warn('Last active update failed:', saveErr.message);
        });
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
      return next();
    }
    try {
      const decoded = jwt.verify(rawToken, JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      socket.user = user && !user.isBanned ? user : null;
    } catch {
      socket.user = null;
    }
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
