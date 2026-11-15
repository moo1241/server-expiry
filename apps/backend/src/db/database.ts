import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const defaultDatabasePath = path.resolve(process.cwd(), 'data', 'server-expiry-reminder.sqlite');

export function resolveDatabasePath(): string {
  const configuredPath = process.env.DATABASE_PATH?.trim();

  if (!configuredPath) {
    return defaultDatabasePath;
  }

  if (configuredPath === ':memory:') {
    return configuredPath;
  }

  return path.resolve(process.cwd(), configuredPath);
}

export function openDatabase(filePath = resolveDatabasePath()) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const database = new Database(filePath);

  // These settings keep the file recoverable after a process or host restart.
  database.pragma('journal_mode = WAL');
  database.pragma('synchronous = FULL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  return database;
}

export type SqliteDatabase = ReturnType<typeof openDatabase>;
