import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import browserManager from './browser_manager.js';
import { normalizeWhitespace } from '../utils/text.js';
import logger from '../utils/logger.js';

export interface ScrapedNotice {
  url: string;
  content: string;
  length: number;
}

const MIN_CONTENT_LENGTH = 200;
const RENDER_TIMEOUT = 15000; // 15 seconds

/**
 * Scrape announcement content using Playwright (dynamic rendering)
 */
async function scrapeWithPlaywright(url: string): Promise<string> {
  logger.info({ url }, 'Scraping with Playwright (dynamic rendering)');

  const context = await browserManager.createContext();

  try {
    const page = await context.newPage();

    // Navigate to page
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: RENDER_TIMEOUT,
    });

    // Wait for content to appear - longer wait for SPA
    try {
      // Wait for network to be mostly idle
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (error) {
      logger.debug('Network idle wait timed out, continuing');
    }

    // Additional wait for JS rendering
    await page.waitForTimeout(3000);

    // Extract content using multiple selector strategies
    const content = await page.evaluate(() => {
      // Remove navigation, header, footer first
      const removeSelectors = [
        'nav',
        'header',
        'footer',
        '.header',
        '.footer',
        '.navigation',
        '.menu',
        '.sidebar',
        '.gnb',
        '.lnb',
      ];

      removeSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el: Element) => el.remove());
      });

      // Upbit-specific selectors (priority) - more specific
      const upbitSelectors = [
        '[class*="notice"][class*="content"]',
        '[class*="notice"][class*="view"]',
        '[class*="article"][class*="content"]',
        '.notice-view-content',
        '.notice-content',
        '.view-content',
        'article',
        'main',
      ];

      for (const selector of upbitSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const text = element.textContent.trim();
          // Must contain key phrases
          if (
            text.length > 500 &&
            (text.includes('안녕하세요') ||
              text.includes('거래') ||
              text.includes('신규') ||
              text.includes('지원'))
          ) {
            return text;
          }
        }
      }

      // Fallback: Find content by looking for specific text patterns
      const allDivs = Array.from(document.querySelectorAll('div')) as HTMLElement[];

      let bestCandidate = '';
      let maxScore = 0;

      for (const elem of allDivs) {
        // Skip if it's likely navigation/menu
        const className = elem.className.toLowerCase();
        if (
          className.includes('nav') ||
          className.includes('menu') ||
          className.includes('header') ||
          className.includes('footer')
        ) {
          continue;
        }

        const text = elem.textContent?.trim() || '';

        // Score based on length and content
        let score = 0;
        if (text.length > 500) score += text.length;
        if (text.includes('안녕하세요')) score += 1000;
        if (text.includes('신규 디지털 자산')) score += 1000;
        if (text.includes('거래 지원')) score += 500;
        if (text.includes('디지털 자산')) score += 300;

        if (score > maxScore) {
          maxScore = score;
          bestCandidate = text;
        }
      }

      if (bestCandidate && bestCandidate.length > 200) {
        return bestCandidate;
      }

      // Last resort: body text
      return document.body.textContent || '';
    });

    logger.info({ contentLength: content.length }, 'Playwright scraping completed');

    // Debug: Save HTML if scraping failed
    if (content.length < MIN_CONTENT_LENGTH) {
      await saveDebugHtml(url, await page.content());
    }

    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({
      url,
      errorMessage,
      errorStack,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, 'Playwright scraping failed');
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * Save debug HTML for troubleshooting
 */
async function saveDebugHtml(_url: string, html: string): Promise<void> {
  try {
    const debugDir = './data/debug';
    if (!existsSync(debugDir)) {
      mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `upbit_notice_${timestamp}.html`;
    const filepath = join(debugDir, filename);

    writeFileSync(filepath, html, 'utf-8');
    logger.info({ filepath }, 'Debug HTML saved');
  } catch (error) {
    logger.error({ error }, 'Failed to save debug HTML');
  }
}

/**
 * Main scraping function with 2-stage pipeline
 */
export async function scrapeNotice(url: string): Promise<ScrapedNotice> {
  logger.info({ url }, 'Starting notice scraping');

  const content = await scrapeWithPlaywright(url);

  // Normalize
  const normalized = normalizeWhitespace(content);

  // Validate length
  if (normalized.length < MIN_CONTENT_LENGTH) {
    throw new Error(
      `Content too short (${normalized.length} chars). Minimum: ${MIN_CONTENT_LENGTH}. Preview: ${normalized.substring(0, 100)}`
    );
  }

  // Validate keywords
  const hasExpectedKeywords =
    normalized.includes('거래') ||
    normalized.includes('지원') ||
    normalized.includes('신규') ||
    normalized.includes('디지털');

  if (!hasExpectedKeywords) {
    logger.warn({ url, length: normalized.length }, 'Content may not be a valid announcement');
  }

  logger.info(
    {
      url,
      length: normalized.length,
      method: 'playwright',
      preview: normalized.substring(0, 200),
    },
    'Successfully scraped notice'
  );

  return {
    url,
    content: normalized,
    length: normalized.length,
  };
}
