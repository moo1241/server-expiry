import type { Migration } from '../types.js';

export const reminderFrequencyMigration: Migration = {
  version: '004_reminder_frequency',
  sql: `
ALTER TABLE reminder_rules
  ADD COLUMN times_per_day INTEGER NOT NULL DEFAULT 1 CHECK (times_per_day BETWEEN 1 AND 24);

INSERT OR IGNORE INTO reminder_rules (days_before, enabled, times_per_day)
VALUES (2, 1, 1);

UPDATE reminder_rules
SET enabled = 0
WHERE days_before IN (30, 15);

UPDATE notification_plans
SET status = 'cancelled',
    cancelled_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    last_error_code = 'RULE_DISABLED',
    last_error_message = 'Reminder rule disabled during frequency migration'
WHERE trigger_days_before IN (30, 15)
  AND status IN ('pending', 'processing', 'failed', 'unknown');

DROP INDEX IF EXISTS notification_plans_due_idx;
DROP INDEX IF EXISTS notification_plans_processing_idx;
DROP INDEX IF EXISTS notification_attempts_plan_idx;

ALTER TABLE notification_attempts RENAME TO notification_attempts_legacy;
ALTER TABLE notification_plans RENAME TO notification_plans_legacy;

CREATE TABLE notification_plans (
  id INTEGER PRIMARY KEY,
  server_id INTEGER NOT NULL,
  plan_generation INTEGER NOT NULL CHECK (plan_generation > 0),
  trigger_days_before INTEGER NOT NULL CHECK (trigger_days_before >= 0),
  occurrence_index INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_index > 0),
  times_per_day INTEGER NOT NULL DEFAULT 1 CHECK (times_per_day BETWEEN 1 AND 24),
  scheduled_for_utc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'unknown')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at_utc TEXT,
  sent_at_utc TEXT,
  cancelled_at_utc TEXT,
  processing_started_at_utc TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
  UNIQUE (server_id, plan_generation, trigger_days_before, occurrence_index)
);

INSERT INTO notification_plans (
  id, server_id, plan_generation, trigger_days_before, occurrence_index, times_per_day,
  scheduled_for_utc, status, attempt_count, next_attempt_at_utc, sent_at_utc,
  cancelled_at_utc, processing_started_at_utc, last_error_code, last_error_message,
  created_at_utc, updated_at_utc
)
SELECT id, server_id, plan_generation, trigger_days_before, 1, 1,
       scheduled_for_utc, status, attempt_count, next_attempt_at_utc, sent_at_utc,
       cancelled_at_utc, processing_started_at_utc, last_error_code, last_error_message,
       created_at_utc, updated_at_utc
FROM notification_plans_legacy;

CREATE INDEX notification_plans_due_idx
  ON notification_plans (status, scheduled_for_utc);

CREATE INDEX notification_plans_processing_idx
  ON notification_plans (status, processing_started_at_utc);

CREATE INDEX notification_plans_server_idx
  ON notification_plans (server_id, plan_generation, trigger_days_before);

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

INSERT INTO notification_attempts (
  id, plan_id, attempt_number, outcome, started_at_utc, finished_at_utc,
  telegram_message_id, error_code, error_message, retryable
)
SELECT id, plan_id, attempt_number, outcome, started_at_utc, finished_at_utc,
       telegram_message_id, error_code, error_message, retryable
FROM notification_attempts_legacy;

CREATE INDEX notification_attempts_plan_idx
  ON notification_attempts (plan_id, attempt_number);

DROP TABLE notification_attempts_legacy;
DROP TABLE notification_plans_legacy;
`,
};
