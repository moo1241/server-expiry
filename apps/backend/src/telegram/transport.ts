import type { TelegramConfig } from './config.js';
import type { DeliveryResult, NotificationTransport, ReminderPlan } from '../reminders/types.js';

type TelegramApiResponse = {
  ok: boolean;
  result?: {
    message_id?: number;
  };
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
};

export class TelegramRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly uncertain: boolean,
  ) {
    super(message);
  }
}

type TelegramMessageResult = {
  messageId?: string;
};

export class TelegramTransport implements NotificationTransport {
  constructor(
    private readonly config: TelegramConfig,
    private readonly getDisplayTimezone: () => string = () => 'Asia/Shanghai',
  ) {}

  async send(plan: ReminderPlan): Promise<DeliveryResult> {
    const trigger = plan.triggerDaysBefore === 0
      ? '\u4eca\u5929\u5230\u671f'
      : `\u63d0\u524d ${plan.triggerDaysBefore} \u5929\u5230\u671f`;
    const displayTimezone = this.getDisplayTimezone();
    const formattedExpiry = new Intl.DateTimeFormat('zh-CN', {
      timeZone: displayTimezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(plan.expiresAtUtc));
    const text = [
      '\u670d\u52a1\u5668\u5230\u671f\u63d0\u9192',
      `\u540d\u79f0\uff1a${plan.serverName}`,
      `IP \u5730\u5740\uff1a${plan.ipAddress || '\u672a\u586b\u5199'}`,
      `\u670d\u52a1\u5546\uff1a${plan.provider}`,
      `\u5730\u533a\uff1a${plan.region}`,
      `\u5230\u671f\u65f6\u95f4\uff08${displayTimezone}\uff09\uff1a${formattedExpiry}`,
      `\u63d0\u9192\uff1a${trigger}`,
      `\u5f53\u65e5\u7b2c ${plan.occurrenceIndex}/${plan.timesPerDay} \u6b21`,
    ].join('\n');

    try {
      const result = await this.sendText(text);
      return { outcome: 'sent', messageId: result.messageId };
    } catch (error) {
      if (error instanceof TelegramRequestError) {
        return {
          outcome: error.uncertain ? 'unknown' : 'failed',
          errorCode: error.code,
          errorMessage: error.message,
          retryable: error.retryable,
        };
      }

      return {
        outcome: 'unknown',
        errorCode: 'TELEGRAM_UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Telegram request failed',
        retryable: true,
      };
    }
  }

  async sendText(text: string): Promise<TelegramMessageResult> {
    const endpoint = `${this.config.apiBaseUrl}/bot${this.config.botToken}/sendMessage`;

    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: this.config.chatId, text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new TelegramRequestError(
        error instanceof Error ? error.message : 'Telegram network request failed',
        'TELEGRAM_NETWORK_ERROR',
        true,
        true,
      );
    }

    let payload: TelegramApiResponse | undefined;

    try {
      payload = (await response.json()) as TelegramApiResponse;
    } catch {
      throw new TelegramRequestError('Telegram returned an invalid response', 'TELEGRAM_INVALID_RESPONSE', true, true);
    }

    if (!response.ok || !payload.ok) {
      const errorCode = payload.error_code ?? response.status;
      const retryable = response.status === 429 || response.status >= 500 || errorCode === 429 || errorCode >= 500;
      const description = payload.description ?? `Telegram HTTP ${response.status}`;
      throw new TelegramRequestError(description, `TELEGRAM_${errorCode}`, retryable, false);
    }

    return {
      messageId: payload.result?.message_id === undefined ? undefined : String(payload.result.message_id),
    };
  }
}
