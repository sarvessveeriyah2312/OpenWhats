import { db } from './db.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function recordSend(chatId) {
  db.prepare('INSERT INTO send_log (chat_id, created_at) VALUES (?, ?)').run(chatId, Date.now());
}

export function countSince(ms) {
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM send_log WHERE created_at >= ?')
    .get(Date.now() - ms);
  return count;
}

export function hourlyCount() {
  return countSince(HOUR_MS);
}

export function dailyCount() {
  return countSince(DAY_MS);
}

// A contact is "new" if we have no prior message (either direction) with
// them at all — i.e. this would be the first-ever exchange with this chat.
export function isNewContact(chatId) {
  const row = db.prepare('SELECT 1 FROM messages WHERE chat_id = ? LIMIT 1').get(chatId);
  return !row;
}

// Counts distinct chat_ids whose very first message (inbound or outbound,
// ever) happened within the last 24h — i.e. contacts that became "known"
// to us today, used against the new-contact daily cap.
export function newContactsToday() {
  const { count } = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT chat_id, MIN(created_at) AS first_ts
         FROM messages
         GROUP BY chat_id
         HAVING first_ts >= ?
       )`
    )
    .get(Date.now() - DAY_MS);
  return count;
}
