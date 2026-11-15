import type { FastifyInstance } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import { getAuthenticatedAdmin } from '../auth/guard.js';

type RuleInput = {
  daysBefore?: unknown;
  enabled?: unknown;
  timesPerDay?: unknown;
};

type RulesBody = {
  rules?: unknown;
};

function readRules(database: SqliteDatabase) {
  return database
    .prepare(
      `SELECT id, days_before, enabled, times_per_day, created_at_utc, updated_at_utc
       FROM reminder_rules
       ORDER BY days_before DESC`,
    )
    .all() as Array<{
    id: number;
    days_before: number;
    enabled: number;
    times_per_day: number;
    created_at_utc: string;
    updated_at_utc: string;
  }>;
}

function toResponse(rows: ReturnType<typeof readRules>) {
  return rows.map((row) => ({
    id: row.id,
    daysBefore: row.days_before,
    enabled: Boolean(row.enabled),
    timesPerDay: row.times_per_day,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
  }));
}

export function registerReminderRuleRoutes(app: FastifyInstance, database: SqliteDatabase): void {
  app.get('/api/reminder-rules', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    return { rules: toResponse(readRules(database)) };
  });

  app.patch<{ Body: RulesBody }>('/api/reminder-rules', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    if (!Array.isArray(request.body?.rules) || request.body.rules.length === 0 || request.body.rules.length > 24) {
      return reply.code(400).send({ error: 'INVALID_RULES' });
    }

    let normalized: Array<{ daysBefore: number; timesPerDay: number; enabled: number }>;

    try {
      normalized = request.body.rules.map((rawRule) => {
        const rule = rawRule as RuleInput;
        const daysBefore = typeof rule.daysBefore === 'number' ? rule.daysBefore : Number.NaN;
        const timesPerDay = typeof rule.timesPerDay === 'number' ? rule.timesPerDay : Number.NaN;

        if (
          !Number.isSafeInteger(daysBefore) ||
          daysBefore < 0 ||
          daysBefore > 365 ||
          !Number.isSafeInteger(timesPerDay) ||
          timesPerDay < 1 ||
          timesPerDay > 24 ||
          typeof rule.enabled !== 'boolean'
        ) {
          throw new Error('INVALID_RULES');
        }

        return { daysBefore, timesPerDay, enabled: rule.enabled ? 1 : 0 };
      });
    } catch {
      return reply.code(400).send({ error: 'INVALID_RULES' });
    }
    const uniqueDays = new Set(normalized.map((rule) => rule.daysBefore));

    if (uniqueDays.size !== normalized.length) {
      return reply.code(400).send({ error: 'DUPLICATE_RULE_DAYS' });
    }

    const timestamp = new Date().toISOString();
    const save = database.transaction(() => {
      const updateRule = database.prepare(
        `INSERT INTO reminder_rules (days_before, enabled, times_per_day, updated_at_utc)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(days_before) DO UPDATE SET
           enabled = excluded.enabled,
           times_per_day = excluded.times_per_day,
           updated_at_utc = excluded.updated_at_utc`,
      );
      const days = normalized.map((rule) => rule.daysBefore);

      for (const rule of normalized) {
        updateRule.run(rule.daysBefore, rule.enabled, rule.timesPerDay, timestamp);
      }

      const placeholders = days.map(() => '?').join(', ');
      database
        .prepare(`UPDATE reminder_rules SET enabled = 0, updated_at_utc = ? WHERE days_before NOT IN (${placeholders})`)
        .run(timestamp, ...days);
    });
    save();

    return {
      rules: toResponse(readRules(database)),
      appliesTo: '\u65b0\u5efa\u3001\u7f16\u8f91\u5230\u671f\u65f6\u95f4\u6216\u7eed\u8d39\u540e\u751f\u6210\u7684\u8ba1\u5212',
    };
  });
}
