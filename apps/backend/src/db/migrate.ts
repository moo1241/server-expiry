import 'dotenv/config';
import { openDatabase, resolveDatabasePath } from './database.js';
import { runMigrations } from './migrator.js';

const databasePath = resolveDatabasePath();
const database = openDatabase(databasePath);

try {
  const appliedVersions = runMigrations(database);
  const message = appliedVersions.length > 0 ? appliedVersions.join(', ') : 'already up to date';
  console.log(`Database: ${databasePath}`);
  console.log(`Migrations: ${message}`);
} finally {
  database.close();
}
