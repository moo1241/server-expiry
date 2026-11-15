import { createHash } from 'node:crypto';
import type { SqliteDatabase } from '../db/database.js';
import { hashPassword } from './password.js';
import { validatePassword } from './admin.js';

export function resetAdminPassword(database: SqliteDatabase, username: string, recoveryCode: string, newPassword: string): void {
  const normalizedUsername = username.trim();
  validatePassword(newPassword);

  if (!normalizedUsername || !recoveryCode.trim()) {
    throw new Error('Recovery data is invalid');
  }

  const tokenHash = createHash('sha256').update(recoveryCode.trim(), 'utf8').digest('hex');
  const now = new Date().toISOString();
  const passwordHash = hashPassword(newPassword);
  const reset = database.transaction(() => {
    const token = database
      .prepare(
        `SELECT t.id, t.admin_id
         FROM admin_recovery_tokens t
         INNER JOIN admin_accounts a ON a.id = t.admin_id
         WHERE a.username = ? AND t.token_hash = ?
           AND t.used_at_utc IS NULL AND t.expires_at_utc > ?`,
      )
      .get(normalizedUsername, tokenHash, now) as { id: number; admin_id: number } | undefined;

    if (!token) {
      throw new Error('Recovery data is invalid or expired');
    }

    database
      .prepare('UPDATE admin_accounts SET password_hash = ?, updated_at_utc = ? WHERE id = ?')
      .run(passwordHash, now, token.admin_id);
    database.prepare('UPDATE admin_recovery_tokens SET used_at_utc = ? WHERE id = ?').run(now, token.id);
    database.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(token.admin_id);
  });

  reset();
}
