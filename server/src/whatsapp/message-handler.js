import { logMessage } from '../store/messages.js';
import { dispatchWebhook } from './webhook-dispatcher.js';

function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    null
  );
}

function extractType(message) {
  if (message?.conversation || message?.extendedTextMessage) return 'text';
  if (message?.imageMessage) return 'image';
  if (message?.videoMessage) return 'video';
  if (message?.documentMessage) return 'document';
  if (message?.audioMessage) return 'audio';
  return 'unknown';
}

/**
 * Wires session-manager's raw `messages.upsert` events into: message log +
 * outgoing webhook dispatch. This is the "reverse" half of the app — turning
 * inbound WhatsApp traffic into HTTP calls to the user's own backend.
 */
export function handleInboundMessages({ messages, type }) {
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (msg.key.fromMe) continue;

    const from = msg.key.remoteJid;
    const body = extractText(msg.message);
    const msgType = extractType(msg.message);
    const timestamp = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);

    const logId = logMessage({
      messageId: msg.key.id,
      direction: 'inbound',
      chatId: from,
      type: msgType,
      body,
      status: 'received',
    });

    dispatchWebhook(
      'message',
      {
        event: 'message',
        from,
        message: { type: msgType, body },
        timestamp,
      },
      { logMessageId: logId }
    ).catch(() => {
      // dispatchWebhook already logs failures to the message store; nothing
      // further to do here.
    });
  }
}
