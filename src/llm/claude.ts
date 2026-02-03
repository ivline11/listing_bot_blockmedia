import Anthropic from '@anthropic-ai/sdk';
import { ClaudeResponse, ClaudeResponseSchema } from './schema.js';
import { loadPrompt } from './prompt_loader.js';
import { ExchangeType } from '../bot/filters.js';
import logger from '../utils/logger.js';

const SYSTEM_PROMPT = `당신은 블록미디어 기사 작성 전문가입니다.

중요 규칙:
1. 제공된 프롬프트 양식을 절대 벗어나지 마세요
2. 공지사항 전문에 명시된 내용만 사용하세요
3. 추측, 각색, 추가 정보 삽입을 하지 마세요
4. 반드시 JSON 형식으로만 응답하세요 (추가 텍스트 없음)
5. 두 개의 메시지를 모두 생성하세요: article_message, press_release_message
6. 반드시 맨 윗줄에 제목(Title)을 포함하세요


출력 형식:
{
  "exchange": "UPBIT" 또는 "BITHUMB",
  "ticker": "코인 티커",
  "title": "기사 제목",
  "article_message": "기사 본문 전체",
  "press_release_message": "텔레그램 배포 문구"
}`;

export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Generate article and press release for listing announcement
   */
  async generateArticle(
    exchange: ExchangeType,
    noticeContent: string
  ): Promise<ClaudeResponse> {
    const prompt = loadPrompt(exchange);

    const userMessage = `${prompt}

---

복사한 공지사항 전문:

${noticeContent}`;

    logger.info({ exchange }, 'Calling Claude API');

    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 4096,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const latency = Date.now() - startTime;

      // Extract text from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      const responseText = textContent.text;

      // Try to extract JSON from response (in case there's additional text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;

      // Parse and validate JSON
      const parsed = JSON.parse(jsonString);
      let validated = ClaudeResponseSchema.parse(parsed);

      // If press_release_message is missing or too short, apply a simple local fallback
      if (!validated.press_release_message || validated.press_release_message.length < 50) {
        logger.warn({ exchange, ticker: parsed.ticker }, 'press_release_message missing or too short — using local fallback');
        const shortTitle = (validated.title || '').trim();
        const ticker = (validated.ticker || '').trim();
        const fallback = `${shortTitle} (${ticker})\n블록미디어에서 상장 관련 소식을 확인하세요.`;
        validated = { ...validated, press_release_message: fallback } as typeof validated;
      }

      logger.info(
        {
          exchange,
          ticker: validated.ticker,
          latency,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        'Claude API call successful'
      );

      return validated;
    } catch (error) {
      logger.error({ exchange, error, latency: Date.now() - startTime }, 'Claude API call failed');
      throw error;
    }
  }
}

// Singleton instance
let claudeInstance: ClaudeService | null = null;

export function initClaudeService(apiKey: string): ClaudeService {
  if (!claudeInstance) {
    claudeInstance = new ClaudeService(apiKey);
  }
  return claudeInstance;
}

export function getClaudeService(): ClaudeService {
  if (!claudeInstance) {
    throw new Error('Claude service not initialized. Call initClaudeService first.');
  }
  return claudeInstance;
}
