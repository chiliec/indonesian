import { z } from 'zod';

export const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  DEEPGRAM_API_KEY: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof EnvSchema>;
