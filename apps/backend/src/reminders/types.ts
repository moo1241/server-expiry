export type ReminderPlan = {
  id: number;
  serverId: number;
  serverName: string;
  ipAddress: string;
  provider: string;
  region: string;
  expiresAtUtc: string;
  planGeneration: number;
  triggerDaysBefore: number;
  occurrenceIndex: number;
  timesPerDay: number;
  scheduledForUtc: string;
  attemptNumber: number;
};

export type DeliveryResult =
  | {
      outcome: 'sent';
      messageId?: string;
    }
  | {
      outcome: 'failed' | 'unknown';
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
    };

export type NotificationTransport = {
  send(plan: ReminderPlan): Promise<DeliveryResult>;
};

export type RetryPolicy = {
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  processingTimeoutSeconds: number;
};

export type SchedulerOptions = {
  cronExpression?: string;
  batchSize?: number;
  retryPolicy?: Partial<RetryPolicy>;
};
