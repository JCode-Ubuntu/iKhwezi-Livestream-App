'use strict';

/**
 * queues — job queue with an honest in-process fallback.
 *
 *   REDIS_URL set   → lazy require('bullmq') → real BullMQ Queue + Worker
 *   REDIS_URL unset → in-process executor (jobs run via setImmediate chains)
 *
 * THE FALLBACK IS THE DEFAULT until the Redis service lands in compose
 * (worker B). Both paths expose the same tiny API so call-sites never branch:
 *
 *   const queue = buildTranscodeQueueFromEnv({ processor, env, log });
 *   await queue.add(name, data);        // never throws on enqueue
 *   await queue.close();               // best-effort teardown
 *   queue.capabilities                 // { type: 'bullmq'|'in-process', redis: bool }
 *
 * Honesty rules:
 *   - If require('bullmq') or the Redis connection fails, we log a LOUD
 *     warning and fall back to the in-process executor — boot and uploads
 *     are NEVER blocked by Redis being absent or unreachable.
 *   - add() resolves { queued: true, fallback: bool } or, in the worst case,
 *     { queued: false, reason } — it must never reject.
 */

/**
 * @param {object} opts
 * @param {function} opts.processor async (job) => any — the actual work.
 * @param {object} [opts.env] environment snapshot (default process.env)
 * @param {function} [opts.log] logger (default console)
 * @param {string} [opts.queueName] queue name (default 'ikhwezi-transcode')
 */
function buildTranscodeQueueFromEnv(opts = {}) {
  const {
    processor,
    env = process.env,
    log = console,
    queueName = 'ikhwezi-transcode',
  } = opts;

  if (typeof processor !== 'function') {
    throw new TypeError('buildTranscodeQueueFromEnv requires a processor function');
  }

  const redisUrl = (env.REDIS_URL || '').trim();

  if (!redisUrl) {
    // Default path until Redis lands: in-process, never touches the network.
    return buildInProcessQueue({ processor, log, queueName });
  }

  // Redis configured → BullMQ. Every step is guarded so a broken/missing
  // Redis degrades to the in-process fallback instead of crashing the boot
  // or failing uploads.
  try {
    const { Queue, Worker } = require('bullmq');
    const queue = new Queue(queueName, { connection: { url: redisUrl } });
    const worker = new Worker(queueName, processor, { connection: { url: redisUrl } });
    worker.on('failed', (job, err) => {
      log.error?.(`[queue ${queueName}] job ${job?.id || '?'} failed: ${err?.message || err}`);
    });
    return {
      capabilities: Object.freeze({ type: 'bullmq', redis: true }),
      async add(name, data) {
        try {
          const job = await queue.add(name, data);
          return { queued: true, id: job?.id, fallback: false };
        } catch (err) {
          // Redis hiccup at enqueue: log loudly but execute synchronously so
          // the media pipeline still delivers its output.
          log.warn?.(`[queue ${queueName}] BullMQ add failed (${err?.message || err}) — running job in-process instead`);
          return runInProcess(processor, name, data, log, queueName);
        }
      },
      async close() {
        await Promise.allSettled([worker.close(), queue.close()]);
        return true;
      },
    };
  } catch (err) {
    log.warn?.(
      `\n${'='.repeat(78)}\n⚠️  REDIS_URL is set but BullMQ could not start (${err?.message || err}). ` +
      `Falling back to the IN-PROCESS job executor — set REDIS_URL to empty to silence this.\n${'='.repeat(78)}\n`
    );
    return buildInProcessQueue({ processor, log, queueName });
  }
}

/** In-process executor: same add()/close() surface as the BullMQ wrapper. */
function buildInProcessQueue({ processor, log, queueName }) {
  let seq = 0;
  return {
    capabilities: Object.freeze({ type: 'in-process', redis: false }),
    add(name, data) {
      return runInProcess(processor, name, data, log, queueName, () => ++seq);
    },
    async close() { return true; },
  };
}

/** Fire a job onto the event loop; resolve once ENQUEUED (not completed),
 *  mirroring BullMQ semantics where add() doesn't wait for the worker. */
function runInProcess(processor, name, data, log, queueName, idGen) {
  const id = typeof idGen === 'function' ? idGen() : `ip-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  // setImmediate detaches the job from the request path (an await here would
  // delay the HTTP response) while letting the microtask queue drain first.
  setImmediate(async () => {
    try {
      await processor({ id, name, data });
    } catch (err) {
      // Mirror BullMQ's 'failed' event rather than letting a job error
      // surface as an unhandled rejection.
      log.error?.(`[queue ${queueName}] in-process job ${id} (${name}) failed: ${err?.message || err}`);
    }
  });
  return Promise.resolve({ queued: true, id, fallback: true });
}

module.exports = { buildTranscodeQueueFromEnv };
