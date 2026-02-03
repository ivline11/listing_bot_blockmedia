import browserManager from '../scraper/browser_manager.js';
import logger from '../utils/logger.js';

export interface NoticeItem {
  noticeId: string;
  title: string;
  url: string;
}

const UPBIT_NOTICE_LIST_URL = 'https://upbit.com/service_center/notice';

/**
 * Fetch Upbit notice list using Playwright (SPA page)
 * Filters for "신규 거래지원 안내" type notices
 */
export async function fetchUpbitNotices(): Promise<NoticeItem[]> {
  logger.info('Fetching Upbit notice list');

  const context = await browserManager.createContext();

  try {
    const page = await context.newPage();

    await page.goto(UPBIT_NOTICE_LIST_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for SPA to render
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      logger.debug('Upbit notice list: network idle timeout, continuing');
    }

    await page.waitForTimeout(2000);

    // Extract all notice links and titles from rendered DOM
    const allNotices = await page.evaluate(() => {
      const results: { id: string; title: string; href: string }[] = [];

      // Strategy 1: Find <a> tags with notice id in href
      const links = document.querySelectorAll('a');
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';

        const idMatch = href.match(/[?&]id=(\d+)/);
        if (idMatch && text.length > 5) {
          results.push({
            id: idMatch[1],
            title: text,
            href: href,
          });
        }
      });

      if (results.length > 0) return results;

      // Strategy 2: Look for notice rows in tables or list containers
      const rows = document.querySelectorAll(
        'tr, [class*="notice"], [class*="list-item"], [class*="board-item"]'
      );
      rows.forEach((row) => {
        const link = row.querySelector('a');
        if (link) {
          const href = link.getAttribute('href') || '';
          const text = link.textContent?.trim() || row.textContent?.trim() || '';
          const idMatch = href.match(/[?&]id=(\d+)/);
          if (idMatch && text.length > 5) {
            results.push({
              id: idMatch[1],
              title: text.substring(0, 200),
              href: href,
            });
          }
        }
      });

      return results;
    });

    logger.info({ totalNotices: allNotices.length }, 'Upbit notices fetched');

    // Filter for listing announcements: "신규 거래지원 안내"
    const listingNotices = allNotices.filter((n) => {
      const normalized = n.title.replace(/\s+/g, '');
      return (
        normalized.includes('신규거래지원') ||
        normalized.includes('신규거래지원안내')
      );
    });

    // Deduplicate by id and build full URLs
    const seen = new Set<string>();
    const dedupedNotices: NoticeItem[] = [];

    for (const notice of listingNotices) {
      if (seen.has(notice.id)) continue;
      seen.add(notice.id);

      const url = notice.href.startsWith('http')
        ? notice.href
        : `https://upbit.com${notice.href.startsWith('/') ? '' : '/'}${notice.href}`;

      dedupedNotices.push({
        noticeId: notice.id,
        title: notice.title,
        url: url,
      });
    }

    logger.info(
      { listingNotices: dedupedNotices.length },
      'Upbit listing notices filtered'
    );

    return dedupedNotices;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Upbit notices');
    throw error;
  } finally {
    await context.close();
  }
}
