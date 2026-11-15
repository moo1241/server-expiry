import type { Migration } from '../types.js';
import { initialMigration } from './001_initial.js';
import { adminSessionsMigration } from './002_admin_sessions.js';
import { reminderProcessingMigration } from './003_reminder_processing.js';
import { reminderFrequencyMigration } from './004_reminder_frequency.js';

export const migrations: readonly Migration[] = [
  initialMigration,
  adminSessionsMigration,
  reminderProcessingMigration,
  reminderFrequencyMigration,
];
