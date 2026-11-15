import type { FastifyInstance } from 'fastify';
import type { SqliteDatabase } from '../db/database.js';
import { getAuthenticatedAdmin } from '../auth/guard.js';
import { TelegramRequestError, TelegramTransport } from './transport.js';

type TestMessageBody = {
  message?: unknown;
};

export function registerTelegramRoutes(
  app: FastifyInstance,
  database: SqliteDatabase,
  transport: TelegramTransport | undefined,
  schedulerEnabled: boolean,
): void {
  app.get('/api/telegram/status', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    return {
      configured: Boolean(transport),
      schedulerEnabled,
    };
  });

  app.post<{ Body: TestMessageBody }>('/api/telegram/test', async (request, reply) => {
    if (!getAuthenticatedAdmin(database, request)) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    if (!transport) {
      return reply.code(503).send({ error: 'TELEGRAM_NOT_CONFIGURED' });
    }

    const requestedMessage = request.body?.message;
    const message = requestedMessage === undefined ? '\u670d\u52a1\u5668\u5230\u671f\u63d0\u9192 Telegram \u6d4b\u8bd5\u6d88\u606f' : requestedMessage;

    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return reply.code(400).send({ error: 'INVALID_REQUEST', message: 'message must be 1 to 4000 characters' });
    }

    try {
      const result = await transport.sendText(message.trim());
      return { ok: true, messageId: result.messageId ?? null };
    } catch (error) {
      if (error instanceof TelegramRequestError) {
        return reply.code(error.uncertain ? 502 : 400).send({
          error: error.code,
          message: error.message,
          retryable: error.retryable,
          uncertain: error.uncertain,
        });
      }

      throw error;
    }
  });
}
