import { readFileSync } from 'fs';
import { join } from 'path';
import { ExchangeType } from '../bot/filters.js';
import logger from '../utils/logger.js';

const PROMPT_DIR = './prompts';

const PROMPT_FILES = {
  [ExchangeType.UPBIT]: 'upbit_listing_prompt.txt',
  [ExchangeType.BITHUMB]: 'bithumb_listing_prompt.txt',
};

/**
 * Load prompt template for the given exchange
 */
export function loadPrompt(exchange: ExchangeType): string {
  const filename = PROMPT_FILES[exchange];
  const filepath = join(PROMPT_DIR, filename);

  try {
    const content = readFileSync(filepath, 'utf-8');
    logger.info({ exchange, filepath }, 'Loaded prompt template');
    return content;
  } catch (error) {
    logger.error({ exchange, filepath, error }, 'Failed to load prompt template');
    throw new Error(`Failed to load prompt for ${exchange}: ${error}`);
  }
}
