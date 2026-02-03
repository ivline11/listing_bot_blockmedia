import { Bot, Context } from 'grammy';
import { getDatabase } from '../storage/db.js';
import logger from '../utils/logger.js';

/**
 * Check if user is admin in the chat
 */
async function isUserAdmin(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) {
    return false;
  }

  // Allow in private chats
  if (ctx.chat.type === 'private') {
    return true;
  }

  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return member.status === 'creator' || member.status === 'administrator';
  } catch (error) {
    logger.error({ chatId: ctx.chat.id, userId: ctx.from.id, error }, 'Failed to check admin status');
    return false;
  }
}

/**
 * Setup bot commands
 */
export function setupCommands(bot: Bot) {
  // /on command - Enable bot in this chat
  bot.command('on', async (ctx) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;

    if (!(await isUserAdmin(ctx))) {
      await ctx.reply('이 명령어는 관리자만 사용할 수 있습니다.');
      return;
    }

    const db = getDatabase();
    db.setChatEnabled(chatId, true);

    logger.info({ chatId }, 'Bot enabled via /on command');
    await ctx.reply('✅ 봇이 활성화되었습니다. 상장 공지를 모니터링합니다.');
  });

  // /off command - Disable bot in this chat
  bot.command('off', async (ctx) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;

    if (!(await isUserAdmin(ctx))) {
      await ctx.reply('이 명령어는 관리자만 사용할 수 있습니다.');
      return;
    }

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

이 봇은 업비트/빗썸의 신규 상장 공지를 자동으로 감지하여 기사를 생성합니다.

사용 가능한 명령어:
/on - 봇 활성화
/off - 봇 비활성화
/status - 현재 상태 확인

관리자만 /on /off 명령어를 사용할 수 있습니다.`;

    await ctx.reply(message);
  });
}
