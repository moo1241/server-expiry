import type { Migration } from '../types.js';

export const initialMigration: Migration = {
  version: '001_initial',
  sql: `
CREATE TABLE admin_accounts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE servers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  provider TEXT NOT NULL,
  region TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  renewal_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  reminder_generation INTEGER NOT NULL DEFAULT 1 CHECK (reminder_generation > 0),
  archived_at_utc TEXT,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX servers_status_expires_idx
  ON servers (status, expires_at_utc);

CREATE TABLE reminder_rules (
  id INTEGER PRIMARY KEY,
  days_before INTEGER NOT NULL CHECK (days_before >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (days_before)
);

CREATE TABLE notification_plans (
  id INTEGER PRIMARY KEY,
  server_id INTEGER NOT NULL,
  plan_generation INTEGER NOT NULL CHECK (plan_generation > 0),
  trigger_days_before INTEGER NOT NULL CHECK (trigger_days_before >= 0),
  scheduled_for_utc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'unknown')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at_utc TEXT,
  sent_at_utc TEXT,
  cancelled_at_utc TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
  UNIQUE (server_id, plan_generation, trigger_days_before)
);

CREATE INDEX notification_plans_due_idx
  ON notification_plans (status, scheduled_for_utc);

CREATE TABLE notification_attempts (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('sent', 'failed', 'unknown')),
  started_at_utc TEXT NOT NULL,
  finished_at_utc TEXT,
  telegram_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  retryable INTEGER NOT NULL DEFAULT 0 CHECK (retryable IN (0, 1)),
  FOREIGN KEY (plan_id) REFERENCES notification_plans (id) ON DELETE CASCADE,
  UNIQUE (plan_id, attempt_number)
);

CREATE INDEX notification_attempts_plan_idx
  ON notification_attempts (plan_id, attempt_number);

INSERT INTO reminder_rules (days_before)
VALUES (30), (15), (7), (3), (1), (0);
`,
};
