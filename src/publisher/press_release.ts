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
  _exchange: ExchangeType
): string {
  // Determine body content: if the articleMessage begins with the title
  // (first non-empty line equals the provided title), remove that title
  // from the body when building the excerpt. Otherwise, use the full
  // articleMessage as the body content.
  const lines = articleMessage.split('\n');
  // Find first non-empty line
  let firstNonEmptyIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      firstNonEmptyIndex = i;
      break;
    }
  }

  let bodyContent = articleMessage.trim();
  if (firstNonEmptyIndex >= 0) {
    const firstLine = lines[firstNonEmptyIndex].trim();
    if (firstLine === title.trim()) {
      // Remove the title line and any following empty line
      const afterTitleLines = lines.slice(firstNonEmptyIndex + 1);
      bodyContent = afterTitleLines.join('\n').trim();
    }
  }

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
