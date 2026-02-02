/**
 * Text processing utilities
 */

/**
 * Normalize whitespace in text
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract first N sentences from Korean text
 * Korean sentences typically end with: . ! ? 다. 요. 등
 */
export function extractFirstSentences(text: string, count: number, maxLength?: number): string {
  const sentenceEndPattern = /[.!?]|다\.|요\.|습니다\.|니다\.|까요\?|나요\?/g;
  const matches: number[] = [];
  let match;

  while ((match = sentenceEndPattern.exec(text)) !== null) {
    matches.push(match.index + match[0].length);
    if (matches.length >= count) {
      break;
    }
  }

  if (matches.length === 0) {
    // Fallback: return first 200 characters (or maxLength if specified)
    const fallbackLength = maxLength || 200;
    return text.substring(0, fallbackLength) + '…';
  }

  const endIndex = matches[matches.length - 1];
  let result = text.substring(0, endIndex).trim();

  // Apply max length if specified
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength) + '…';
  }

  return result;
}

/**
 * Extract ticker from announcement text
 * Common patterns:
 * - "프로젝트명(영문명·TICKER)"
 * - "심볼: XXX"
 * - "티커: XXX"
 */
export function extractTicker(text: string): string | null {
  // Pattern 1: 가운데점 뒤 대문자+숫자 조합 (예: "Tether Gold·XAUT")
  const pattern1 = /[·•]([A-Z][A-Z0-9]{1,10})(?:[)\s,.]|$)/;
  const match1 = text.match(pattern1);
  if (match1) {
    return match1[1];
  }

  // Pattern 2: "심볼: XXX" 또는 "티커: XXX"
  const pattern2 = /(?:심볼|티커|symbol|ticker)\s*[:：]\s*([A-Z][A-Z0-9]{1,10})/i;
  const match2 = text.match(pattern2);
  if (match2) {
    return match2[1].toUpperCase();
  }

  // Pattern 3: 괄호 안의 대문자 (예: "(XAUT)")
  const pattern3 = /\(([A-Z][A-Z0-9]{1,10})\)/;
  const match3 = text.match(pattern3);
  if (match3) {
    return match3[1];
  }

  return null;
}

/**
 * Check if text contains any of the excluded keywords
 */
export function containsExcludedKeyword(text: string): boolean {
  const excludedKeywords = [
    '공지변경',
    '거래대기',
    '에어드랍',
    '이벤트',
    '리브랜딩',
    '마켓명 변경',
    '유의종목',
    '투자유의',
    '입출금 일시 중단',
    '점검',
  ];

  const normalizedText = text.replace(/\s+/g, '').toLowerCase();

  return excludedKeywords.some((keyword) => {
    const normalizedKeyword = keyword.replace(/\s+/g, '').toLowerCase();
    return normalizedText.includes(normalizedKeyword);
  });
}

/**
 * Extract URL from text
 */
export function extractUrl(text: string): string | null {
  const urlPattern = /(https?:\/\/[^\s]+)/;
  const match = text.match(urlPattern);
  return match ? match[1] : null;
}
