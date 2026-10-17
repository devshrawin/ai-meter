import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Real payload captured live on 2026-10-17 from grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig:
// just the weekly window (14 Oct -> 21 Oct 00:00 UTC), no usage figure.
const CREDITS_HEX = '00 00 00 00 30 0a 2e 12 00 1a 00 22 06 08 80 8c bb d6 06 2a 06 08 80 81 e0 d6 06 42 12 08 02 12 06 08 80 8c bb d6 06 1a 06 08 80 81 e0 d6 06 58 01 62 00 68 02 80 00 00 00 0f 67 72 70 63 2d 73 74 61 74 75 73 3a 30 0d 0a';
const bytes = Uint8Array.from(CREDITS_HEX.split(' ').map((h) => parseInt(h, 16)));

function load(fetchImpl) {
  const reports = [];
  const logs = [];
  let adapter;
  const ctx = vm.createContext({ console, atob, btoa, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, fetch: fetchImpl });
  for (const f of ['src/core/quotas.js', 'src/core/common.js', 'src/core/parsers.js']) {
    vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  }
  const AM = ctx.AIMeter;
  AM.register = (a) => { adapter = a; };
  AM.estimator = () => ({ record() {}, refresh() {} });
  vm.runInContext(readFileSync(new URL('../src/adapters/grok.js', import.meta.url), 'utf8'), ctx, { filename: 'grok.js' });
  const c = {
    onRequest() {}, onResponse() {}, visible: () => true, debug: () => true,
    log: (...a) => logs.push(a.join(' ')),
    report: (group, meters) => reports.push({ group, meters: JSON.parse(JSON.stringify(meters)) }),
  };
  adapter.init(c);
  return { adapter, reports, logs, AM };
}

test('Grok credits with no usage field is flagged as inferred, with the real reset time', () => {
  const { AM } = load(async () => { throw new Error('offline'); });
  const r = AM.parseGrokCredits(bytes, Date.UTC(2026, 9, 17, 9, 0, 0));
  assert.equal(r.meters.length, 1);
  assert.equal(r.meters[0].pct, 0);
  assert.equal(r.meters[0].inferred, true);
  assert.equal(r.meters[0].resetAt, 1792540800000);
});

test('Grok: chat usage comes from /rest/rate-limits per model; the inferred credits 0% is dropped', async () => {
  const answers = {
    'grok-4': { windowSizeSeconds: 86400, remainingQueries: 7, totalQueries: 7, lowEffortRateLimits: null, highEffortRateLimits: null },
    'grok-3': { windowSizeSeconds: 86400, remainingQueries: 15, totalQueries: 30, lowEffortRateLimits: null, highEffortRateLimits: null },
  };
  const { adapter, reports } = load(async (url, init) => {
    if (String(url).includes('GetGrokCreditsConfig')) {
      return { ok: true, headers: { get: () => '0' }, arrayBuffer: async () => bytes.buffer.slice(0) };
    }
    const model = JSON.parse(init.body).modelName;
    return { ok: true, status: 200, json: async () => answers[model] };
  });
  adapter.lastModel = 'grok-3';
  await adapter.refresh();
  const last = reports[reports.length - 1];
  assert.equal(last.group, 'real');
  const byId = Object.fromEntries(last.meters.map((m) => [m.id, m]));
  assert.equal(byId['grok-3'].used, 15);
  assert.equal(byId['grok-3'].limit, 30);
  assert.equal(byId['grok-3'].secondary, false);
  assert.equal(byId['grok-4'].used, 0);
  assert.equal(byId['grok-4'].secondary, true); // not the model she's using
  assert.ok(!last.meters.some((m) => /credits/i.test(m.label)), 'a false weekly 0% must not be shown');
});
