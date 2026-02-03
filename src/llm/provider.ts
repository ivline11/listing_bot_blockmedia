import logger from '../utils/logger.js';
import { initGPTService, getGPTService } from './gpt.js';
import { initClaudeService, getClaudeService } from './claude.js';

type LLM = {
  generateArticle: (exchange: any, noticeContent: string) => Promise<any>;
};

let active: LLM | null = null;
let providerName = 'gpt';

export function initLLMProvider(): void {
  const provider = (process.env.LLM_PROVIDER || 'gpt').toLowerCase();
  providerName = provider;

  if (provider === 'gpt') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is required for GPT provider');
    initGPTService(key);
    active = getGPTService();
    logger.info({ provider }, 'Initialized GPT provider');
    return;
  }

  if (provider === 'claude') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY is required for Claude provider');
    initClaudeService(key);
    active = getClaudeService();
    logger.info({ provider }, 'Initialized Claude provider');
    return;
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

export function getLLMService(): LLM {
  if (!active) throw new Error('LLM provider not initialized. Call initLLMProvider first.');
  return active;
}

export function getActiveProviderName(): string {
  return providerName;
}
