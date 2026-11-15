import type { SchedulerOptions } from './types.js';

function integerEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

export function schedulerEnabled(): boolean {
  return process.env.REMINDER_SCHEDULER_ENABLED === 'true';
}

export function loadSchedulerOptions(): SchedulerOptions {
  return {
    cronExpression: process.env.REMINDER_CRON?.trim() || '* * * * *',
    batchSize: integerEnv('REMINDER_BATCH_SIZE', 10, 1, 100),
    retryPolicy: {
      maxAttempts: integerEnv('REMINDER_MAX_ATTEMPTS', 5, 1, 20),
      baseDelaySeconds: integerEnv('REMINDER_RETRY_BASE_SECONDS', 300, 1, 86_400),
      maxDelaySeconds: integerEnv('REMINDER_RETRY_MAX_SECONDS', 86_400, 1, 7 * 86_400),
      processingTimeoutSeconds: integerEnv('REMINDER_PROCESSING_TIMEOUT_SECONDS', 600, 30, 86_400),
    },
  };
}
