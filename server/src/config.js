import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

// Parses "1:50,4:100,8:200" into [{ fromDay: 1, cap: 50 }, { fromDay: 4, cap: 100 }, { fromDay: 8, cap: 200 }]
function parseWarmupSchedule(value, fallback) {
  const raw = value || fallback;
  return raw
    .split(',')
    .map((pair) => {
      const [fromDay, cap] = pair.split(':').map(Number);
      return { fromDay, cap };
    })
    .filter((tier) => Number.isFinite(tier.fromDay) && Number.isFinite(tier.cap))
    .sort((a, b) => a.fromDay - b.fromDay);
}

// Absolute floors that no env var can go below — these exist so a
// misconfigured .env can't turn off anti-ban protection entirely.
const MIN_RATE_DELAY_FLOOR_MS = 1000;
const MIN_HOURLY_CAP_FLOOR = 5;
const MIN_DAILY_CAP_FLOOR = 20;

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',

  requireApiKey: bool(process.env.REQUIRE_API_KEY, false),
  apiKey: process.env.API_KEY || '',

  authDir: process.env.AUTH_DIR || path.join(serverRoot, '.baileys-auth'),
  dbPath: process.env.DB_PATH || path.join(serverRoot, 'data.sqlite'),

  webhookTimeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS) || 10000,
  webhookMaxRetries: 3,

  rateGate: {
    minDelayMs: Math.max(
      MIN_RATE_DELAY_FLOOR_MS,
      Number(process.env.RATE_MIN_DELAY_MS) || 1500
    ),
    maxDelayMs: Math.max(
      Number(process.env.RATE_MAX_DELAY_MS) || 4000,
      Number(process.env.RATE_MIN_DELAY_MS) || 1500
    ),
    hourlyCap: Math.max(MIN_HOURLY_CAP_FLOOR, Number(process.env.RATE_HOURLY_CAP) || 40),
    dailyCap: Math.max(MIN_DAILY_CAP_FLOOR, Number(process.env.RATE_DAILY_CAP) || 200),
    newContactDailyCap: Number(process.env.RATE_NEW_CONTACT_DAILY_CAP) || 25,

    bulkChunkSize: Math.max(1, Number(process.env.RATE_BULK_CHUNK_SIZE) || 15),
    chunkPauseMinMs: Number(process.env.RATE_CHUNK_PAUSE_MIN_MS) || 30000,
    chunkPauseMaxMs: Number(process.env.RATE_CHUNK_PAUSE_MAX_MS) || 90000,

    warmupEnabled: bool(process.env.RATE_WARMUP_ENABLED, true),
    warmupSchedule: parseWarmupSchedule(process.env.RATE_WARMUP_SCHEDULE, '1:50,4:100,8:200'),

    // Consecutive send failures before the queue auto-backs-off.
    errorBackoffThreshold: Number(process.env.RATE_ERROR_BACKOFF_THRESHOLD) || 3,
    errorBackoffBaseMs: Number(process.env.RATE_ERROR_BACKOFF_BASE_MS) || 30000,
    errorBackoffMaxMs: Number(process.env.RATE_ERROR_BACKOFF_MAX_MS) || 30 * 60 * 1000,

    // How often the background worker retries queued (over-cap) sends.
    queueWorkerIntervalMs: Number(process.env.RATE_QUEUE_WORKER_INTERVAL_MS) || 10000,
  },
};
