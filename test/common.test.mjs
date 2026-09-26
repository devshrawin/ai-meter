import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ console });
for (const f of ['src/core/quotas.js', 'src/core/common.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
}
const AM = ctx.AIMeter;
const NOW = Date.UTC(2026, 8, 26, 10, 0, 0);
const plain = (v) => JSON.parse(JSON.stringify(v));

test('pctOf handles pct, used/limit, remaining/limit', () => {
  assert.equal(AM.pctOf({ pct: 42 }), 42);
  assert.equal(AM.pctOf({ pct: 140 }), 100);
  assert.equal(AM.pctOf({ used: 40, limit: 160 }), 25);
  assert.equal(AM.pctOf({ remaining: 30, limit: 40 }), 25);
  assert.equal(AM.pctOf({ used: 5 }), null);
});

test('toTime parses ISO, epoch seconds, ms, relative seconds', () => {
  assert.equal(AM.toTime('2026-09-26T12:00:00Z'), Date.UTC(2026, 8, 26, 12));
  assert.equal(AM.toTime(1790000000), 1790000000000);
  assert.equal(AM.toTime(1790000000000), 1790000000000);
  assert.equal(AM.toTime(120, 'rel', NOW), NOW + 120000);
  assert.equal(AM.toTime(null), undefined);
});

test('findLimits: ChatGPT limits_progress shape', () => {
  const ms = plain(AM.findLimits([
    { feature_name: 'deep_research', remaining: 12, reset_after: '2026-10-01T00:00:00Z' },
    { feature_name: 'image_gen', remaining: 3 },
  ], { now: NOW }));
  assert.equal(ms.length, 2);
  assert.equal(ms[0].label, 'Deep Research');
  assert.equal(ms[0].remaining, 12);
  assert.equal(ms[0].resetAt, Date.UTC(2026, 9, 1));
  assert.equal(ms[1].label, 'Image Gen');
});

test('findLimits: Grok rate-limits shape with label hint', () => {
  const ms = plain(AM.findLimits({ windowSizeSeconds: 7200, remainingQueries: 15, totalQueries: 20, waitTimeSeconds: 600 }, { label: 'grok-4', now: NOW }));
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].label, ms[0].remaining, ms[0].limit, ms[0].used], ['grok-4', 15, 20, 5]);
  assert.equal(ms[0].resetAt, NOW + 600000);
  assert.equal(AM.pctOf(ms[0]), 25);
});

test('findLimits: multiple remaining_* keys in one object', () => {
  const ms = plain(AM.findLimits({ user: { remaining_pro: 280, remaining_research: 4 } }));
  assert.deepEqual(ms.map((m) => m.label), ['Pro', 'Research']);
});

test('findLimits ignores unrelated JSON', () => {
  assert.equal(AM.findLimits({ id: 1, name: 'x', items: [{ count: 3 }] }).length, 0);
});

test('countMeters: first match wins, rolling window, limit 0 = count only', () => {
  const H = 3600e3;
  const events = [
    { t: NOW - 4 * H, m: 'gpt-5' },
    { t: NOW - 2 * H, m: 'gpt-5' },
    { t: NOW - 1 * H, m: 'auto' },
    { t: NOW - 1 * H, m: 'gpt-5-thinking' },
  ];
  const ms = plain(AM.countMeters(events, AM.DEFAULT_QUOTAS.chatgpt, NOW));
  const thinking = ms.find((m) => m.id === 'thinking');
  const msgs = ms.find((m) => m.id === 'messages');
  assert.equal(thinking.used, 1);
  assert.equal(msgs.used, 2);
  assert.equal(msgs.limit, 160);
  assert.equal(msgs.resetAt, NOW - 2 * H + 3 * H);

  const counts = plain(AM.countMeters([{ t: NOW, m: '' }], [{ id: 'q', label: 'Q', pattern: '.*', limit: 0, windowHours: 24 }], NOW));
  assert.equal(counts[0].used, 1);
  assert.equal(counts[0].limit, undefined);
  assert.equal(AM.pctOf(counts[0]), null);
});

test('countMeters survives a bad regex', () => {
  const ms = AM.countMeters([{ t: NOW, m: 'x' }], [{ id: 'a', label: 'A', pattern: '(', limit: 5, windowHours: 1 }], NOW);
  assert.equal(ms[0].used, 1);
});

test('parseReset: relative, 12h and 24h clock', () => {
  assert.equal(AM.parseReset('Try again in 3 hours', NOW), NOW + 3 * 3600e3);
  assert.equal(AM.parseReset('resets in 45 minutes', NOW), NOW + 45 * 60e3);
  const local = new Date(NOW);
  const pm = new Date(local); pm.setHours(17, 0, 0, 0);
  if (pm.getTime() <= NOW) pm.setDate(pm.getDate() + 1);
  assert.equal(AM.parseReset('Your limit resets at 5:00 PM', NOW), pm.getTime());
  const h = new Date(local); h.setHours(local.getHours(), 0, 0, 0);
  assert.ok(AM.parseReset(`until ${String(local.getHours()).padStart(2, '0')}:00`, NOW) > NOW);
  assert.equal(AM.parseReset('no time here', NOW), undefined);
});

test('providerForHost matches subdomains', () => {
  assert.equal(AM.providerForHost('www.perplexity.ai').id, 'perplexity');
  assert.equal(AM.providerForHost('chat.openai.com').id, 'chatgpt');
  assert.equal(AM.providerForHost('example.com'), undefined);
});

test('mergeSettings keeps defaults for missing providers', () => {
  const s = AM.mergeSettings({ widget: false, quotas: { gemini: [] } });
  assert.equal(s.widget, false);
  assert.equal(s.notify, true);
  assert.equal(s.quotas.gemini.length, 0);
  assert.equal(s.quotas.chatgpt.length, 2);
});

test('formatDuration', () => {
  assert.equal(AM.formatDuration(30 * 60e3), '30m');
  assert.equal(AM.formatDuration(90 * 60e3), '1h 30m');
  assert.equal(AM.formatDuration(3 * 86400e3), '3d 0h');
  assert.equal(AM.formatDuration(-5), 'now');
});
