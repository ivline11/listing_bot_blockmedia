import { Bot } from 'grammy';
import { setupCommands } from './commands.js';
import logger from '../utils/logger.js';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // Setup commands
  setupCommands(bot);

  // Error handler
  // Error handler: log error details and context safely so we can debug empty `{}` errors
  bot.catch((err) => {
    try {
      const anyErr = err as any;
      const original = anyErr.error;
      const ctx = anyErr.ctx;

      logger.error(
        {
          message: original?.message || String(original) || 'unknown',
          stack: original?.stack,
          updateType: ctx?.updateType || ctx?.update?.message ? 'message' : undefined,
          chatId: ctx?.chat?.id || ctx?.update?.message?.chat?.id || ctx?.update?.channel_post?.chat?.id,
          updatePreview:
            (ctx?.update?.message?.text || ctx?.update?.channel_post?.text || ctx?.update?.message?.caption || '').substring(0, 300),
        },
        'Bot error occurred'
      );
    } catch (logErr) {
      // Fallback to raw logging if our structured log fails
      logger.error({ err }, 'Bot error occurred (failed to extract details)');
    }
  });

  logger.info('Telegram bot created');

  return bot;
}
