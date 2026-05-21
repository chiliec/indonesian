import 'reflect-metadata';
import { loadEnv } from './config/loader.js';
import { logger } from './util/logger.js';

async function main(): Promise<void> {
  const env = loadEnv();
  logger.info({ logLevel: env.LOG_LEVEL }, 'starting indonesian-bot');
  // bot wiring lands in Task 4
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
