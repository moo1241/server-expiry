import type { Migration } from '../types.js';

export const adminRecoveryMigration: Migration = {
  version: '005_admin_recovery',
  sql: `
CREATE TABLE admin_recovery_tokens (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at_utc TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  used_at_utc TEXT,
  FOREIGN KEY (admin_id) REFERENCES admin_accounts (id) ON DELETE CASCADE
);

CREATE INDEX admin_recovery_tokens_lookup_idx
  ON admin_recovery_tokens (token_hash, expires_at_utc, used_at_utc);
`,
};
