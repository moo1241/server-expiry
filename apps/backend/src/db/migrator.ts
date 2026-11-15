import { createHash } from 'node:crypto';
import type { SqliteDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import type { Migration } from './types.js';

type AppliedMigration = {
  version: string;
  checksum: string;
};

function checksumFor(migration: Migration): string {
  return createHash('sha256').update(migration.sql, 'utf8').digest('hex');
}

function ensureMigrationTable(database: SqliteDatabase): void {
  const createTable = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at_utc TEXT NOT NULL
      );
    `);
  });

  createTable();
}

function validateMigrationList(orderedMigrations: readonly Migration[]): void {
  const versions = new Set<string>();

  for (const migration of orderedMigrations) {
    if (!migration.version.trim()) {
      throw new Error('Migration version cannot be empty');
    }

    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }

    versions.add(migration.version);
  }
}

export function runMigrations(database: SqliteDatabase): string[] {
  ensureMigrationTable(database);

  const orderedMigrations = [...migrations].sort((left, right) => left.version.localeCompare(right.version));
  validateMigrationList(orderedMigrations);

  const appliedRows = database
    .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
    .all() as AppliedMigration[];
  const appliedByVersion = new Map(appliedRows.map((row) => [row.version, row]));

  for (const migration of orderedMigrations) {
    const checksum = checksumFor(migration);
    const applied = appliedByVersion.get(migration.version);

    if (applied && applied.checksum !== checksum) {
      throw new Error(`Migration checksum mismatch: ${migration.version}`);
    }
  }

  const appliedVersions: string[] = [];

  for (const migration of orderedMigrations) {
    if (appliedByVersion.has(migration.version)) {
      continue;
    }

    const checksum = checksumFor(migration);
    const applyMigration = database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare(
          `INSERT INTO schema_migrations (version, checksum, applied_at_utc)
           VALUES (?, ?, ?)`,
        )
        .run(migration.version, checksum, new Date().toISOString());
    });

    applyMigration();
    appliedVersions.push(migration.version);
  }

  return appliedVersions;
}
