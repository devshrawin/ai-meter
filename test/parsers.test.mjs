import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ console, atob, btoa, URL, URLSearchParams });
for (const f of ['src/core/quotas.js', 'src/core/common.js', 'src/core/parsers.js', 'src/adapters/generic.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
}
const AM = ctx.AIMeter;
const plain = (v) => JSON.parse(JSON.stringify(v));
const NOW = Date.UTC(2026, 8, 26, 10, 0, 0);

test('ChatGPT wham/usage: windows classified by span, not slot', () => {
  const ms = plain(AM.parseChatGPTUsage({
    plan_type: 'plus',
    rate_limit: {
      primary_window: { used_percent: 12, reset_at: 1790500000, limit_window_seconds: 604800 },
      secondary_window: null,
    },
    additional_rate_limits: [
      { limit_name: 'GPT-5.3-Codex-Spark', metered_feature: 'codex_x', rate_limit: { primary_window: { used_percent: 40, reset_at: 1790400000, limit_window_seconds: 18000 } } },
    ],
    credits: { balance: '0', unlimited: false },
  }));
  assert.deepEqual(ms.map((m) => [m.label, m.pct]), [['Codex · Weekly', 12], ['GPT-5.3-Codex-Spark', 40]]);
  assert.equal(ms[0].resetAt, 1790500000000);
});

test('ChatGPT wham/usage: 5h + 30-day windows and credits', () => {
  const ms = plain(AM.parseChatGPTUsage({
    rate_limit: {
      primary_window: { used_percent: 3, reset_at: 1790420000, limit_window_seconds: 18000 },
      secondary_window: { used_percent: 55, reset_at: 1792000000, limit_window_seconds: 2592000 },
    },
    credits: { balance: 125, unlimited: false },
  }));
  assert.deepEqual(ms.map((m) => m.label), ['Codex · 5h', 'Codex · Monthly', 'Credits']);
  assert.equal(ms[2].remaining, 125);
  assert.equal(AM.parseChatGPTUsage(null).length, 0);
});

test('Gemini jSf9Qc batchexecute payload', () => {
  const inner = JSON.stringify([1, [[80, 0.2, 1, [[1790500000, 0]]], [400, 0.35, 2, [[1791000000, 500000000]]]]]);
  const text = `)]}'\n\n123\n${JSON.stringify([['wrb.fr', 'jSf9Qc', inner, null, null, null, 'generic']])}\n25\n[["e",4,null,null,123]]\n`;
  const { meters, error } = plain(AM.parseGeminiUsage(text));
  assert.equal(error, null);
  assert.deepEqual(meters.map((m) => [m.label, m.pct]), [['Session (5h)', 20], ['Weekly', 35]]);
  assert.equal(meters[1].resetAt, 1791000000500);
});

test('Gemini: rpc error and garbage are reported, not thrown', () => {
  const err = AM.parseGeminiUsage(`)]}'\n[["er",null,null,null,null,401]]`);
  assert.equal(err.error, 'rpc error 401');
  assert.equal(AM.parseGeminiUsage('<html>nope').meters.length, 0);
});

test('Kimi GetSubscription balances', () => {
  const ms = plain(AM.parseKimiUsage({
    subscription: { goods: { title: 'Moderato' } },
    balances: [{ feature: 'FEATURE_OMNI', amountUsedRatio: 0.25, expireTime: '2026-10-01T00:00:00Z' }, { feature: 'FEATURE_X' }],
  }));
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].label, ms[0].pct, ms[0].resetAt], ['Credits', 25, Date.UTC(2026, 9, 1)]);
});

// --- Grok protobuf helpers ---
const varint = (n) => {
  const out = [];
  while (n >= 128) { out.push((n % 128) | 0x80); n = Math.floor(n / 128); }
  out.push(n);
  return out;
};
const tag = (field, wire) => varint(field * 8 + wire);
const lenField = (field, bytes) => [...tag(field, 2), ...varint(bytes.length), ...bytes];
const f32 = (field, v) => {
  const b = Buffer.alloc(4);
  b.writeFloatLE(v);
  return [...tag(field, 5), ...b];
};
const frame = (flags, bytes) => {
  const h = Buffer.alloc(5);
  h[0] = flags;
  h.writeUInt32BE(bytes.length, 1);
  return [...h, ...bytes];
};

test('Grok credits: percent + reset from gRPC-web frames', () => {
  const reset = Math.floor(NOW / 1000) + 3 * 86400;
  const msg = lenField(1, [...f32(1, 37.5), ...lenField(5, [...tag(1, 0), ...varint(reset)])]);
  const trailer = [...Buffer.from('grpc-status:0\r\ngrpc-message:\r\n')];
  const bytes = new Uint8Array([...frame(0, msg), ...frame(0x80, trailer)]);
  const { meters, error } = plain(AM.parseGrokCredits(bytes, NOW));
  assert.equal(error, null);
  assert.equal(meters[0].pct, 37.5);
  assert.equal(meters[0].resetAt, reset * 1000);
});

test('Grok credits: raw (unframed) protobuf and grpc error trailer', () => {
  const raw = new Uint8Array(lenField(1, f32(1, 5)));
  assert.equal(AM.parseGrokCredits(raw, NOW).meters[0].pct, 5);
  const bad = new Uint8Array(frame(0x80, [...Buffer.from('grpc-status:16\r\ngrpc-message:no credentials\r\n')]));
  assert.match(AM.parseGrokCredits(bad, NOW).error, /grpc-status:16/);
});

test('b64ToBytes round-trips', () => {
  assert.deepEqual([...AM.b64ToBytes(Buffer.from([0, 1, 250, 255]).toString('base64'))], [0, 1, 250, 255]);
});

test('looksLikeSend heuristic', () => {
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'hello there friend' }], model: 'x' });
  assert.equal(AM.looksLikeSend({ method: 'POST', url: 'https://a.ai/api/chat/completions', body }), true);
  assert.equal(AM.looksLikeSend({ method: 'POST', url: 'https://a.ai/api/conversation/title', body }), false);
  assert.equal(AM.looksLikeSend({ method: 'GET', url: 'https://a.ai/api/chat', body }), false);
  assert.equal(AM.looksLikeSend({ method: 'POST', url: 'https://a.ai/api/chat', body: '{}' }), false);
  assert.equal(AM.looksLikeSend({ method: 'WS', url: 'wss://a.ai/ws', body: '{"type":"ping","id":1}' }), false);
  assert.equal(AM.looksLikeSend({ method: 'WS', url: 'wss://a.ai/ws', body: '{"text":"what is up"}' }), true);
});

test('adapterFor: named sites, custom sites, unknown', () => {
  const s = AM.mergeSettings({ customSites: [{ host: 'chat.example.com', limit: 40, windowHours: 12 }] });
  assert.equal(AM.adapterFor('chat.deepseek.com', s).id, 'deepseek');
  assert.equal(AM.adapterFor('www.poe.com', s).id, 'poe');
  assert.equal(AM.adapterFor('chat.example.com', s).id, 'site:chat.example.com');
  assert.equal(AM.adapterFor('news.com', s), null);
  assert.equal(AM.providerForHost('chat.example.com', s).name, 'chat.example.com');
  assert.deepEqual(plain(AM.defaultQuotasFor('site:chat.example.com', s)).map((r) => [r.limit, r.windowHours]), [[40, 12]]);
});

test('manifest content script bundle matches CONTENT_BUNDLE and every file exists', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const iso = manifest.content_scripts.find((c) => !c.world);
  assert.deepEqual(iso.js, [...AM.CONTENT_BUNDLE]);
  for (const f of iso.js) readFileSync(new URL('../' + f, import.meta.url));
  const hosts = manifest.host_permissions.map((h) => new URL(h.replace('/*', '/')).hostname);
  for (const p of AM.PROVIDERS) {
    for (const h of p.hosts) assert.ok(hosts.some((x) => x === h || x.endsWith('.' + h)), `host permission for ${h}`);
  }
});
