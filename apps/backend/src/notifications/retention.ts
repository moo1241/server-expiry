import type { SqliteDatabase } from '../db/database.js';

export function cleanupNotificationHistory(database: SqliteDatabase, retentionDays = 10): number {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const cleanup = database.transaction(() => {
    const result = database
      .prepare('DELETE FROM notification_attempts WHERE started_at_utc < ?')
      .run(cutoff);

    database
      .prepare(
        `DELETE FROM notification_plans
         WHERE updated_at_utc < ?
           AND status IN ('sent', 'cancelled')
           AND NOT EXISTS (
             SELECT 1 FROM notification_attempts a WHERE a.plan_id = notification_plans.id
           )`,
      )
      .run(cutoff);

    return result.changes;
  });

  return cleanup();
}
