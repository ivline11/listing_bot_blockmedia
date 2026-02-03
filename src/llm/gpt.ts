import { loadPrompt } from './prompt_loader.js';
import { ExchangeType } from '../bot/filters.js';
import { ClaudeResponseSchema } from './schema.js';
import logger from '../utils/logger.js';

const SYSTEM_PROMPT = `당신은 블록미디어 기사 작성 전문가입니다.

중요 규칙:
0. 블록미디어 양식으로 기사화할것
1. 제공된 프롬프트 양식을 절대 벗어나지 마세요
2. 공지사항 전문에 명시된 내용만 사용하세요
3. 추측, 각색, 추가 정보 삽입을 하지 마세요
4. 반드시 JSON 형식으로만 응답하세요 (추가 텍스트 없음)
5. 두 개의 메시지를 모두 생성하세요: article_message, press_release_message
6. 반드시 맨 윗 줄에 제목(Title)을 포함하세요

출력 형식:
{
  "exchange": "UPBIT" 또는 "BITHUMB",
  "ticker": "코인 티커",
  "title": "기사 제목",
  "article_message": "기사 본문 전체",
  "press_release_message": "텔레그램 배포 문구"
}`;

export class GPTService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateArticle(exchange: ExchangeType, noticeContent: string) {
    const prompt = loadPrompt(exchange);

    const userMessage = `${prompt}\n\n---\n\n복사한 공지사항 전문:\n\n${noticeContent}`;

    logger.info({ exchange }, 'Calling OpenAI GPT API');
    const startTime = Date.now();

    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Some newer OpenAI models (e.g. gpt-4o) do not accept `max_tokens` and instead
    // require `max_completion_tokens`. Use the appropriate parameter based on model.
    const bodyBase: any = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    };

    // Use `max_completion_tokens` which is accepted by modern OpenAI chat models
    // (this avoids the 'unsupported_parameter' error with gpt-4o variants).
    bodyBase.max_completion_tokens = 4096;

    const body = bodyBase as any;

    // Use global fetch (Node 18+/20+) or a fetch polyfill; avoid node-fetch dependency
  logger.debug({ model, bodyKeys: Object.keys(body), bodyPreview: { max_tokens: body.max_tokens, max_completion_tokens: body.max_completion_tokens } }, 'OpenAI request body');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const latency = Date.now() - startTime;

    if (!resp.ok) {
      const text = await resp.text();
      logger.error({ status: resp.status, body: text }, 'OpenAI API error');
      throw new Error(`OpenAI API error: ${resp.status} ${text}`);
    }

    const data = await resp.json();

    const textContent = data.choices?.[0]?.message?.content;
    if (!textContent) {
      throw new Error('No text content in OpenAI response');
    }

    const jsonMatch = String(textContent).match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : textContent;

    const parsed = JSON.parse(jsonString);
    let validated = ClaudeResponseSchema.parse(parsed);

    // If press_release_message is missing or too short, apply fallback
    if (!validated.press_release_message || validated.press_release_message.length < 50) {
      logger.warn({ exchange, ticker: parsed.ticker }, 'press_release_message missing or too short — using local fallback');
      const shortTitle = (validated.title || '').trim();
      const ticker = (validated.ticker || '').trim();
      const fallback = `${shortTitle} (${ticker})\n블록미디어에서 상장 관련 소식을 확인하세요.`;
      validated = { ...validated, press_release_message: fallback } as typeof validated;
    }

    logger.info({ exchange, ticker: validated.ticker, latency }, 'OpenAI GPT API call successful');

    return validated;
  }
}

let gptInstance: GPTService | null = null;

export function initGPTService(apiKey: string): GPTService {
  if (!gptInstance) {
    gptInstance = new GPTService(apiKey);
  }
  return gptInstance;
}

export function getGPTService(): GPTService {
  if (!gptInstance) {
    throw new Error('GPT service not initialized. Call initGPTService first.');
  }
  return gptInstance;
}
