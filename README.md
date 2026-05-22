# Indonesian Conversation Bot

Telegram bot that helps English-speaking Bali expats practice Bahasa Indonesia
through scenario-driven role-play with text + voice, Claude-powered conversation
partners, and Haiku-powered grammar/pronunciation corrections.

## Stack
- Node 20 + TypeScript (ESM, NodeNext)
- grammY (Telegram), Mongoose + Typegoose (MongoDB)
- Anthropic Claude Sonnet 4.6 (character) + Haiku 4.5 (corrections)
- Deepgram nova-3 (STT) + Google Cloud TTS (id-ID-Wavenet-A)
- Telegram Stars for monetization

## Setup
1. Copy `.env.example` → `.env` and fill values.
2. Place Google Cloud service-account JSON at `./secrets/gcp-tts.json`.
3. `docker compose up -d`.
4. Talk to the bot.

## Env vars (required)
- `TELEGRAM_BOT_TOKEN`
- `ANTHROPIC_API_KEY`
- `DEEPGRAM_API_KEY`
- `MONGODB_URI`
- `GOOGLE_APPLICATION_CREDENTIALS` (path)
- `ADMIN_TELEGRAM_IDS` (comma-separated)

## Dev
```bash
npm install
npm run dev   # tsx watch
npm test      # node:test + mongodb-memory-server
npm run typecheck
```

## Commands
- `/start` — welcome
- `/menu` — main menu (inline)
- `/scenarios` — pick a scenario
- `/end` — end current scenario
- `/subscribe` — Stars subscription
- `/lang` — switch interface language (en/ru)
- `/stats` — admin only
