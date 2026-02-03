import { Bot, InputFile } from 'grammy';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';

export interface PublishResult {
  success: boolean;
  error?: string;
}

/**
 * Publish article and press release to Telegram chat
 */
export async function publishToTelegram(
  bot: Bot,
  chatId: number,
  title: string,
  articleMessage: string,
  pressReleaseMessage: string,
  imagePath: string
): Promise<PublishResult> {
  try {
    // Ensure the article message includes the title at the top. Some LLM
    // outputs may not include the title inside `articleMessage`, so prepend
    // it when necessary to keep article and press release consistent.
    let articleToSend = articleMessage;
    if (title && !articleMessage.trim().startsWith(title.trim())) {
      articleToSend = `${title}\n\n${articleMessage}`.trim();
    }

    // Message 1: Article content
    await bot.api.sendMessage(chatId, articleToSend, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });

    logger.info({ chatId }, 'Article message sent');

    // Message 2: Press release with image
    if (!existsSync(imagePath)) {
      logger.warn({ imagePath }, 'Image file not found, sending without image');
      await bot.api.sendMessage(chatId, pressReleaseMessage);
    } else {
      await bot.api.sendPhoto(chatId, new InputFile(imagePath), {
        caption: pressReleaseMessage,
      });
    }

    logger.info({ chatId }, 'Press release message sent');

    return { success: true };
  } catch (error) {
    logger.error({ chatId, error }, 'Failed to publish to Telegram');
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Publish to multiple chats
 */
export async function publishToMultipleChats(
  bot: Bot,
  chatIds: number[],
  title: string,
  articleMessage: string,
  pressReleaseMessage: string,
  imagePath: string
): Promise<Map<number, PublishResult>> {
  const results = new Map<number, PublishResult>();

  for (const chatId of chatIds) {
    const result = await publishToTelegram(
      bot,
      chatId,
      title,
      articleMessage,
      pressReleaseMessage,
      imagePath
    );
    results.set(chatId, result);
  }

  const successCount = Array.from(results.values()).filter((r) => r.success).length;
  logger.info(
    { total: chatIds.length, success: successCount },
    'Batch publish completed'
  );

  return results;
}
