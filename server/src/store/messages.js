import { db } from './db.js';

export function logMessage({
  messageId = null,
  direction,
  chatId,
  type = 'text',
  body = null,
  mediaUrl = null,
  status = 'pending',
  error = null,
}) {
  const result = db
    .prepare(
      `INSERT INTO messages
        (message_id, direction, chat_id, type, body, media_url, status, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(messageId, direction, chatId, type, body, mediaUrl, status, error, Date.now());

  return result.lastInsertRowid;
}

export function updateMessageStatus(id, status, error = null) {
  db.prepare('UPDATE messages SET status = ?, error = ? WHERE id = ?').run(status, error, id);
}

export function listMessages({ page = 1, pageSize = 25, direction = null } = {}) {
  const offset = (page - 1) * pageSize;
  const where = direction ? 'WHERE direction = ?' : '';
  const params = direction ? [direction] : [];

  const items = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM messages ${where}`)
    .get(...params);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function recordWebhookDelivery({
  messageId = null,
  url,
  event,
  attempt,
  success,
  responseStatus = null,
  error = null,
}) {
  db.prepare(
    `INSERT INTO webhook_deliveries
      (message_id, url, event, attempt, success, response_status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(messageId, url, event, attempt, success ? 1 : 0, responseStatus, error, Date.now());
}
