# Listing Bot (Blockmedia)

Telegram bot that monitors Upbit / Bithumb listing announcements, generates article text with an LLM, and publishes press-release style messages to configured chats.

## Environment variables
Create a `.env` based on `.env.example`. Key variables:

- `TELEGRAM_BOT_TOKEN` (required) — your bot token from BotFather
- `DB_PATH` (default `./data/db.sqlite`) — path to SQLite DB
- `LLM_PROVIDER` (optional) — which LLM to use: `gpt` or `claude` (default: `gpt`)

If using GPT (OpenAI):
- `OPENAI_API_KEY` (required for `gpt`)
- `OPENAI_MODEL` (optional, default `gpt-4o`) — you can set e.g. `gpt-4o-mini` or `gpt-4` depending on access and cost

If using Claude (Anthropic):
- `ANTHROPIC_API_KEY` (required for `claude`)

Other useful vars are documented in `.env.example` (OUTPUT_MODE, OUTPUT_CHAT_ID, LOG_LEVEL, etc.).

## Switching LLM at runtime
Set `LLM_PROVIDER=gpt` or `LLM_PROVIDER=claude` and provide the corresponding API key in the environment. The bot initializes the selected provider on startup.

## Run
Development (run TypeScript without building):
```bash
npm run dev
```

Build and run production:
```bash
npm run build
npm start
```

## Notes
- Node.js >=20 is recommended (global `fetch` is used by the OpenAI client code). If your environment doesn't provide global `fetch`, install a polyfill such as `node-fetch` or `undici` and uncomment the import in `src/llm/gpt.ts`.
- The code includes a provider factory at `src/llm/provider.ts` — this handles initializing GPT or Claude based on `LLM_PROVIDER`.
- For switching providers without code changes, update `.env` and restart the process.

If you want, I can also add a small command to print the active provider and model on startup in logs.
