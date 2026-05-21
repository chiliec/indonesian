import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnvSchema } from '../../src/config/schema.js';

test('EnvSchema requires TELEGRAM_BOT_TOKEN', () => {
  const result = EnvSchema.safeParse({});
  assert.equal(result.success, false);
});

test('EnvSchema accepts a complete env', () => {
  const env = {
    TELEGRAM_BOT_TOKEN: 't',
    ANTHROPIC_API_KEY: 'a',
    MONGODB_URI: 'mongodb://localhost/x',
  };
  const result = EnvSchema.safeParse(env);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.LOG_LEVEL, 'info');
});
