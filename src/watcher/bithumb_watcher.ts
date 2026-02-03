import { request } from 'undici';
import * as cheerio from 'cheerio';
import browserManager from '../scraper/browser_manager.js';
import logger from '../utils/logger.js';

export interface NoticeItem {
  noticeId: string;
  title: string;
  url: string;
}

const BITHUMB_NOTICE_LIST_URL = 'https://feed.bithumb.com/notice?category=9&page=1';
const BITHUMB_BASE_URL = 'https://feed.bithumb.com';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

/**
 * Fetch Bithumb notice list
 * Tries static scraping first, falls back to Playwright
 * Filters for "원화마켓 추가" type notices
 */
export async function fetchBithumbNotices(): Promise<NoticeItem[]> {
  logger.info('Fetching Bithumb notice list');

  try {
    const notices = await fetchBithumbStatic();
    if (notices.length > 0) {
      logger.info({ count: notices.length }, 'Bithumb notices fetched (static)');
      return notices;
    }
    logger.warn('Bithumb static scraping returned 0 notices, trying Playwright');
  } catch (error) {
    logger.warn({ error }, 'Bithumb static scraping failed, falling back to Playwright');
  }

  return fetchBithumbWithPlaywright();
}

/**
 * Static scraping with undici + cheerio
 */
async function fetchBithumbStatic(): Promise<NoticeItem[]> {
  const { statusCode, body } = await request(BITHUMB_NOTICE_LIST_URL, {
    method: 'GET',
    headers: HEADERS,
  });

  if (statusCode !== 200) {
    throw new Error(`HTTP ${statusCode} from Bithumb notice list`);
  }

  const html = await body.text();
  const $ = cheerio.load(html);
  const notices: NoticeItem[] = [];

  // Try multiple selectors for Bithumb notice list items
  const selectors = [
    'a[href*="/notice/"]',
    '[class*="notice"] a',
    '[class*="board"] a',
    'table tbody tr a',
    '.list-item a',
    '[class*="list"] a[href]',
  ];

  for (const selector of selectors) {
    $(selector).each((_i, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim();

      // Extract notice ID from URL: /notice/1234 or ?id=1234
      const idMatch = href.match(/\/notice\/(\d+)/) || href.match(/[?&]id=(\d+)/);
      if (idMatch && title.length > 3) {
        const url = href.startsWith('http') ? href : `${BITHUMB_BASE_URL}${href}`;
        notices.push({
          noticeId: idMatch[1],
          title: title,
          url: url,
        });
      }
    });

    if (notices.length > 0) break;
  }

  // Filter for 원화마켓 추가
  return deduplicateAndFilter(notices);
}

/**
 * Playwright fallback for dynamic pages
 */
async function fetchBithumbWithPlaywright(): Promise<NoticeItem[]> {
  logger.info('Fetching Bithumb notices with Playwright');

  const context = await browserManager.createContext();

  try {
    const page = await context.newPage();

    await page.goto(BITHUMB_NOTICE_LIST_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      logger.debug('Bithumb notice list: network idle timeout, continuing');
    }

    await page.waitForTimeout(2000);

    const rawNotices = await page.evaluate(() => {
      const results: { id: string; title: string; href: string }[] = [];

      const links = document.querySelectorAll('a');
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';

        const idMatch = href.match(/\/notice\/(\d+)/) || href.match(/[?&]id=(\d+)/);
        if (idMatch && text.length > 3) {
          results.push({
            id: idMatch[1],
            title: text,
            href: href,
          });
        }
      });

      return results;
    });

    logger.info(
      { totalNotices: rawNotices.length },
      'Bithumb notices fetched (Playwright)'
    );

    const notices: NoticeItem[] = rawNotices.map((n) => ({
      noticeId: n.id,
      title: n.title,
      url: n.href.startsWith('http') ? n.href : `${BITHUMB_BASE_URL}${n.href}`,
    }));

    return deduplicateAndFilter(notices);
  } catch (error) {
    logger.error({ error }, 'Bithumb Playwright scraping failed');
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * Filter for "원화마켓 추가" and deduplicate by noticeId
 */
function deduplicateAndFilter(notices: NoticeItem[]): NoticeItem[] {
  const filtered = notices.filter((n) => {
    const normalized = n.title.replace(/\s+/g, '');
    return normalized.includes('원화마켓추가');
  });

  const seen = new Set<string>();
  return filtered.filter((n) => {
    if (seen.has(n.noticeId)) return false;
    seen.add(n.noticeId);
    return true;
  });
}
