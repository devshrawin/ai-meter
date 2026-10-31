import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAdapter, json } from './harness.mjs';

const settle = () => new Promise((r) => setTimeout(r, 20));

// ---------- the shared logic (item 4) ----------

test("a definite sign-in problem shows at once; an error only after it has lasted a while", () => {
  const { AM } = loadAdapter('src/adapters/gemini.js');
  const now = 1_000_000;
  assert.equal(AM.problemVisible({ kind: 'signin', since: now }, now), true);
  assert.equal(AM.problemVisible({ kind: 'error', since: now }, now + 5000), false, 'a transient error must not flash a warning');
  assert.equal(AM.problemVisible({ kind: 'error', since: now }, now + AM.PROBLEM_DELAY_MS), true);
  assert.equal(AM.problemVisible(null, now), false);
});

test('the warning is hidden whenever real numbers are being shown', () => {
  const { AM } = loadAdapter('src/adapters/gemini.js');
  const p = { kind: 'error', text: 'x', since: 0 };
  assert.equal(AM.problemToShow(p, [], 1e9), p);
  assert.equal(AM.problemToShow(p, [{ source: 'estimate' }], 1e9), p, 'estimates are not proof the usage path works');
  assert.equal(AM.problemToShow(p, [{ source: 'real', pct: 3 }], 1e9), null);
});

test("wording: sign-in vs can't read usage here", () => {
  const { AM } = loadAdapter('src/adapters/gemini.js');
  assert.equal(AM.describeProblem({ kind: 'signin' }).title, 'Sign in to see limits');
  const d = AM.describeProblem({ kind: 'error', text: 'Usage request failed: HTTP 500' });
  assert.equal(d.title, "Can't read usage here");
  assert.match(d.detail, /HTTP 500/);
});

test('error text keeps the status but drops the URL (it can hold ids)', () => {
  const { AM } = loadAdapter('src/adapters/gemini.js');
  assert.equal(AM.errText(new Error('401 /api/organizations/abc-123/usage')), 'HTTP 401');
  assert.equal(AM.errIsAuth(new Error('403 /x')), true);
  assert.equal(AM.errIsAuth(new Error('500 /x')), false);
  assert.equal(AM.errText(new Error('Failed to fetch')), 'Failed to fetch');
});

test('the copy-debug-log text has the provider, the problem, the meters and only that provider\'s log', () => {
  const { AM } = loadAdapter('src/adapters/gemini.js');
  const text = AM.buildDiagnostics({
    version: '0.9.0', provider: 'gemini', host: 'gemini.google.com', now: Date.UTC(2026, 9, 28, 10, 0, 0),
    problem: { kind: 'error', text: 'Usage request failed: HTTP 500' },
    meters: [{ label: 'Session (5h)', pct: 9, source: 'estimate' }],
    log: [
      { t: Date.UTC(2026, 9, 28, 9, 59, 0), provider: 'gemini', kind: 'note', body: 'Gemini usage RPC failed: 500' },
      { t: Date.UTC(2026, 9, 28, 9, 58, 0), provider: 'grok', kind: 'note', body: 'should not appear' },
    ],
  });
  assert.match(text, /Headroom 0\.9\.0 \| gemini \| gemini\.google\.com/);
  assert.match(text, /Problem: error: Usage request failed: HTTP 500/);
  assert.match(text, /Session \(5h\) 9% \[estimate\]/);
  assert.match(text, /Gemini usage RPC failed: 500/);
  assert.doesNotMatch(text, /should not appear/);
  const none = AM.buildDiagnostics({ version: '0.9.0', provider: 'gemini', log: [] });
  assert.match(none, /Tick Debug in Settings/);
});

// ---------- adapters report a problem instead of failing silently (item 4) ----------

test('Gemini: a failed usage call becomes a visible problem', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/gemini.js', {
    html: '"SNlM0e":"tok" "cfb2h":"bl" "FdrFJe":"sid"',
    fetch: async () => json(500, {}),
  });
  await settle();
  problems.length = 0;
  await adapter.refresh();
  assert.ok(problems.some((p) => p.kind === 'error' && /HTTP 500/.test(p.text)), JSON.stringify(problems));
});

test('Gemini: missing page parameters become a problem, not silence', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/gemini.js', { html: '' });
  await settle();
  problems.length = 0;
  await adapter.refresh();
  assert.ok(problems.some((p) => p.kind === 'error'));
});

test('Gemini: a response the parser cannot read becomes a problem', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/gemini.js', { html: '' });
  problems.length = 0;
  adapter.parse(")]}'\n\n5\n[[]]");
  assert.ok(problems.some((p) => p.kind === 'error' && /Could not read usage/.test(p.text)));
});

test('Grok: signed out (401 on the limits call) is a sign-in problem, not a made-up number', async () => {
  const { adapter, problems, reports } = loadAdapter('src/adapters/grok.js', {
    fetch: async (url) => (String(url).includes('rate-limits') ? json(401, {}) : { ok: true, headers: { get: () => '16' }, arrayBuffer: async () => new ArrayBuffer(0) }),
  });
  await adapter.refreshLimits();
  assert.ok(problems.some((p) => p.kind === 'signin'));
  assert.ok(!reports.some((r) => r.meters.length && r.meters.some((m) => m.limit)), 'no meters from a failed call');
});

test('Grok: a limits response without counters is an error problem', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/grok.js', { fetch: async () => json(200, { windowSizeSeconds: 86400 }) });
  await adapter.refreshLimits();
  assert.ok(problems.some((p) => p.kind === 'error'));
});

test('Claude: a 401 on the usage call is a sign-in problem', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/claude.js', { cookie: 'lastActiveOrg=org-1', pathname: '/', fetch: async () => json(401, {}) });
  await settle();
  problems.length = 0;
  await adapter.refresh();
  assert.ok(problems.some((p) => p.kind === 'signin'), JSON.stringify(problems));
});

test('Kimi: no readable sign-in cookie is reported', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/kimi.js', { cookie: '' });
  problems.length = 0;
  await adapter.refresh();
  assert.ok(problems.some((p) => p.kind === 'error' && /sign-in/i.test(p.text)));
});

// ---------- Perplexity signed out (item 8) ----------

const limitsBody = { remaining_pro: 0, remaining_research: 0, remaining_labs: 0, remaining_agentic_research: 0 };

test('Perplexity signed out: says "sign in", never "0 left"', async () => {
  const { adapter, problems, reports } = loadAdapter('src/adapters/perplexity.js', {
    fetch: async (url) => (String(url).includes('/api/auth/session') ? json(200, {}) : json(200, limitsBody)),
  });
  await settle();
  problems.length = 0;
  reports.length = 0;
  await adapter.refresh();
  assert.ok(problems.some((p) => p.kind === 'signin'), JSON.stringify(problems));
  assert.ok(reports.every((r) => !r.meters.length), 'no zero-valued meters while signed out');
  // the page's own limits response arriving while signed out must not show 0 left either
  reports.length = 0;
  adapter.parse(limitsBody);
  assert.equal(reports.length, 0);
});

test('Perplexity signed in: real counters are reported and no problem is raised', async () => {
  const { adapter, problems, reports } = loadAdapter('src/adapters/perplexity.js', {
    fetch: async (url) => (String(url).includes('/api/auth/session') ? json(200, { user: { id: 'u' } }) : json(200, { remaining_pro: 297, remaining_research: 4 })),
  });
  await settle();
  problems.length = 0;
  reports.length = 0;
  await adapter.refresh();
  assert.deepEqual(problems, []);
  const real = reports.find((r) => r.group === 'real' && r.meters.length);
  assert.ok(real, 'a real meter group was reported');
  assert.ok(real.meters.some((m) => m.remaining === 297));
});

test('Perplexity: if the session check itself fails it falls back to the limits call, not a false sign-in', async () => {
  const { adapter, problems } = loadAdapter('src/adapters/perplexity.js', {
    fetch: async (url) => (String(url).includes('/api/auth/session') ? json(500, {}) : json(200, { remaining_pro: 5 })),
  });
  await settle();
  problems.length = 0;
  await adapter.refresh();
  assert.ok(!problems.some((p) => p.kind === 'signin'));
});
