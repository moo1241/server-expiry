import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { openDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';

const database = openDatabase();
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
const createdAtUtc = new Date();
const expiresAtUtc = new Date(createdAtUtc.getTime() + 30 * 60 * 1000);

try {
  runMigrations(database);
  const admin = database.prepare('SELECT id FROM admin_accounts LIMIT 1').get() as { id: number } | undefined;

  if (!admin) {
    throw new Error('Administrator account does not exist');
  }

  const createToken = database.transaction(() => {
    database.prepare('DELETE FROM admin_recovery_tokens WHERE used_at_utc IS NOT NULL OR expires_at_utc <= ?').run(createdAtUtc.toISOString());
    database
      .prepare(
        `INSERT INTO admin_recovery_tokens (admin_id, token_hash, created_at_utc, expires_at_utc)
         VALUES (?, ?, ?, ?)`,
      )
      .run(admin.id, tokenHash, createdAtUtc.toISOString(), expiresAtUtc.toISOString());
  });
  createToken();

  console.log('Recovery code (valid for 30 minutes):');
  console.log(token);
} finally {
  database.close();
}
