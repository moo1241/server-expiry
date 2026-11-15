import type { SqliteDatabase } from '../db/database.js';
import { hashPassword } from './password.js';

export type AdminAccount = {
  id: number;
  username: string;
  password_hash: string;
};

export type PublicAdminAccount = {
  id: number;
  username: string;
};

export function toPublicAdmin(account: AdminAccount): PublicAdminAccount {
  return {
    id: account.id,
    username: account.username,
  };
}

export function findAdminByUsername(database: SqliteDatabase, username: string): AdminAccount | undefined {
  return database
    .prepare(
      `SELECT id, username, password_hash
       FROM admin_accounts
       WHERE username = ?`,
    )
    .get(username) as AdminAccount | undefined;
}

export function createAdminAccount(database: SqliteDatabase, username: string, password: string): PublicAdminAccount {
  const normalizedUsername = username.trim();

  if (normalizedUsername.length < 3 || normalizedUsername.length > 64) {
    throw new Error('Admin username must contain 3 to 64 characters');
  }

  if (password.length < 12 || password.length > 256) {
    throw new Error('Admin password must contain 12 to 256 characters');
  }

  const passwordHash = hashPassword(password);
  const createAccount = database.transaction(() => {
    const existing = database.prepare('SELECT id FROM admin_accounts LIMIT 1').get() as { id: number } | undefined;

    if (existing) {
      throw new Error('An administrator account already exists');
    }

    const result = database
      .prepare(
        `INSERT INTO admin_accounts (id, username, password_hash)
         VALUES (1, ?, ?)`,
      )
      .run(normalizedUsername, passwordHash);

    return {
      id: Number(result.lastInsertRowid),
      username: normalizedUsername,
    };
  });

  return createAccount();
}
