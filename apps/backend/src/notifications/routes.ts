import type { FastifyInstance } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import { getAuthenticatedAdmin } from '../auth/guard.js';

type NotificationQuery = {
  outcome?: string;
  limit?: string;
};

type DeleteBody = {
  ids?: unknown;
  all?: unknown;
};

const allowedOutcomes = new Set(['sent', 'failed', 'unknown']);

export function registerNotificationRoutes(app: FastifyInstance, database: SqliteDatabase): void {
  app.get<{ Querystring: NotificationQuery }>('/api/notifications', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    const requestedLimit = Number.parseInt(request.query.limit ?? '50', 10);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 && requestedLimit <= 100 ? requestedLimit : 50;
    const outcome = request.query.outcome ?? 'all';

    if (outcome !== 'all' && !allowedOutcomes.has(outcome)) {
      return reply.code(400).send({ error: 'INVALID_QUERY' });
    }

    const where = outcome === 'all' ? '' : 'WHERE a.outcome = ?';
    const parameters = outcome === 'all' ? [] : [outcome];
    const totalRow = database
      .prepare(`SELECT COUNT(*) AS count FROM notification_attempts a ${where}`)
      .get(...parameters) as { count: number };
    const rows = database
      .prepare(
        `SELECT a.id, a.plan_id, a.attempt_number, a.outcome, a.started_at_utc,
                a.finished_at_utc, a.telegram_message_id, a.error_code, a.error_message,
                a.retryable, p.server_id, p.plan_generation, p.trigger_days_before,
                p.occurrence_index, p.times_per_day,
                p.scheduled_for_utc, s.name AS server_name
         FROM notification_attempts a
         INNER JOIN notification_plans p ON p.id = a.plan_id
         INNER JOIN servers s ON s.id = p.server_id
         ${where}
         ORDER BY a.started_at_utc DESC, a.id DESC
         LIMIT ?`,
      )
      .all(...parameters, limit) as Array<Record<string, unknown>>;

    return {
      items: rows.map((row) => ({
        id: row.id,
        planId: row.plan_id,
        attemptNumber: row.attempt_number,
        outcome: row.outcome,
        startedAtUtc: row.started_at_utc,
        finishedAtUtc: row.finished_at_utc,
        telegramMessageId: row.telegram_message_id,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        retryable: Boolean(row.retryable),
        serverId: row.server_id,
        serverName: row.server_name,
        planGeneration: row.plan_generation,
        triggerDaysBefore: row.trigger_days_before,
        occurrenceIndex: row.occurrence_index,
        timesPerDay: row.times_per_day,
        scheduledForUtc: row.scheduled_for_utc,
      })),
      total: totalRow.count,
      limit,
    };
  });

  app.delete<{ Params: { id: string } }>('/api/notifications/:id', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'INVALID_ID' });
    }

    const remove = database.transaction(() => {
      database.prepare('DELETE FROM notification_attempts WHERE id = ?').run(id);
    });
    remove();
    return reply.code(204).send();
  });

  app.delete<{ Body: DeleteBody }>('/api/notifications', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    const body = request.body ?? {};
    if (body.all === true) {
      const removeAll = database.transaction(() => {
        return database.prepare('DELETE FROM notification_attempts').run().changes;
      });
      return { deleted: removeAll() };
    }

    if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 500) {
      return reply.code(400).send({ error: 'INVALID_IDS' });
    }

    const ids = body.ids.map((value) => Number(value));
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(id))) {
      return reply.code(400).send({ error: 'INVALID_IDS' });
    }

    const removeSelected = database.transaction(() => {
      const remove = database.prepare('DELETE FROM notification_attempts WHERE id = ?');
      let deleted = 0;
      for (const id of ids) deleted += remove.run(id).changes;
      return deleted;
    });

    return { deleted: removeSelected() };
  });
}
