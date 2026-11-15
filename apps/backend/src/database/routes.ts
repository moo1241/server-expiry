import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import type { SqliteDatabase } from '../db/database.js';
import { getAuthenticatedAdmin } from '../auth/guard.js';

const requiredTables = [
  'admin_accounts',
  'app_settings',
  'servers',
  'reminder_rules',
  'notification_plans',
  'notification_attempts',
  'schema_migrations',
];

function temporaryPath(prefix: string): string {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.sqlite`);
}

function migrationChecksums(database: Database.Database): Map<string, string> {
  const rows = database
    .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: string; checksum: string }>;
  return new Map(rows.map((row) => [row.version, row.checksum]));
}

function validateSourceDatabase(source: Database.Database, current: SqliteDatabase): void {
  const tables = source
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  const tableNames = new Set(tables.map((table) => table.name));

  if (requiredTables.some((table) => !tableNames.has(table))) {
    throw new Error('数据库文件缺少系统所需的数据表');
  }

  const sourceAdmin = source.prepare('SELECT id FROM admin_accounts LIMIT 1').get();
  if (!sourceAdmin) {
    throw new Error('数据库文件中没有管理员账号');
  }

  const currentMigrations = migrationChecksums(current);
  const sourceMigrations = migrationChecksums(source);

  for (const [version, checksum] of currentMigrations) {
    if (sourceMigrations.get(version) !== checksum) {
      throw new Error(`数据库迁移版本不匹配：${version}`);
    }
  }
}

function rows(source: Database.Database, query: string): Array<Record<string, unknown>> {
  return source.prepare(query).all() as Array<Record<string, unknown>>;
}

function replaceData(current: SqliteDatabase, source: Database.Database): void {
  const admins = rows(source, 'SELECT id, username, password_hash, created_at_utc, updated_at_utc FROM admin_accounts');
  const settings = rows(source, 'SELECT key, value, updated_at_utc FROM app_settings');
  const servers = rows(
    source,
    `SELECT id, name, ip_address, provider, region, expires_at_utc, renewal_url, notes,
            status, reminder_generation, archived_at_utc, created_at_utc, updated_at_utc
     FROM servers`,
  );
  const rules = rows(source, 'SELECT id, days_before, enabled, times_per_day, created_at_utc, updated_at_utc FROM reminder_rules');
  const plans = rows(
    source,
    `SELECT id, server_id, plan_generation, trigger_days_before, occurrence_index, times_per_day,
            scheduled_for_utc, status, attempt_count, next_attempt_at_utc, sent_at_utc,
            cancelled_at_utc, processing_started_at_utc, last_error_code, last_error_message,
            created_at_utc, updated_at_utc
     FROM notification_plans`,
  );
  const attempts = rows(
    source,
    `SELECT id, plan_id, attempt_number, outcome, started_at_utc, finished_at_utc,
            telegram_message_id, error_code, error_message, retryable
     FROM notification_attempts`,
  );

  const replace = current.transaction(() => {
    current.prepare('DELETE FROM admin_sessions').run();
    current.prepare('DELETE FROM notification_attempts').run();
    current.prepare('DELETE FROM notification_plans').run();
    current.prepare('DELETE FROM servers').run();
    current.prepare('DELETE FROM reminder_rules').run();
    current.prepare('DELETE FROM app_settings').run();
    current.prepare('DELETE FROM admin_accounts').run();

    const insertAdmin = current.prepare(
      `INSERT INTO admin_accounts (id, username, password_hash, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const row of admins) insertAdmin.run(row.id, row.username, row.password_hash, row.created_at_utc, row.updated_at_utc);

    const insertSetting = current.prepare(
      'INSERT INTO app_settings (key, value, updated_at_utc) VALUES (?, ?, ?)',
    );
    for (const row of settings) insertSetting.run(row.key, row.value, row.updated_at_utc);

    const insertServer = current.prepare(
      `INSERT INTO servers
        (id, name, ip_address, provider, region, expires_at_utc, renewal_url, notes, status,
         reminder_generation, archived_at_utc, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of servers) {
      insertServer.run(
        row.id, row.name, row.ip_address, row.provider, row.region, row.expires_at_utc,
        row.renewal_url, row.notes, row.status, row.reminder_generation,
        row.archived_at_utc, row.created_at_utc, row.updated_at_utc,
      );
    }

    const insertRule = current.prepare(
      `INSERT INTO reminder_rules (id, days_before, enabled, times_per_day, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const row of rules) insertRule.run(row.id, row.days_before, row.enabled, row.times_per_day, row.created_at_utc, row.updated_at_utc);

    const insertPlan = current.prepare(
      `INSERT INTO notification_plans
        (id, server_id, plan_generation, trigger_days_before, occurrence_index, times_per_day,
         scheduled_for_utc, status, attempt_count, next_attempt_at_utc, sent_at_utc,
         cancelled_at_utc, processing_started_at_utc, last_error_code, last_error_message,
         created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of plans) {
      insertPlan.run(
        row.id, row.server_id, row.plan_generation, row.trigger_days_before,
        row.occurrence_index, row.times_per_day, row.scheduled_for_utc, row.status,
        row.attempt_count, row.next_attempt_at_utc, row.sent_at_utc, row.cancelled_at_utc,
        row.processing_started_at_utc, row.last_error_code, row.last_error_message,
        row.created_at_utc, row.updated_at_utc,
      );
    }

    const insertAttempt = current.prepare(
      `INSERT INTO notification_attempts
        (id, plan_id, attempt_number, outcome, started_at_utc, finished_at_utc,
         telegram_message_id, error_code, error_message, retryable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of attempts) {
      insertAttempt.run(
        row.id, row.plan_id, row.attempt_number, row.outcome, row.started_at_utc,
        row.finished_at_utc, row.telegram_message_id, row.error_code, row.error_message, row.retryable,
      );
    }
  });

  replace();
}

export function registerDatabaseRoutes(app: FastifyInstance, database: SqliteDatabase): void {
  app.get('/api/database/export', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    const backupPath = temporaryPath('server-expiry-backup');

    try {
      await database.backup(backupPath);
      const stream = fs.createReadStream(backupPath);
      const cleanup = () => fs.rmSync(backupPath, { force: true });
      stream.once('close', cleanup);
      stream.once('error', cleanup);
      return reply
        .header('Content-Disposition', 'attachment; filename="server-expiry-backup.sqlite"')
        .type('application/octet-stream')
        .send(stream);
    } catch (error) {
      fs.rmSync(backupPath, { force: true });
      request.log.error(error);
      return reply.code(500).send({ error: 'DATABASE_EXPORT_FAILED' });
    }
  });

  app.post('/api/database/import', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    const part = await request.file();
    if (!part) {
      return reply.code(400).send({ error: 'DATABASE_FILE_REQUIRED' });
    }

    const sourcePath = temporaryPath('server-expiry-import');

    try {
      await pipeline(part.file, createWriteStream(sourcePath));
      const source = new Database(sourcePath, { readonly: true, fileMustExist: true });

      try {
        validateSourceDatabase(source, database);
        replaceData(database, source);
      } finally {
        source.close();
      }

      return { imported: true, message: '\u6570\u636e\u5e93\u5bfc\u5165\u6210\u529f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DATABASE_IMPORT_FAILED';
      return reply.code(400).send({ error: 'DATABASE_IMPORT_FAILED', message });
    } finally {
      fs.rmSync(sourcePath, { force: true });
    }
  });
}
