import { extractTicker } from '../utils/text.js';
import logger from '../utils/logger.js';

export interface ParsedNotice {
  ticker: string;
  content: string;
}

/**
 * Parse ticker from notice content
 * Throws error if ticker cannot be extracted
 */
export function parseNoticeForTicker(content: string): ParsedNotice {
  const ticker = extractTicker(content);

  if (!ticker) {
    logger.error({ contentLength: content.length }, 'Failed to extract ticker from notice');
    throw new Error('Could not extract ticker from notice content');
  }

  logger.info({ ticker }, 'Successfully extracted ticker');

  return {
    ticker,
    content,
  };
}
