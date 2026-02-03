import browserManager from '../scraper/browser_manager.js';
import logger from '../utils/logger.js';

export interface NoticeItem {
  noticeId: string;
  title: string;
  url: string;
}

const BITHUMB_NOTICE_LIST_URL = 'https://feed.bithumb.com/notice?category=9&page=1';
const BITHUMB_BASE_URL = 'https://feed.bithumb.com';

/**
 * Fetch Bithumb notice list via Playwright
 * Filters for "원화마켓 추가" type notices
 */
export async function fetchBithumbNotices(): Promise<NoticeItem[]> {
  logger.info('Fetching Bithumb notice list');

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

    logger.info({ count: rawNotices.length }, 'Bithumb notices fetched');

    const notices: NoticeItem[] = rawNotices.map((n) => ({
      noticeId: n.id,
      title: n.title,
      url: n.href.startsWith('http') ? n.href : `${BITHUMB_BASE_URL}${n.href}`,
    }));

    return deduplicateAndFilter(notices);
  } catch (error) {
    logger.error({ error }, 'Bithumb scraping failed');
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
