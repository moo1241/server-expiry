import type { FastifyRequest } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import { findSessionAdmin, sessionTokenFromRequest } from './session.js';

export function getAuthenticatedAdmin(database: SqliteDatabase, request: FastifyRequest) {
  const token = sessionTokenFromRequest(request);
  return token ? findSessionAdmin(database, token) : undefined;
}
