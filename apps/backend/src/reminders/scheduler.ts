import cron, { type ScheduledTask } from 'node-cron';
import type { SqliteDatabase } from '../db/database.js';
import { completePlan, claimDuePlan, recoverStalePlans } from './repository.js';
import { cleanupNotificationHistory } from '../notifications/retention.js';
import { defaultRetryPolicy } from './retry.js';
import type { NotificationTransport, RetryPolicy, SchedulerOptions } from './types.js';

export class ReminderScheduler {
  private readonly cronExpression: string;
  private readonly batchSize: number;
  private readonly retryPolicy: RetryPolicy;
  private task: ScheduledTask | undefined;
  private running = false;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly transport: NotificationTransport,
    options: SchedulerOptions = {},
  ) {
    this.cronExpression = options.cronExpression ?? '* * * * *';
    this.batchSize = options.batchSize ?? 10;
    this.retryPolicy = { ...defaultRetryPolicy, ...options.retryPolicy };

    if (!Number.isSafeInteger(this.batchSize) || this.batchSize < 1 || this.batchSize > 100) {
      throw new Error('Reminder scheduler batchSize must be between 1 and 100');
    }
  }

  start(): void {
    if (this.task) {
      return;
    }

    this.task = cron.schedule(this.cronExpression, () => {
      void this.runOnce();
    });
  }

  stop(): void {
    this.task?.stop();
    this.task?.destroy();
    this.task = undefined;
  }

  async runOnce(): Promise<number> {
    if (this.running) {
      return 0;
    }

    this.running = true;

    try {
      recoverStalePlans(this.database, new Date(), this.retryPolicy);
      cleanupNotificationHistory(this.database, 10);
      let processed = 0;

      while (processed < this.batchSize) {
        const plan = claimDuePlan(this.database);

        if (!plan) {
          break;
        }

        try {
          const result = await this.transport.send(plan);
          completePlan(this.database, plan, result, new Date(), this.retryPolicy);
        } catch (error) {
          completePlan(
            this.database,
            plan,
            {
              outcome: 'unknown',
              errorCode: 'TRANSPORT_THROW',
              errorMessage: error instanceof Error ? error.message : 'Notification transport failed',
              retryable: true,
            },
            new Date(),
            this.retryPolicy,
          );
        }

        processed += 1;
      }

      return processed;
    } finally {
      this.running = false;
    }
  }
}
