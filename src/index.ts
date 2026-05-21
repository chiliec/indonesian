import 'dotenv/config';
import { EnvSchema } from './config/schema.js';
import { logger } from './util/logger.js';
import { connectMongo, disconnectMongo } from './db/mongo.js';
import { UsersRepo } from './db/users.js';
import { createBot } from './bot.js';

async function main() {
  const env = EnvSchema.parse(process.env);
  await connectMongo(env.MONGODB_URI);
  const usersRepo = new UsersRepo();
  const bot = createBot({ token: env.TELEGRAM_BOT_TOKEN, usersRepo, logger });

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
