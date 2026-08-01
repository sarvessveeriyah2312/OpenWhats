import { config } from '../config.js';
import { getAppState, setAppState } from '../store/db.js';
import { updateMessageStatus } from '../store/messages.js';
import {
  recordSend,
  hourlyCount,
  dailyCount,
  isNewContact,
  newContactsToday,
} from '../store/send-log.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let consecutiveErrors = 0;
let backoffUntil = 0; // hard pause: no sends attempted until this timestamp
let cooldownUntil = 0; // soft widen: delays are multiplied until this timestamp

const deferredQueue = [];
let workerTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call once the WhatsApp session first reaches "connected" — anchors the warm-up curve. */
export function recordFirstConnectionIfNeeded() {
  if (!getAppState('first_connected_at')) {
    setAppState('first_connected_at', String(Date.now()));
  }
}

export function getAccountAgeDays() {
  const firstConnectedAt = getAppState('first_connected_at');
  if (!firstConnectedAt) return 0;
  return Math.floor((Date.now() - Number(firstConnectedAt)) / DAY_MS);
}

/** Resolves the warm-up schedule (or the flat cap, if warm-up is disabled) for today. */
export function getCurrentDailyCap() {
  if (!config.rateGate.warmupEnabled) return config.rateGate.dailyCap;

  const currentDay = getAccountAgeDays() + 1; // 1-indexed: day of first connection is day 1
  let cap = config.rateGate.dailyCap;
  for (const tier of config.rateGate.warmupSchedule) {
    if (currentDay >= tier.fromDay) cap = tier.cap;
  }
  return cap;
}

/**
 * Checks every throttling layer (backoff, hourly/daily caps, warm-up curve,
 * new-contact cap) for a send to `chatId`. On success, immediately reserves
 * the slot (records the attempt) so a burst of concurrent checks can't all
 * pass before any of them are recorded.
 */
export function checkAndReserve(chatId) {
  const now = Date.now();

  if (now < backoffUntil) {
    return { ok: false, reason: 'backoff', retryAfterMs: backoffUntil - now };
  }

  if (hourlyCount() >= config.rateGate.hourlyCap) {
    return { ok: false, reason: 'hourly_cap', retryAfterMs: HOUR_MS };
  }

  const dailyCap = getCurrentDailyCap();
  if (dailyCount() >= dailyCap) {
    return { ok: false, reason: 'daily_cap', retryAfterMs: DAY_MS };
  }

  if (isNewContact(chatId) && newContactsToday() >= config.rateGate.newContactDailyCap) {
    return { ok: false, reason: 'new_contact_cap', retryAfterMs: DAY_MS };
  }

  recordSend(chatId);
  return { ok: true };
}

function noteSendError(err) {
  consecutiveErrors += 1;
  if (consecutiveErrors >= config.rateGate.errorBackoffThreshold) {
    const tier = consecutiveErrors - config.rateGate.errorBackoffThreshold;
    const backoffMs = Math.min(
      config.rateGate.errorBackoffBaseMs * 2 ** tier,
      config.rateGate.errorBackoffMaxMs
    );
    backoffUntil = Date.now() + backoffMs;
    cooldownUntil = backoffUntil + backoffMs;
    console.warn(
      `[rate-gate] ${consecutiveErrors} consecutive send errors (latest: ${err.message}) — ` +
        `pausing sends for ${Math.round(backoffMs / 1000)}s, widening delays after that`
    );
  }
}

function noteSendSuccess() {
  if (consecutiveErrors > 0) {
    console.log('[rate-gate] send succeeded — clearing error backoff state');
  }
  consecutiveErrors = 0;
}

function randomDelay() {
  const { minDelayMs, maxDelayMs } = config.rateGate;
  const widen = Date.now() < cooldownUntil ? 2.5 : 1;
  const min = minDelayMs * widen;
  const max = maxDelayMs * widen;
  return Math.floor(min + Math.random() * (max - min));
}

export function randomChunkPause() {
  const { chunkPauseMinMs, chunkPauseMaxMs } = config.rateGate;
  return Math.floor(chunkPauseMinMs + Math.random() * (chunkPauseMaxMs - chunkPauseMinMs));
}

// A promise chain, not a boolean flag: this is what actually enforces "one
// send in flight at a time, always spaced out" *globally* — across
// concurrent foreground requests, a bulk loop, and the background queue
// all calling executeSend independently. Without it, two callers could
// each pass their own cap check and then race their delay+send in
// parallel, silently reintroducing the bursty pattern this module exists
// to prevent.
let sendChain = Promise.resolve();

/**
 * The single choke point every actual Baileys send passes through: applies
 * the randomized per-message delay, then calls `sendFn()` — callers pass an
 * already-bound send function so rate-gate stays agnostic to message
 * content (text/media/etc). Tracks success/error for the auto-backoff
 * mechanism.
 */
export function executeSend({ sendFn }) {
  const attempt = sendChain.then(() => sleep(randomDelay())).then(async () => {
    try {
      const result = await sendFn();
      noteSendSuccess();
      return { messageId: result.key.id };
    } catch (err) {
      noteSendError(err);
      throw err;
    }
  });

  // Advance the chain regardless of outcome, so one failed send doesn't
  // wedge everyone queued behind it.
  sendChain = attempt.catch(() => {});
  return attempt;
}

/** Pushes a send that couldn't clear the cap right now onto the background queue. */
export function enqueueDeferred({ to, logId, sendFn }) {
  deferredQueue.push({ to, logId, sendFn });
  updateMessageStatus(logId, 'queued');
  startQueueWorker();
  return deferredQueue.length;
}

let workerBusy = false;

function startQueueWorker() {
  if (workerTimer) return;
  workerTimer = setInterval(async () => {
    // executeSend's delay (further widened during a post-backoff cooldown)
    // can exceed the tick interval — without this guard, an overlapping
    // tick could shift and send a second task concurrently, defeating the
    // "one at a time, always spaced out" guarantee this queue exists for.
    if (workerBusy || deferredQueue.length === 0) return;

    const task = deferredQueue[0];
    const check = checkAndReserve(task.to);
    if (!check.ok) return; // still capped — try again next tick

    deferredQueue.shift();
    workerBusy = true;
    try {
      await executeSend({ sendFn: task.sendFn });
      updateMessageStatus(task.logId, 'sent');
    } catch (err) {
      updateMessageStatus(task.logId, 'failed', err.message);
    } finally {
      workerBusy = false;
    }
  }, config.rateGate.queueWorkerIntervalMs);
}

export function interpolateTemplate(template, vars = {}) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  );
}

export function getStatus() {
  const now = Date.now();
  return {
    hourly: { count: hourlyCount(), cap: config.rateGate.hourlyCap },
    daily: { count: dailyCount(), cap: getCurrentDailyCap() },
    newContacts: { count: newContactsToday(), cap: config.rateGate.newContactDailyCap },
    accountAgeDays: getAccountAgeDays(),
    warmupEnabled: config.rateGate.warmupEnabled,
    queueLength: deferredQueue.length,
    consecutiveErrors,
    backoffUntil: backoffUntil > now ? backoffUntil : null,
    cooldownUntil: cooldownUntil > now ? cooldownUntil : null,
  };
}
