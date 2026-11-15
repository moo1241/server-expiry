import type { FastifyInstance } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import { getAuthenticatedAdmin } from '../auth/guard.js';

export const defaultDisplayTimezone = 'Asia/Shanghai';
const supportedTimezones = new Set(['Asia/Shanghai', 'UTC']);

type SettingsBody = {
  displayTimezone?: unknown;
};

function isValidTimezone(value: string): boolean {
  return supportedTimezones.has(value);
}

export function readDisplayTimezone(database: SqliteDatabase): string {
  const row = database
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get('display_timezone') as { value: string } | undefined;

  return row?.value && isValidTimezone(row.value) ? row.value : defaultDisplayTimezone;
}

export function registerSettingsRoutes(app: FastifyInstance, database: SqliteDatabase): void {
  app.get('/api/settings', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    return { displayTimezone: readDisplayTimezone(database) };
  });

  app.patch<{ Body: SettingsBody }>('/api/settings', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    const timezone = request.body?.displayTimezone;

    if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
      return reply.code(400).send({ error: 'INVALID_TIMEZONE' });
    }

    const timestamp = new Date().toISOString();
    const update = database.transaction(() => {
      database
        .prepare(
          `INSERT INTO app_settings (key, value, updated_at_utc)
           VALUES ('display_timezone', ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at_utc = excluded.updated_at_utc`,
        )
        .run(timezone, timestamp);
    });
    update();

    return { displayTimezone: timezone };
  });
}
