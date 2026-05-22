import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTtsRequest } from '../../src/services/TtsService.js';

test('buildTtsRequest uses id-ID-Wavenet-A by default', () => {
  const req = buildTtsRequest('Halo dunia');
  assert.equal(req.voice.languageCode, 'id-ID');
  assert.equal(req.voice.name, 'id-ID-Wavenet-A');
  assert.equal(req.input.text, 'Halo dunia');
  assert.equal(req.audioConfig.audioEncoding, 'OGG_OPUS');
});
