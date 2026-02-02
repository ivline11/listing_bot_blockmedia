import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import logger from '../utils/logger.js';

export interface ChatSetting {
  chat_id: number;
  enabled: number;
  updated_at: string;
}

export interface ProcessedListing {
  id?: number;
  exchange: string;
  ticker: string;
  first_seen_at: string;
  notice_url: string;
  notice_hash?: string;
}

export interface JobLog {
  id?: number;
  created_at: string;
  level: string;
  event: string;
  payload: string;
}

export class BotDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure the directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
    logger.info({ dbPath }, 'Database initialized');
  }

  private migrate(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_settings (
        chat_id INTEGER PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS processed_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange TEXT NOT NULL,
        ticker TEXT NOT NULL,
        first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notice_url TEXT NOT NULL,
        notice_hash TEXT,
        UNIQUE(exchange, ticker)
      );

      CREATE TABLE IF NOT EXISTS job_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL,
        event TEXT NOT NULL,
        payload TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_processed_listings_exchange_ticker
        ON processed_listings(exchange, ticker);

      CREATE INDEX IF NOT EXISTS idx_job_logs_created_at
        ON job_logs(created_at);
    `);

    logger.info('Database migration completed');
  }

  // Chat Settings operations
  getChatSetting(chatId: number): ChatSetting | undefined {
    const stmt = this.db.prepare('SELECT * FROM chat_settings WHERE chat_id = ?');
    return stmt.get(chatId) as ChatSetting | undefined;
  }

  setChatEnabled(chatId: number, enabled: boolean): void {
    const stmt = this.db.prepare(`
      INSERT INTO chat_settings (chat_id, enabled, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(chat_id) DO UPDATE SET
        enabled = excluded.enabled,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(chatId, enabled ? 1 : 0);
    logger.info({ chatId, enabled }, 'Chat setting updated');
  }

  getAllEnabledChats(): ChatSetting[] {
    const stmt = this.db.prepare('SELECT * FROM chat_settings WHERE enabled = 1');
    return stmt.all() as ChatSetting[];
  }

  // Processed Listings operations
  isListingProcessed(exchange: string, ticker: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM processed_listings WHERE exchange = ? AND ticker = ? LIMIT 1'
    );
    return stmt.get(exchange, ticker) !== undefined;
  }

  markListingProcessed(listing: ProcessedListing): void {
    const stmt = this.db.prepare(`
      INSERT INTO processed_listings (exchange, ticker, first_seen_at, notice_url, notice_hash)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
    `);
    stmt.run(listing.exchange, listing.ticker, listing.notice_url, listing.notice_hash || null);
    logger.info({ exchange: listing.exchange, ticker: listing.ticker }, 'Listing marked as processed');
  }

  getAllProcessedListings(): ProcessedListing[] {
    const stmt = this.db.prepare('SELECT * FROM processed_listings ORDER BY first_seen_at DESC');
    return stmt.all() as ProcessedListing[];
  }

  // Job Logs operations
  addJobLog(log: Omit<JobLog, 'id' | 'created_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO job_logs (level, event, payload)
      VALUES (?, ?, ?)
    `);
    stmt.run(log.level, log.event, log.payload);
  }

  getRecentJobLogs(limit: number = 100): JobLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM job_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as JobLog[];
  }

  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }
}

// Singleton instance
let dbInstance: BotDatabase | null = null;

export function initDatabase(dbPath: string): BotDatabase {
  if (!dbInstance) {
    dbInstance = new BotDatabase(dbPath);
  }
  return dbInstance;
}

export function getDatabase(): BotDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbInstance;
}
