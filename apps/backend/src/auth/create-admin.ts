import 'dotenv/config';
import { openDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import { createAdminAccount } from './admin.js';

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD before running npm run admin:create');
}

const database = openDatabase();

try {
  runMigrations(database);
  const admin = createAdminAccount(database, username, password);
  console.log(`Administrator account created: ${admin.username}`);
} finally {
  database.close();
}
