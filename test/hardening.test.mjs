import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadBackground, makeStorage } from './chrome-stub.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const AM = (() => {
  const ctx = vm.createContext({ console });
  for (const f of ['src/core/quotas.js', 'src/core/common.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx.AIMeter;
})();
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---------- redaction ----------

test('redact: emails, bearer tokens, JWTs, UUIDs and long opaque strings are masked; normal text is kept', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abc123def456';
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const out = AM.redact(`GET /api/organizations/${uuid}/usage user a.b+c@mail.example Bearer sk-abc123.def ${jwt} ${'x'.repeat(40)}`);
  assert.equal(out.includes(uuid), false);
  assert.equal(/@mail\.example/.test(out), false);
  assert.equal(out.includes('sk-abc123'), false);
  assert.equal(out.includes('eyJ'), false);
  assert.equal(out.includes('x'.repeat(40)), false);
  assert.match(out, /\/api\/organizations\/\[id\]\/usage/);
  assert.equal(AM.redact('five_hour utilization 9% resets in 3h'), 'five_hour utilization 9% resets in 3h');
  assert.equal(AM.redact(null), '');
});

test('diagnostics: stored log lines are redacted again when copied out', () => {
  const text = AM.buildDiagnostics({
    version: '1.0.0', provider: 'claude', host: 'claude.ai', meters: [], now: 0,
    log: [{ t: 0, provider: 'claude', kind: 'response', status: 200, url: 'https://claude.ai/api/organizations/3f2504e0-4f89-41d3-9a0c-0305e82c3301/usage', body: '{"email":"me@x.example"}' }],
  });
  assert.equal(/3f2504e0|me@x\.example/.test(text), false);
});

// ---------- usage report validation ----------

const good = () => ({ type: 'aimeter:usage', provider: 'claude', name: 'Claude', meters: [{ id: 'session', label: 'Session', pct: 12, resetAt: 1e12, source: 'real', secondary: false }], problem: null });

test('validateUsageMessage: a good report passes, rebuilt without unknown fields', () => {
  const r = plain(AM.validateUsageMessage({ ...good(), evil: 1, meters: [{ ...good().meters[0], evil: { a: 1 } }] }));
  assert.equal(r.provider, 'claude');
  assert.equal('evil' in r, false);
  assert.equal('evil' in r.meters[0], false);
  assert.equal(r.problem, null);
  assert.equal(plain(AM.validateUsageMessage({ ...good(), problem: { kind: 'signin', text: '', since: 5 } })).problem.kind, 'signin');
});

test('validateUsageMessage: malformed reports are rejected', () => {
  const m = (over) => ({ ...good(), ...over });
  const bad = [
    null, 'x', [], {}, m({ provider: 'bad provider!' }), m({ provider: '' }), m({ provider: 'a'.repeat(101) }), m({ name: '' }), m({ name: 'n'.repeat(81) }),
    m({ meters: 'nope' }), m({ meters: new Array(61).fill(good().meters[0]) }),
    m({ meters: [{ id: 'a', label: 'b', pct: 'high' }] }), m({ meters: [{ id: 'a', label: 'b', pct: Infinity }] }),
    m({ meters: [{ id: 'a', label: 'b', source: 'hacked' }] }), m({ meters: [{ id: '', label: 'b' }] }), m({ meters: [null] }),
    m({ problem: { kind: 'weird', text: '' } }), m({ problem: 'x' }),
  ];
  for (const b of bad) assert.equal(AM.validateUsageMessage(b), null, JSON.stringify(b)?.slice(0, 80));
});

test('background: a malformed usage report is ignored: nothing stored, no notification', async () => {
  const storage = makeStorage();
  const bg = await loadBackground({ storage });
  await bg.usage('x'.repeat(200), 'N', [{ id: 'a', label: 'b', pct: 99 }]);
  assert.deepEqual(Object.keys(storage.data).filter((k) => k.startsWith('usage.')), []);
  assert.equal(bg.notifications.length, 0);
  await bg.usage('claude', 'Claude', [{ id: 'a', label: 'b', pct: 99, source: 'real' }]);
  assert.ok(storage.data['usage.claude'], 'a good report is still stored');
  assert.equal(bg.notifications.length > 0, true);
});

// ---------- settings sanitising ----------

test('mergeSettings: bad sites and thresholds are dropped, good ones kept', () => {
  const s = AM.mergeSettings({
    thresholds: [50, -5, 'x', 150, 90],
    customSites: [{ host: 'chat.example.com' }, { host: '*.evil.com' }, { host: 'a b.com' }, { host: 'localhost' }, { host: 5 }, null, { host: 'ok-site.ai' }],
  });
  assert.deepEqual(plain(s.thresholds), [50, 90]);
  assert.deepEqual(plain(s.customSites.map((x) => x.host)), ['chat.example.com', 'ok-site.ai']);
  assert.deepEqual(plain(AM.mergeSettings({ thresholds: 'no' }).thresholds), plain(AM.DEFAULT_SETTINGS.thresholds));
  assert.deepEqual(plain(AM.mergeSettings(null).customSites), []);
});
