import 'dotenv/config';
import { createBot } from './bot/telegram.js';
import { setupMessageHandler } from './bot/router.js';
import { initDatabase } from './storage/db.js';
import { initClaudeService } from './llm/claude.js';
import logger from './utils/logger.js';

async function main() {
  // Validate environment variables
  const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY', 'DB_PATH', 'LISTING_SOURCE_CHAT_ID'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error({ missingVars }, 'Missing required environment variables');
    process.exit(1);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;
  const dbPath = process.env.DB_PATH!;
  const sourceChatId = parseInt(process.env.LISTING_SOURCE_CHAT_ID!, 10);

  logger.info('Starting Listing Bot Blockmedia');

  // Initialize database
  initDatabase(dbPath);
  logger.info({ dbPath }, 'Database initialized');

  // Initialize Claude service
  initClaudeService(anthropicApiKey);
  logger.info('Claude service initialized');

  // Create bot
  const bot = createBot(botToken);

  // Setup message handler for source chat
  setupMessageHandler(bot, sourceChatId);

  // Start bot
  logger.info('Starting bot...');
  await bot.start();

  logger.info({ sourceChatId }, 'Bot is running and monitoring source chat');

  // Graceful shutdown
  process.once('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    bot.stop();
  });

  process.once('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    bot.stop();
  });
}

main().catch((error) => {
  logger.fatal({ error }, 'Fatal error occurred');
  process.exit(1);
});
