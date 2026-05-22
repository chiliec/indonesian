import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTranscript } from '../../src/services/DeepgramService.js';

test('extractTranscript picks first alternative.transcript', () => {
  const res = {
    results: { channels: [{ alternatives: [{ transcript: 'halo apa kabar' }] }] },
  };
  assert.equal(extractTranscript(res), 'halo apa kabar');
});

test('extractTranscript returns empty string when no alts', () => {
  const res = { results: { channels: [] } };
  assert.equal(extractTranscript(res), '');
});
