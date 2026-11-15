import type { Migration } from '../types.js';

export const reminderProcessingMigration: Migration = {
  version: '003_reminder_processing',
  sql: `
ALTER TABLE notification_plans
  ADD COLUMN processing_started_at_utc TEXT;

CREATE INDEX notification_plans_processing_idx
  ON notification_plans (status, processing_started_at_utc);
`,
};
