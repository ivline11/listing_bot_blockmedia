import { Bot } from 'grammy';
import { getDatabase } from '../storage/db.js';
import logger from '../utils/logger.js';

/**
 * Setup bot commands
 */
export function setupCommands(bot: Bot) {
  // /on command - Enable bot in this chat
  bot.command('on', async (ctx) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;

    const db = getDatabase();
    db.setChatEnabled(chatId, true);

    logger.info({ chatId }, 'Bot enabled via /on command');
    await ctx.reply('✅ 봇이 활성화되었습니다. 상장 공지를 모니터링합니다.');
  });

  // /off command - Disable bot in this chat
  bot.command('off', async (ctx) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;

    const db = getDatabase();
    db.setChatEnabled(chatId, false);

    logger.info({ chatId }, 'Bot disabled via /off command');
    await ctx.reply('⏸️ 봇이 비활성화되었습니다. 상장 공지를 처리하지 않습니다.');
  });

  // /status command - Show bot status
  bot.command('status', async (ctx) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;
    const db = getDatabase();
    const setting = db.getChatSetting(chatId);

    const enabled = setting ? setting.enabled === 1 : false;
    const status = enabled ? '✅ 활성화' : '⏸️ 비활성화';

    // Only show on/off status per user request
    const message = `상태: ${status}`;

    await ctx.reply(message);
  });

  // /start command - Welcome message
  bot.command('start', async (ctx) => {
    const message = `🤖 블록미디어 상장 봇

업비트/빗썸 신규 상장 공지를 자동으로 감지하여 기사를 생성합니다.

─── 명령어 ───
/on - 봇 활성화
/off - 봇 비활성화
/status - 현재 상태 확인

─── 사용법 ───
상장 공지를 이 방에 포워딩하면 자동으로 기사를 생성합니다.

감지 키워드:
• 업비트 → 신규 거래지원
• 빗썸 → 원화마켓 추가

위 키워드가 포함된 메시지만 처리하고, 그 외는 무시합니다.`;

    await ctx.reply(message);
  });
}
