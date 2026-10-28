import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const AM = (() => {
  const ctx = vm.createContext({ console });
  for (const f of ['src/core/quotas.js', 'src/core/common.js']) vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  return ctx.AIMeter;
})();
const now = 1_000_000_000_000;
const H = 3600e3;

test('resetText: a reset time in the past reads "reset due" / "frees up now", never "in now"', () => {
  assert.equal(AM.resetText({ resetAt: now - 1, source: 'real' }, now), 'reset due');
  assert.equal(AM.resetText({ resetAt: now - 1, source: 'estimate' }, now), 'frees up now');
  assert.equal(AM.resetText({ resetAt: now + 13 * H, source: 'real' }, now), 'resets in 13h 0m');
  assert.equal(AM.resetText({ source: 'real' }, now), '');
});

test('splitMeters: percentage meters get bars, counter-only meters get chips', () => {
  const { bars, counters } = AM.splitMeters([
    { id: 'a', label: 'Weekly', pct: 32 },
    { id: 'b', label: 'Image Gen', remaining: 9 },
    { id: 'c', label: 'Messages', used: 3, limit: 160 },
    { id: 'd', label: 'Empty' },
  ]);
  assert.deepEqual(bars.map((m) => m.id).sort(), ['a', 'c']);
  assert.deepEqual(counters.map((m) => m.id), ['b']);
});

test('isStale: older than a day or never updated', () => {
  assert.equal(AM.isStale({ updatedAt: now - 2 * H }, now), false);
  assert.equal(AM.isStale({ updatedAt: now - 25 * H }, now), true);
  assert.equal(AM.isStale({}, now), true);
});

test('cardSource: real, estimate or mixed', () => {
  assert.equal(AM.cardSource([{ source: 'real' }]), 'real');
  assert.equal(AM.cardSource([{ source: 'estimate' }]), 'estimate');
  assert.equal(AM.cardSource([{ source: 'real' }, { source: 'estimate' }]), 'mixed');
  assert.equal(AM.cardSource([]), '');
});

test('sortEntries: fresh before stale, then closest to its limit, then provider order', () => {
  const e = (provider, pct, ago) => ({ provider, name: provider, updatedAt: now - ago, meters: [{ id: 'five_hour', label: 'Session', pct, source: 'real' }] });
  const order = (id) => ['claude', 'chatgpt', 'gemini'].indexOf(id);
  const out = AM.sortEntries([e('claude', 90, 48 * H), e('chatgpt', 10, H), e('gemini', 60, H)], order, now);
  assert.deepEqual(out.map((x) => x.provider), ['gemini', 'chatgpt', 'claude']);
});
