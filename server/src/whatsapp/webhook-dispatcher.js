import { config } from '../config.js';
import { listWebhooksForEvent } from '../store/webhooks.js';
import { recordWebhookDelivery, updateMessageStatus } from '../store/messages.js';

const BACKOFF_BASE_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverToWebhook(url, event, payload, logMessageId) {
  for (let attempt = 1; attempt <= config.webhookMaxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.webhookTimeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      recordWebhookDelivery({
        messageId: logMessageId,
        url,
        event,
        attempt,
        success: res.ok,
        responseStatus: res.status,
      });

      if (res.ok) return;
      if (attempt === config.webhookMaxRetries && logMessageId) {
        updateMessageStatus(logMessageId, 'webhook_failed', `HTTP ${res.status}`);
      }
    } catch (err) {
      recordWebhookDelivery({
        messageId: logMessageId,
        url,
        event,
        attempt,
        success: false,
        error: err.message,
      });
      if (attempt === config.webhookMaxRetries && logMessageId) {
        updateMessageStatus(logMessageId, 'webhook_failed', err.message);
      }
    }

    if (attempt < config.webhookMaxRetries) {
      await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
    }
  }
}

/**
 * Fans a single event out to every configured webhook subscribed to it.
 * Each webhook gets its own independent retry-with-backoff attempt, and
 * every attempt (success or failure) is recorded so failed deliveries are
 * visible in the dashboard's Logs page.
 */
export async function dispatchWebhook(event, payload, { logMessageId = null } = {}) {
  const webhooks = listWebhooksForEvent(event);
  await Promise.all(webhooks.map((wh) => deliverToWebhook(wh.url, event, payload, logMessageId)));
}
