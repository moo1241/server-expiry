export type TelegramConfig = {
  botToken: string;
  chatId: string;
  apiBaseUrl: string;
};

export function loadTelegramConfig(): TelegramConfig | undefined {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken && !chatId) {
    return undefined;
  }

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured together');
  }

  return {
    botToken,
    chatId,
    apiBaseUrl: (process.env.TELEGRAM_API_BASE_URL?.trim() || 'https://api.telegram.org').replace(/\/$/, ''),
  };
}
