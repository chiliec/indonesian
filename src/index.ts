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
import { createBot } from './bot.js';

async function main() {
  const env = EnvSchema.parse(process.env);
  await connectMongo(env.MONGODB_URI);
  const usersRepo = new UsersRepo();
  const sessions = new SessionsRepo();
  const engine = await ScenarioEngine.load(path.resolve('scenarios'));
  const anthropic = new AnthropicService({ apiKey: env.ANTHROPIC_API_KEY, logger });
  const conversation = new ConversationService({ sessions, engine, anthropic, logger });
  const bot = createBot({
    token: env.TELEGRAM_BOT_TOKEN,
    usersRepo,
    conversation,
    scenarioEngine: engine,
    logger,
  });

  const shutdown = async () => {
    logger.info('shutting down');
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
