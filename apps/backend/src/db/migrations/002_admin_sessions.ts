import type { Migration } from '../types.js';

export const adminSessionsMigration: Migration = {
  version: '002_admin_sessions',
  sql: `
CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at_utc TEXT NOT NULL,
  last_seen_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at_utc TEXT,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (admin_id) REFERENCES admin_accounts (id) ON DELETE CASCADE
);

CREATE INDEX admin_sessions_lookup_idx
  ON admin_sessions (token_hash, expires_at_utc, revoked_at_utc);

CREATE INDEX admin_sessions_admin_idx
  ON admin_sessions (admin_id, expires_at_utc);
`,
};
