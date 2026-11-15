import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import type { PublicAdminAccount } from './admin.js';

export const sessionCookieName = 'server_expiry_session';

type SessionRow = PublicAdminAccount & {
  session_id: number;
};

type SessionMetadata = {
  userAgent?: string;
  ipAddress?: string;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function expiresAtFromNow(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

export function createSession(
  database: SqliteDatabase,
  admin: PublicAdminAccount,
  ttlDays: number,
  metadata: SessionMetadata,
): { token: string; expiresAtUtc: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAtUtc = expiresAtFromNow(ttlDays);
  const now = new Date().toISOString();

  const insertSession = database.transaction(() => {
    database
      .prepare(
        `DELETE FROM admin_sessions
         WHERE expires_at_utc <= ? OR revoked_at_utc IS NOT NULL`,
      )
      .run(now);
    database
      .prepare(
        `INSERT INTO admin_sessions
          (admin_id, token_hash, created_at_utc, expires_at_utc, last_seen_at_utc, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(admin.id, tokenHash, now, expiresAtUtc, now, metadata.userAgent ?? null, metadata.ipAddress ?? null);
  });

  insertSession();
  return { token, expiresAtUtc };
}

export function findSessionAdmin(database: SqliteDatabase, token: string): SessionRow | undefined {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const row = database
    .prepare(
      `SELECT s.id AS session_id, a.id, a.username
       FROM admin_sessions s
       INNER JOIN admin_accounts a ON a.id = s.admin_id
       WHERE s.token_hash = ?
         AND s.revoked_at_utc IS NULL
         AND s.expires_at_utc > ?`,
    )
    .get(tokenHash, now) as SessionRow | undefined;

  if (!row) {
    return undefined;
  }

  const updateLastSeen = database.transaction(() => {
    database
      .prepare('UPDATE admin_sessions SET last_seen_at_utc = ? WHERE id = ?')
      .run(now, row.session_id);
  });
  updateLastSeen();

  return row;
}

export function revokeSession(database: SqliteDatabase, token: string): void {
  const now = new Date().toISOString();
  const revoke = database.transaction(() => {
    database
      .prepare(
        `UPDATE admin_sessions
         SET revoked_at_utc = ?
         WHERE token_hash = ? AND revoked_at_utc IS NULL`,
      )
      .run(now, hashToken(token));
  });

  revoke();
}

export function sessionTokenFromRequest(request: FastifyRequest): string | undefined {
  return request.cookies[sessionCookieName];
}
