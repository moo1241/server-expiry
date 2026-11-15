import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import type { SqliteDatabase } from './db/database.js';
import { findAdminByUsername, toPublicAdmin } from './auth/admin.js';
import { getAuthenticatedAdmin } from './auth/guard.js';
import { resetAdminPassword } from './auth/recovery.js';
import { verifyPassword } from './auth/password.js';
import {
  createSession,
  revokeSession,
  sessionCookieName,
  sessionTokenFromRequest,
} from './auth/session.js';
import { registerServerRoutes } from './servers/routes.js';
import { registerTelegramRoutes } from './telegram/routes.js';
import type { TelegramTransport } from './telegram/transport.js';
import { registerNotificationRoutes } from './notifications/routes.js';
import { registerDatabaseRoutes } from './database/routes.js';
import { registerSettingsRoutes } from './settings/routes.js';
import { registerReminderRuleRoutes } from './reminders/rule-routes.js';

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

type RecoveryBody = {
  username?: unknown;
  recoveryCode?: unknown;
  newPassword?: unknown;
};

type AppOptions = {
  telegramTransport?: TelegramTransport;
  schedulerEnabled?: boolean;
};

function sessionTtlDays(): number {
  const configuredDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? '7', 10);
  return Number.isSafeInteger(configuredDays) && configuredDays > 0 && configuredDays <= 30 ? configuredDays : 7;
}

export function buildApp(database: SqliteDatabase, options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  const configuredOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const secureCookie = process.env.SESSION_COOKIE_SECURE === 'true';
  const ttlDays = sessionTtlDays();

  app.register(cors, {
    origin: configuredOrigin,
    credentials: true,
  });
  app.register(cookie);
  app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 100 * 1024 * 1024,
    },
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'server-expiry-reminder-backend',
    timestamp: new Date().toISOString(),
  }));

  app.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const body = request.body ?? {};

    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      return reply.code(400).send({ error: 'INVALID_REQUEST' });
    }

    const admin = findAdminByUsername(database, body.username.trim());

    if (!admin || !verifyPassword(body.password, admin.password_hash)) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    const publicAdmin = toPublicAdmin(admin);
    const session = createSession(database, publicAdmin, ttlDays, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    reply.setCookie(sessionCookieName, session.token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60,
    });

    return {
      user: publicAdmin,
      expiresAtUtc: session.expiresAtUtc,
    };
  });

  app.post<{ Body: RecoveryBody }>('/api/auth/forgot-password', async (request, reply) => {
    const body = request.body ?? {};

    if (
      typeof body.username !== 'string' ||
      typeof body.recoveryCode !== 'string' ||
      typeof body.newPassword !== 'string'
    ) {
      return reply.code(400).send({ error: 'INVALID_REQUEST' });
    }

    try {
      resetAdminPassword(database, body.username, body.recoveryCode, body.newPassword);
      return { reset: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes('8 to 256')) {
        return reply.code(400).send({ error: 'PASSWORD_TOO_SHORT' });
      }
      return reply.code(400).send({ error: 'RECOVERY_INVALID' });
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    const session = getAuthenticatedAdmin(database, request);

    if (!session) {
      return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    }

    return {
      user: {
        id: session.id,
        username: session.username,
      },
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = sessionTokenFromRequest(request);

    if (token) {
      revokeSession(database, token);
    }

    reply.clearCookie(sessionCookieName, { path: '/' });
    return reply.code(204).send();
  });

  registerServerRoutes(app, database);
  registerNotificationRoutes(app, database);
  registerDatabaseRoutes(app, database);
  registerSettingsRoutes(app, database);
  registerReminderRuleRoutes(app, database);
  registerTelegramRoutes(app, database, options.telegramTransport, options.schedulerEnabled ?? false);

  return app;
}
