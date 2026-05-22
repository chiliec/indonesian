import 'dotenv/config';
import path from 'node:path';
import { EnvSchema } from './config/schema.js';
import { logger } from './util/logger.js';
import { connectMongo, disconnectMongo } from './db/mongo.js';
import { UsersRepo } from './db/users.js';
import { SessionsRepo } from './db/sessions.js';
import { ScenarioEngine } from './services/scenarios/ScenarioEngine.js';
import { AnthropicService } from './services/anthropic.js';
import { ConversationService } from './services/ConversationService.js';
import { CorrectionService } from './services/CorrectionService.js';
import { DeepgramService } from './services/DeepgramService.js';
import { TtsService } from './services/TtsService.js';
import { sweepStaleSessions } from './services/SessionSweeper.js';
import { createBot } from './bot.js';

async function main() {
  const env = EnvSchema.parse(process.env);
  await connectMongo(env.MONGODB_URI);
  const usersRepo = new UsersRepo();
  const sessions = new SessionsRepo();
  const engine = await ScenarioEngine.load(path.resolve('scenarios'));
  const anthropic = new AnthropicService({ apiKey: env.ANTHROPIC_API_KEY, logger });
  const conversation = new ConversationService({ sessions, engine, anthropic, logger });
  const correction = new CorrectionService({ anthropic });
  const deepgram = new DeepgramService({ apiKey: env.DEEPGRAM_API_KEY, logger });
  const tts = new TtsService();
  const bot = createBot({
    token: env.TELEGRAM_BOT_TOKEN,
    usersRepo,
    conversation,
    correction,
    deepgram,
    tts,
    scenarioEngine: engine,
    logger,
  });

  const sweepInterval = setInterval(async () => {
    try {
      const n = await sweepStaleSessions(sessions, 24 * 60 * 60 * 1000);
      if (n > 0) logger.info({ count: n }, 'swept stale sessions');
    } catch (err) {
      logger.error({ err }, 'sweep failed');
    }
  }, 60 * 60 * 1000);

  const shutdown = async () => {
    logger.info('shutting down');
    clearInterval(sweepInterval);
    await bot.stop();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('starting bot');
  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
