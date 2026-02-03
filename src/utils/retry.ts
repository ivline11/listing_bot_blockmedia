import logger from './logger.js';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number[];
  operationName: string;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, delayMs, operationName } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug({ attempt, operationName }, 'Attempting operation');
      const result = await fn();
      if (attempt > 1) {
        logger.info(
          { attempt, operationName },
          'Operation succeeded after retry'
        );
      }
      return result;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        logger.error(
          { attempt, operationName, error },
          'Operation failed after all retries'
        );
        throw error;
      }

      const delay = delayMs[attempt - 1] || delayMs[delayMs.length - 1];
      logger.warn(
        { attempt, operationName, delay, error },
        'Operation failed, retrying...'
      );

      await sleep(delay);
    }
  }

  throw new Error(`Retry logic failed for ${operationName}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Preset retry configurations
export const RETRY_CONFIG = {
  scraping: {
    // Allow 3 attempts total (2 retries) as documented
    maxAttempts: 3,
    delayMs: [500, 2000],
    operationName: 'scraping',
  },
  claude: {
    maxAttempts: 3,
    delayMs: [1000, 3000],
    operationName: 'claude_api',
  },
  telegram: {
    maxAttempts: 3,
    delayMs: [1000, 3000],
    operationName: 'telegram_send',
  },
};
