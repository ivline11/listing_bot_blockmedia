import { extractFirstSentences } from '../utils/text.js';
import { ExchangeType } from '../bot/filters.js';

/**
 * Generate press release message for Telegram
 * Format:
 * - Title
 * - [블록미디어] Article body first 120 chars
 * - #TICKER
 * - 기사 보기 👉 링크 추후 삽입
 */
export function generatePressReleaseMessage(
  title: string,
  articleMessage: string,
  ticker: string,
  exchange: ExchangeType
): string {
  // Remove title line from article to get body content
  // Article format: "Title\n\nBody content..."
  const lines = articleMessage.split('\n');

  // Skip first line (title) and any empty lines, get body content
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      bodyStart = i + 1; // Skip the title line
      break;
    }
  }

  const bodyContent = lines.slice(bodyStart).join('\n').trim();

  // Take first 120 characters from body
  let excerpt = bodyContent.substring(0, 120);
  if (bodyContent.length > 120) {
    excerpt += '…';
  }

  const message = `${title}

[블록미디어] ${excerpt}

#${ticker}

기사 보기 👉 링크 추후 삽입`;

  return message;
}

/**
 * Get image path for exchange
 */
export function getExchangeImagePath(exchange: ExchangeType): string {
  const filename =
    exchange === ExchangeType.UPBIT ? 'upbit_listing_image.jpg' : 'bithumb_listing_image.jpg';
  return `./assets/${filename}`;
}
