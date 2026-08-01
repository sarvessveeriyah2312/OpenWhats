import Database from 'better-sqlite3';
import { config } from '../config.js';

export const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    chat_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    body TEXT,
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);

  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    url TEXT NOT NULL,
    event TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    success INTEGER NOT NULL,
    response_status INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages (id)
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS send_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_send_log_created_at ON send_log (created_at DESC);

  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export function getAppState(key) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setAppState(key, value) {
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}
