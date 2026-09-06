'use strict';

/**
 * Process-level safety nets.
 *
 * An unhandled promise rejection in Node ≥15 terminates the process by
 * default; an uncaught exception always does. Either used to take the whole
 * iKHWEZI API (and every live socket) down because of one bad request path.
 *
 * Policy:
 *  - unhandledRejection: log with context and keep serving. Route handlers
 *    already respond with 5xx for their own failures; this only catches truly
 *    detached promises (fire-and-forget writes, timers).
 *  - uncaughtException: log, then exit after a short grace period so the
 *    supervisor (Docker `restart: unless-stopped`, Render) restarts a clean
 *    process. Continuing after an uncaught exception risks running with
 *    corrupted in-memory state.
 */
function installProcessGuards({ logger = console, exitOnUncaught = true, exitDelayMs = 500 } = {}) {
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error('[process] Unhandled promise rejection:', message);
  });

  process.on('uncaughtException', (err) => {
    logger.error('[process] Uncaught exception:', err?.stack || err);
    if (!exitOnUncaught) return;
    setTimeout(() => process.exit(1), exitDelayMs).unref();
  });
}

module.exports = { installProcessGuards };
