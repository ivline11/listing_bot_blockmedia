import { Bot } from 'grammy';
import { fetchUpbitNotices } from './upbit_watcher.js';
import { fetchBithumbNotices } from './bithumb_watcher.js';
import { processListingAnnouncement } from '../bot/router.js';
import { getDatabase } from '../storage/db.js';
import logger from '../utils/logger.js';

// Polling config
const DEFAULT_INTERVAL_MS = 45000; // 45 seconds
const BACKOFF_DELAYS_MS = [5000, 10000, 30000, 60000]; // 5s → 10s → 30s → 60s

// State
let isRunning = false;
let upbitBackoffIndex = 0;
let bithumbBackoffIndex = 0;
let upbitTimer: ReturnType<typeof setTimeout> | null = null;
let bithumbTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Create a synthetic message string that passes filterListingMessage.
 * Format matches what the filter expects after whitespace normalization:
 *   UPBIT  → must contain "업비트" + "신규거래지원"
 *   BITHUMB → must contain "빗썸" + "원화마켓추가"
 */
function createSyntheticMessage(
  exchange: 'UPBIT' | 'BITHUMB',
  title: string,
  url: string
): string {
  if (exchange === 'UPBIT') {
    return `업비트(Upbit) 공지 신규 거래 지원 안내: ${title}\n${url}`;
  }
  return `빗썸(Bithumb) 원화 마켓 추가: ${title}\n${url}`;
}

/**
 * Process a single newly detected notice from web polling
 */
async function processPolledNotice(
  bot: Bot,
  exchange: 'UPBIT' | 'BITHUMB',
  noticeId: string,
  title: string,
  url: string
): Promise<void> {
  const db = getDatabase();

  // Dedup: skip if already polled
  if (db.isNoticePolled(exchange, noticeId)) {
    logger.debug({ exchange, noticeId }, 'Notice already polled, skipping');
    return;
  }

  logger.info({ exchange, noticeId, title, url }, 'New notice detected via web polling');

  const syntheticMessage = createSyntheticMessage(exchange, title, url);

  const result = await processListingAnnouncement(bot, syntheticMessage);

  // Mark as polled — always, so we don't re-poll even if pipeline skipped it
  db.markNoticePollProcessed(exchange, noticeId, url);

  if (result.success) {
    logger.info(
      { exchange, noticeId, ticker: result.ticker },
      'Polled notice processed successfully'
    );
  } else {
    logger.info(
      { exchange, noticeId, reason: result.reason },
      'Polled notice pipeline skipped'
    );
  }
}

// ---------------------------------------------------------------------------
// Upbit polling loop
// ---------------------------------------------------------------------------

async function pollUpbit(bot: Bot): Promise<void> {
  try {
    // Only poll when at least one chat is /on
    const db = getDatabase();
    const enabledChats = db.getAllEnabledChats();
    if (enabledChats.length === 0) {
      logger.debug('No enabled chats — Upbit poll skipped');
      return;
    }

    const notices = await fetchUpbitNotices();

    // If this is the very first run and we have no record of polled notices,
    // seed the polled_notices table and do NOT process existing notices.
    if (notices.length > 0 && !db.hasAnyPolledNotices('UPBIT')) {
      logger.info('First Upbit poll detected — seeding polled_notices without processing existing notices');
      for (const notice of notices) {
        db.markNoticePollProcessed('UPBIT', notice.noticeId, notice.url);
      }
      // Skip processing on first seed
      return;
    }

    for (const notice of notices) {
      await processPolledNotice(bot, 'UPBIT', notice.noticeId, notice.title, notice.url);
    }

    upbitBackoffIndex = 0; // reset on success
  } catch (error) {
    logger.error({ error }, 'Upbit poll cycle failed');
    upbitBackoffIndex = Math.min(upbitBackoffIndex + 1, BACKOFF_DELAYS_MS.length - 1);
  }
}

function scheduleUpbit(bot: Bot): void {
  const delay =
    upbitBackoffIndex > 0
      ? BACKOFF_DELAYS_MS[upbitBackoffIndex - 1]
      : DEFAULT_INTERVAL_MS;

  logger.debug({ delayMs: delay, backoffIndex: upbitBackoffIndex }, 'Next Upbit poll scheduled');

  upbitTimer = setTimeout(async () => {
    await pollUpbit(bot);
    if (isRunning) scheduleUpbit(bot);
  }, delay);
}

// ---------------------------------------------------------------------------
// Bithumb polling loop
// ---------------------------------------------------------------------------

async function pollBithumb(bot: Bot): Promise<void> {
  try {
    const db = getDatabase();
    const enabledChats = db.getAllEnabledChats();
    if (enabledChats.length === 0) {
      logger.debug('No enabled chats — Bithumb poll skipped');
      return;
    }

    const notices = await fetchBithumbNotices();

    // Seed polled_notices on first run only, do not process existing notices.
    if (notices.length > 0 && !db.hasAnyPolledNotices('BITHUMB')) {
      logger.info('First Bithumb poll detected — seeding polled_notices without processing existing notices');
      for (const notice of notices) {
        db.markNoticePollProcessed('BITHUMB', notice.noticeId, notice.url);
      }
      return;
    }

    for (const notice of notices) {
      await processPolledNotice(bot, 'BITHUMB', notice.noticeId, notice.title, notice.url);
    }

    bithumbBackoffIndex = 0;
  } catch (error) {
    logger.error({ error }, 'Bithumb poll cycle failed');
    bithumbBackoffIndex = Math.min(bithumbBackoffIndex + 1, BACKOFF_DELAYS_MS.length - 1);
  }
}

function scheduleBithumb(bot: Bot): void {
  const delay =
    bithumbBackoffIndex > 0
      ? BACKOFF_DELAYS_MS[bithumbBackoffIndex - 1]
      : DEFAULT_INTERVAL_MS;

  logger.debug(
    { delayMs: delay, backoffIndex: bithumbBackoffIndex },
    'Next Bithumb poll scheduled'
  );

  bithumbTimer = setTimeout(async () => {
    await pollBithumb(bot);
    if (isRunning) scheduleBithumb(bot);
  }, delay);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the web polling scheduler.
 * Both Upbit and Bithumb run as independent loops.
 * First poll fires immediately; subsequent polls use the configured interval.
 */
export function startScheduler(bot: Bot): void {
  if (isRunning) {
    logger.warn('Scheduler already running');
    return;
  }

  isRunning = true;
  logger.info(
    { intervalMs: DEFAULT_INTERVAL_MS },
    'Starting web polling scheduler (Upbit + Bithumb)'
  );

  // Kick off first poll immediately, then continue the loop
  pollUpbit(bot).then(() => {
    if (isRunning) scheduleUpbit(bot);
  });

  pollBithumb(bot).then(() => {
    if (isRunning) scheduleBithumb(bot);
  });
}

/**
 * Stop the polling scheduler
 */
export function stopScheduler(): void {
  isRunning = false;
  if (upbitTimer) clearTimeout(upbitTimer);
  if (bithumbTimer) clearTimeout(bithumbTimer);
  upbitTimer = null;
  bithumbTimer = null;
  logger.info('Polling scheduler stopped');
}
