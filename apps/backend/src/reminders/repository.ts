import type { SqliteDatabase } from '../db/database.js';
import { defaultRetryPolicy, retryAtUtc } from './retry.js';
import type { DeliveryResult, ReminderPlan, RetryPolicy } from './types.js';

type ClaimedPlan = ReminderPlan & {
  attemptNumber: number;
};

type PlanRow = {
  id: number;
  server_id: number;
  server_name: string;
  ip_address: string;
  provider: string;
  region: string;
  expires_at_utc: string;
  plan_generation: number;
  trigger_days_before: number;
  occurrence_index: number;
  times_per_day: number;
  scheduled_for_utc: string;
  attempt_count: number;
};

function planFromRow(row: PlanRow): ReminderPlan {
  return {
    id: row.id,
    serverId: row.server_id,
    serverName: row.server_name,
    ipAddress: row.ip_address,
    provider: row.provider,
    region: row.region,
    expiresAtUtc: row.expires_at_utc,
    planGeneration: row.plan_generation,
    triggerDaysBefore: row.trigger_days_before,
    occurrenceIndex: row.occurrence_index,
    timesPerDay: row.times_per_day,
    scheduledForUtc: row.scheduled_for_utc,
    attemptNumber: row.attempt_count,
  };
}

function duePlanQuery(): string {
  return `
    SELECT p.id, p.server_id, s.name AS server_name, s.ip_address, s.provider, s.region,
           s.expires_at_utc, p.plan_generation, p.trigger_days_before,
           p.occurrence_index, p.times_per_day,
           p.scheduled_for_utc, p.attempt_count
    FROM notification_plans p
    INNER JOIN servers s ON s.id = p.server_id
    WHERE p.status IN ('pending', 'failed', 'unknown')
      AND s.status = 'active'
      AND p.scheduled_for_utc <= ?
      AND (p.status = 'pending' OR (p.next_attempt_at_utc IS NOT NULL AND p.next_attempt_at_utc <= ?))
    ORDER BY p.scheduled_for_utc ASC, p.id ASC
    LIMIT 1`;
}

function coalesceOverduePlans(database: SqliteDatabase, nowUtc: string): void {
  database
    .prepare(
      `UPDATE notification_plans AS older
       SET status = 'cancelled', cancelled_at_utc = ?, updated_at_utc = ?,
           last_error_code = 'CATCH_UP_COALESCED',
           last_error_message = 'Older overdue reminder was coalesced into the latest reminder'
       WHERE older.status IN ('pending', 'failed', 'unknown')
         AND older.scheduled_for_utc <= ?
         AND EXISTS (
           SELECT 1
           FROM notification_plans AS newer
           WHERE newer.server_id = older.server_id
             AND newer.status IN ('pending', 'failed', 'unknown')
             AND newer.scheduled_for_utc <= ?
             AND (
               newer.scheduled_for_utc > older.scheduled_for_utc
               OR (newer.scheduled_for_utc = older.scheduled_for_utc AND newer.id > older.id)
             )
         )`,
    )
    .run(nowUtc, nowUtc, nowUtc, nowUtc);
}

export function claimDuePlan(database: SqliteDatabase, now = new Date()): ClaimedPlan | undefined {
  const nowUtc = now.toISOString();
  const claim = database.transaction(() => {
    coalesceOverduePlans(database, nowUtc);
    const row = database.prepare(duePlanQuery()).get(nowUtc, nowUtc) as PlanRow | undefined;

    if (!row) {
      return undefined;
    }

    const attemptNumber = row.attempt_count + 1;
    database
      .prepare(
        `UPDATE notification_plans
         SET status = 'processing', attempt_count = ?, processing_started_at_utc = ?,
             next_attempt_at_utc = NULL, updated_at_utc = ?
         WHERE id = ? AND status IN ('pending', 'failed', 'unknown')`,
      )
      .run(attemptNumber, nowUtc, nowUtc, row.id);
    database
      .prepare(
        `INSERT INTO notification_attempts
          (plan_id, attempt_number, outcome, started_at_utc, retryable)
         VALUES (?, ?, 'unknown', ?, 0)`,
      )
      .run(row.id, attemptNumber, nowUtc);

    return planFromRow({ ...row, attempt_count: attemptNumber });
  });

  return claim.immediate();
}

export function completePlan(
  database: SqliteDatabase,
  plan: ClaimedPlan,
  result: DeliveryResult,
  now = new Date(),
  policy: RetryPolicy = defaultRetryPolicy,
): void {
  const nowUtc = now.toISOString();
  const retryAt = result.outcome === 'sent' ? null : result.retryable ? retryAtUtc(now, plan.attemptNumber, policy) : null;
  const finish = database.transaction(() => {
    if (result.outcome === 'sent') {
      const planUpdate = database
        .prepare(
          `UPDATE notification_plans
           SET status = 'sent', sent_at_utc = ?, processing_started_at_utc = NULL,
               next_attempt_at_utc = NULL, last_error_code = NULL, last_error_message = NULL,
               updated_at_utc = ?
           WHERE id = ? AND status = 'processing'`,
        )
        .run(nowUtc, nowUtc, plan.id);

      if (planUpdate.changes !== 1) {
        database
          .prepare(
            `UPDATE notification_attempts
             SET outcome = 'unknown', finished_at_utc = ?, error_code = 'PLAN_NOT_PROCESSING',
                 error_message = 'Plan was cancelled or changed while delivery was in flight', retryable = 0
             WHERE plan_id = ? AND attempt_number = ?`,
          )
          .run(nowUtc, plan.id, plan.attemptNumber);
        return;
      }

      database
        .prepare(
          `UPDATE notification_attempts
           SET outcome = 'sent', finished_at_utc = ?, telegram_message_id = ?, retryable = 0
           WHERE plan_id = ? AND attempt_number = ?`,
        )
        .run(nowUtc, result.messageId ?? null, plan.id, plan.attemptNumber);
      return;
    }

    const planUpdate = database
      .prepare(
        `UPDATE notification_plans
         SET status = ?, processing_started_at_utc = NULL, next_attempt_at_utc = ?,
             last_error_code = ?, last_error_message = ?, updated_at_utc = ?
         WHERE id = ? AND status = 'processing'`,
      )
      .run(result.outcome, retryAt, result.errorCode, result.errorMessage, nowUtc, plan.id);

    if (planUpdate.changes !== 1) {
      database
        .prepare(
          `UPDATE notification_attempts
           SET outcome = 'unknown', finished_at_utc = ?, error_code = 'PLAN_NOT_PROCESSING',
               error_message = 'Plan was cancelled or changed while delivery was in flight', retryable = 0
           WHERE plan_id = ? AND attempt_number = ?`,
        )
        .run(nowUtc, plan.id, plan.attemptNumber);
      return;
    }

    database
      .prepare(
        `UPDATE notification_attempts
         SET outcome = ?, finished_at_utc = ?, error_code = ?, error_message = ?, retryable = ?
         WHERE plan_id = ? AND attempt_number = ?`,
      )
      .run(result.outcome, nowUtc, result.errorCode, result.errorMessage, retryAt ? 1 : 0, plan.id, plan.attemptNumber);
  });

  finish();
}

export function recoverStalePlans(
  database: SqliteDatabase,
  now = new Date(),
  policy: RetryPolicy = defaultRetryPolicy,
): number {
  const nowUtc = now.toISOString();
  const cutoffUtc = new Date(now.getTime() - policy.processingTimeoutSeconds * 1000).toISOString();
  const recover = database.transaction(() => {
    const rows = database
      .prepare(
        `SELECT id, attempt_count
         FROM notification_plans
         WHERE status = 'processing' AND processing_started_at_utc <= ?`,
      )
      .all(cutoffUtc) as Array<{ id: number; attempt_count: number }>;

    for (const row of rows) {
      const retryAt = retryAtUtc(now, row.attempt_count, policy);
      database
        .prepare(
          `UPDATE notification_attempts
           SET outcome = 'unknown', finished_at_utc = ?, error_code = 'PROCESSING_TIMEOUT',
               error_message = 'Notification processing lease expired', retryable = ?
           WHERE plan_id = ? AND attempt_number = ? AND finished_at_utc IS NULL`,
        )
        .run(nowUtc, retryAt ? 1 : 0, row.id, row.attempt_count);
      database
        .prepare(
          `UPDATE notification_plans
           SET status = 'unknown', processing_started_at_utc = NULL, next_attempt_at_utc = ?,
               last_error_code = 'PROCESSING_TIMEOUT',
               last_error_message = 'Notification processing lease expired', updated_at_utc = ?
           WHERE id = ?`,
        )
        .run(retryAt, nowUtc, row.id);
    }

    return rows.length;
  });

  return recover();
}
