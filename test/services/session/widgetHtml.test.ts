import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { WIDGET_HTML } from '../../../src/services/session/widgetHtml.js';

test('widget HTML fits the Telegram size limits', () => {
  assert.ok(Buffer.byteLength(WIDGET_HTML) <= 32768);
  const compressed = zlib.deflateSync(WIDGET_HTML, { level: 9 }).length;
  assert.ok(compressed <= 3800, `compressed ${compressed} bytes — keep a margin below 4096`);
  assert.ok(!WIDGET_HTML.includes('\u0000'));
});

test('widget script parses and uses no network or external resources', () => {
  const script = WIDGET_HTML.match(/<script>([\s\S]*)<\/script>/)![1]!;
  new vm.Script(script); // throws on a syntax error
  assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|src=|@import|url\(/.test(WIDGET_HTML));
});
