import type { RetryPolicy } from './types.js';

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 5,
  baseDelaySeconds: 300,
  maxDelaySeconds: 86_400,
  processingTimeoutSeconds: 600,
};

export function retryDelaySeconds(attemptNumber: number, policy: RetryPolicy): number {
  const exponent = Math.max(0, attemptNumber - 1);
  const delay = policy.baseDelaySeconds * 2 ** exponent;
  return Math.min(delay, policy.maxDelaySeconds);
}

export function retryAtUtc(now: Date, attemptNumber: number, policy: RetryPolicy): string | null {
  if (attemptNumber >= policy.maxAttempts) {
    return null;
  }

  return new Date(now.getTime() + retryDelaySeconds(attemptNumber, policy) * 1000).toISOString();
}
