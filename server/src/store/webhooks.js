import { db } from './db.js';

function parseWebhook(row) {
  return { ...row, events: JSON.parse(row.events) };
}

export function listWebhooks({ page = 1, pageSize = 10 } = {}) {
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare('SELECT * FROM webhooks ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(pageSize, offset);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM webhooks').get();

  return {
    items: rows.map(parseWebhook),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function getWebhook(id) {
  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  return row ? parseWebhook(row) : null;
}

export function createWebhook({ url, events = [] }) {
  const result = db
    .prepare('INSERT INTO webhooks (url, events, created_at) VALUES (?, ?, ?)')
    .run(url, JSON.stringify(events), Date.now());
  return getWebhook(result.lastInsertRowid);
}

export function deleteWebhook(id) {
  const result = db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listWebhooksForEvent(event) {
  return db
    .prepare('SELECT * FROM webhooks')
    .all()
    .map(parseWebhook)
    .filter((w) => w.events.length === 0 || w.events.includes(event));
}
