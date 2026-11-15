import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import { getAuthenticatedAdmin } from '../auth/guard.js';
import {
  archiveServer,
  createServer,
  deleteServer,
  getServer,
  listServers,
  parseListOptions,
  restoreServer,
  renewServer,
  ServerServiceError,
  updateServer,
  type ServerInput,
} from './service.js';

type IdParams = { id: string };
type ListQuery = { status?: string; q?: string; page?: string; pageSize?: string };

function handleServiceError(reply: FastifyReply, error: unknown): unknown {
  if (error instanceof ServerServiceError) {
    return reply.code(error.statusCode).send({ error: error.code, message: error.message });
  }

  throw error;
}

function isAuthorized(database: SqliteDatabase, request: FastifyRequest, reply: FastifyReply): boolean {
  const admin = getAuthenticatedAdmin(database, request);

  if (!admin) {
    void reply.code(401).send({ error: 'UNAUTHENTICATED' });
    return false;
  }

  return true;
}

export function registerServerRoutes(app: FastifyInstance, database: SqliteDatabase): void {
  app.get<{ Querystring: ListQuery }>('/api/servers', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return listServers(database, parseListOptions(request.query));
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.get<{ Params: IdParams }>('/api/servers/:id', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return getServer(database, request.params.id);
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post<{ Body: ServerInput }>('/api/servers', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return reply.code(201).send(createServer(database, request.body ?? {}));
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.patch<{ Params: IdParams; Body: ServerInput }>('/api/servers/:id', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return updateServer(database, request.params.id, request.body ?? {});
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post<{ Params: IdParams; Body: ServerInput }>('/api/servers/:id/renew', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return renewServer(database, request.params.id, request.body ?? {});
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post<{ Params: IdParams }>('/api/servers/:id/archive', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return archiveServer(database, request.params.id);
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.delete<{ Params: IdParams }>('/api/servers/:id', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      deleteServer(database, request.params.id);
      return reply.code(204).send();
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post<{ Params: IdParams }>('/api/servers/:id/restore', async (request, reply) => {
    if (!isAuthorized(database, request, reply)) {
      return;
    }

    try {
      return restoreServer(database, request.params.id);
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });
}
