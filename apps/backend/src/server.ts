import 'dotenv/config';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { openDatabase } from './db/database.js';
import { runMigrations } from './db/migrator.js';
import { loadSchedulerOptions, schedulerEnabled } from './reminders/config.js';
import { ReminderScheduler } from './reminders/scheduler.js';
import { loadTelegramConfig } from './telegram/config.js';
import { TelegramTransport } from './telegram/transport.js';
import { readDisplayTimezone } from './settings/routes.js';
import { cleanupNotificationHistory } from './notifications/retention.js';

const database = openDatabase();
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '127.0.0.1';
let app: FastifyInstance | undefined;
let scheduler: ReminderScheduler | undefined;

async function start(): Promise<void> {
  try {
    const appliedMigrations = runMigrations(database);
    cleanupNotificationHistory(database, 10);
    const telegramConfig = loadTelegramConfig();
    const shouldStartScheduler = schedulerEnabled();

    if (shouldStartScheduler && !telegramConfig) {
      throw new Error('REMINDER_SCHEDULER_ENABLED=true requires Telegram configuration');
    }

    const telegramTransport = telegramConfig
      ? new TelegramTransport(telegramConfig, () => readDisplayTimezone(database))
      : undefined;
    app = buildApp(database, {
      telegramTransport,
      schedulerEnabled: shouldStartScheduler && Boolean(telegramTransport),
    });
    scheduler = shouldStartScheduler && telegramTransport
      ? new ReminderScheduler(database, telegramTransport, loadSchedulerOptions())
      : undefined;

    app.log.info({ appliedMigrations }, 'Database migrations ready');
    await app.listen({ port, host });
    scheduler?.start();
  } catch (error) {
    app?.log.error(error);
    console.error(error);
    scheduler?.stop();
    database.close();
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  app?.log.info({ signal }, 'Shutting down backend service');
  scheduler?.stop();
  await app?.close();
  database.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

void start();
