import 'dotenv/config';
import { createBot } from './bot/telegram.js';
import { setupMessageHandler } from './bot/router.js';
import { initDatabase } from './storage/db.js';
import { initLLMProvider, getActiveProviderName } from './llm/provider.js';
// If you want to temporarily re-enable Claude, uncomment the import below
// import { initClaudeService } from './llm/claude.js';
import browserManager from './scraper/browser_manager.js';
import logger from './utils/logger.js';

async function main() {
  // Validate environment variables
  const provider = (process.env.LLM_PROVIDER || 'gpt').toLowerCase();
  const requiredEnvVarsBase = ['TELEGRAM_BOT_TOKEN', 'DB_PATH'];
  const providerKey = provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  const requiredEnvVars = [...requiredEnvVarsBase, providerKey];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error({ missingVars }, 'Missing required environment variables');
    process.exit(1);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const dbPath = process.env.DB_PATH!;
  // Log the raw env var for quick debugging (temporary)
  logger.info({ LISTING_SOURCE_CHAT_ID: process.env.LISTING_SOURCE_CHAT_ID }, 'Loaded env var');

  logger.info('Starting Listing Bot Blockmedia');

  // Initialize database
  initDatabase(dbPath);
  logger.info({ dbPath }, 'Database initialized');

  // Initialize LLM provider (GPT or Claude) based on LLM_PROVIDER env
  initLLMProvider();
  logger.info({ provider: getActiveProviderName() }, 'LLM provider initialized');

  // If you want to temporarily enable Claude again, you can uncomment the
  // following lines. We keep them commented so Claude is inactive by default.
  // const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;
  // initClaudeService(anthropicApiKey);
  // logger.info('Claude service initialized (commented out)');

  // Initialize Playwright browser upfront (install chromium if needed)
  await browserManager.getBrowser();
  logger.info('Playwright browser initialized');

  // Create bot
  const bot = createBot(botToken);

  // Setup message handler for source chats
  setupMessageHandler(bot);

  // Start bot
  logger.info('Starting bot...');
  await bot.start();

  logger.info('Bot is running and monitoring enabled chats');

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
