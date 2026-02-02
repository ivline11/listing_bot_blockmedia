import { Bot } from 'grammy';
import { setupCommands } from './commands.js';
import logger from '../utils/logger.js';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // Setup commands
  setupCommands(bot);

  // Error handler
  bot.catch((err) => {
    logger.error({ error: err.error }, 'Bot error occurred');
  });

  logger.info('Telegram bot created');

  return bot;
}
