import { chromium, Browser, BrowserContext } from 'playwright';
import logger from '../utils/logger.js';

/**
 * Browser singleton manager
 * Reuses a single browser instance throughout the process lifecycle
 */
class BrowserManager {
  private browser: Browser | null = null;
  private initPromise: Promise<Browser> | null = null;

  /**
   * Get or create browser instance
   */
  async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initBrowser();
    this.browser = await this.initPromise;
    this.initPromise = null;

    return this.browser;
  }

  /**
   * Initialize browser with optimal settings
   */
  private async initBrowser(): Promise<Browser> {
    logger.info('Initializing Playwright browser');

    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });

      logger.info('Playwright browser initialized');

      // Cleanup on process exit
      process.on('exit', () => {
        this.close();
      });

      process.on('SIGINT', () => {
        this.close();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        this.close();
        process.exit(0);
      });

      return browser;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        errorMessage,
        hint: 'Run: npx playwright install chromium'
      }, 'Failed to initialize Playwright browser');
      throw new Error(
        `Failed to launch Playwright browser. ${errorMessage}\n` +
        `Please run: npx playwright install chromium`
      );
    }
  }

  /**
   * Create a new context with resource blocking
   */
  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    // Block unnecessary resources
    await context.route('**/*', (route) => {
      const resourceType = route.request().resourceType();

      // Block images, fonts, media
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return context;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      logger.info('Closing Playwright browser');
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Singleton instance
const browserManager = new BrowserManager();

export default browserManager;
