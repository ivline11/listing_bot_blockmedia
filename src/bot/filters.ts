import { containsExcludedKeyword } from '../utils/text.js';
import logger from '../utils/logger.js';

export enum ExchangeType {
  UPBIT = 'UPBIT',
  BITHUMB = 'BITHUMB',
}

export interface FilterResult {
  passed: boolean;
  exchange?: ExchangeType;
  reason?: string;
}

/**
 * Detect if the message is a listing announcement and which exchange
 */
export function detectListingExchange(messageText: string): ExchangeType | null {
  const normalizedText = messageText.replace(/\s+/g, '');

  // Check for Upbit listing
  if (
    normalizedText.includes('업비트') &&
    normalizedText.includes('신규거래지원')
  ) {
    return ExchangeType.UPBIT;
  }

  // Check for Bithumb listing
  if (normalizedText.includes('빗썸') && normalizedText.includes('원화마켓추가')) {
    return ExchangeType.BITHUMB;
  }

  return null;
}

/**
 * Filter listing announcement message
 * Returns FilterResult indicating if the message should be processed
 */
export function filterListingMessage(messageText: string): FilterResult {
  // Step 1: Detect exchange
  const exchange = detectListingExchange(messageText);

  if (!exchange) {
    logger.debug('Message does not match listing patterns');
    return {
      passed: false,
      reason: 'not_listing',
    };
  }

  // Step 2: Check for excluded keywords
  if (containsExcludedKeyword(messageText)) {
    logger.info({ exchange }, 'Message contains excluded keywords');
    return {
      passed: false,
      exchange,
      reason: 'excluded_keyword',
    };
  }

  // Passed all filters
  logger.info({ exchange }, 'Message passed all filters');
  return {
    passed: true,
    exchange,
  };
}
