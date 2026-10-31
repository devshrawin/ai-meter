import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// ---------- the validator (item 6) ----------

const AM = (() => {
  const ctx = vm.createContext({ console });
  for (const f of ['src/core/quotas.js', 'src/core/common.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx.AIMeter;
})();
const plain = (v) => JSON.parse(JSON.stringify(v));

test('validator: well-formed messages pass, rebuilt field by field', () => {
  assert.deepEqual(plain(AM.validateInjectMessage({ kind: 'pong', fetchHooked: true, extra: 'dropped' })), { kind: 'pong', fetchHooked: true });
  assert.deepEqual(plain(AM.validateInjectMessage({ kind: 'request', url: 'https://x.test/a', method: 'POST', body: '{"a":1}', evil: 1 })),
    { kind: 'request', url: 'https://x.test/a', method: 'POST', body: '{"a":1}' });
  const r = plain(AM.validateInjectMessage({ kind: 'response', url: 'wss://x.test/ws', method: 'GET', status: 200, body: 'ok', unexpected: {} }));
  assert.equal(r.status, 200);
  assert.equal(r.binary, false);
  assert.equal('unexpected' in r, false);
});

test('validator: junk, wrong types, bad schemes and oversize are rejected', () => {
  const bad = [
    null, undefined, 'str', 42, [], {}, { kind: 'nope' },
    { kind: 'pong', fetchHooked: 'yes' },
    { kind: 'request', url: 'javascript:alert(1)', method: 'GET' },
    { kind: 'request', url: 'https://x.test/', method: 'GET', body: 123 },
    { kind: 'request', url: 'https://x.test/', method: 'POST', body: 'x'.repeat(20001) },
    { kind: 'request', url: 'https://x.test/' + 'a'.repeat(4000), method: 'GET' },
    { kind: 'response', url: 'https://x.test/', method: 'GET', status: 999, body: '' },
    { kind: 'response', url: 'https://x.test/', method: 'GET', status: '200', body: '' },
    { kind: 'response', url: 'https://x.test/', method: 'GET', status: 200, body: { usage: 99 } },
    { kind: 'response', url: 'https://x.test/', method: 'GET', status: 200, body: 'x'.repeat(270001) },
    { kind: 'response', url: 'https://x.test/', method: 'GET', status: 200, body: '', binary: 'true' },
  ];
  for (const b of bad) assert.equal(AM.validateInjectMessage(b), null, JSON.stringify(b)?.slice(0, 80));
});

// ---------- inject.js in a simulated page (item 6) ----------

function loadInject() {
  const handlers = [];
  const windowPosts = [];
  const sandbox = {
    console, URL, URLSearchParams, btoa,
    setInterval: () => 0,
    location: { origin: 'https://example.test', href: 'https://example.test/', hostname: 'example.test' },
    addEventListener: (type, fn, capture) => handlers.push({ type, fn, capture }),
    postMessage: (m, origin, ports) => windowPosts.push({ m, origin, ports }),
    Request: class {},
    fetch: async () => ({ status: 200, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => '{"ok":1}', arrayBuffer: async () => new ArrayBuffer(0) }),
    XMLHttpRequest: function () {},
    WebSocket: function () {},
  };
  sandbox.XMLHttpRequest.prototype.open = function () {};
  sandbox.XMLHttpRequest.prototype.send = function () {};
  sandbox.WebSocket.prototype.send = function () {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('src/inject.js'), sandbox, { filename: 'inject.js' });
  const fakePort = () => ({ sent: [], postMessage(d) { this.sent.push(d); }, onmessage: null });
  const hello = (port, over = {}) => {
    const ev = { source: vm.runInContext('window', sandbox), origin: 'https://example.test', data: { source: 'aimeter-content', kind: 'hello' }, ports: port ? [port] : [], swallowed: false, stopImmediatePropagation() { this.swallowed = true; }, ...over };
    handlers.filter((h) => h.type === 'message').forEach((h) => h.fn(ev));
    return ev;
  };
  return { sandbox, handlers, windowPosts, fakePort, hello };
}

test('inject.js: registers its listener in the capture phase, announces itself, and posts no data on the window', async () => {
  const { sandbox, handlers, windowPosts } = loadInject();
  assert.ok(handlers.some((h) => h.type === 'message' && h.capture === true), 'capture-phase message listener');
  await sandbox.fetch('https://example.test/api/thing', { method: 'POST', body: '{"model":"m"}' });
  assert.ok(windowPosts.every((p) => p.m.kind === 'ready'), 'nothing but the public ready ping goes over window.postMessage');
});

test('inject.js: queued messages flush to the private port on hello, and the hello is swallowed', async () => {
  const { sandbox, fakePort, hello, windowPosts } = loadInject();
  await sandbox.fetch('https://example.test/api/send', { method: 'POST', body: '{"model":"m"}' });
  const port = fakePort();
  const ev = hello(port);
  assert.equal(ev.swallowed, true, 'page scripts must not see the hello (or its port)');
  assert.ok(port.sent.some((d) => d.kind === 'request' && d.body === '{"model":"m"}'));
  assert.ok(port.sent.some((d) => d.kind === 'pong'));
  assert.ok(windowPosts.every((p) => p.m.kind === 'ready'));
});

test('inject.js: a second hello (a page trying to take the channel over) is swallowed and ignored', async () => {
  const { sandbox, fakePort, hello } = loadInject();
  const mine = fakePort();
  const hostile = fakePort();
  hello(mine);
  const ev = hello(hostile);
  assert.equal(ev.swallowed, true);
  await sandbox.fetch('https://example.test/api/x', { method: 'POST', body: '{"a":1}' });
  assert.ok(mine.sent.some((d) => d.kind === 'request' && d.url.endsWith('/api/x')));
  assert.equal(hostile.sent.length, 0, 'the hostile port receives nothing');
});

test('inject.js: a hello from another origin is swallowed and does not set the port', async () => {
  const { sandbox, fakePort, hello } = loadInject();
  const wrong = fakePort();
  const ev = hello(wrong, { origin: 'https://evil.test' });
  assert.equal(ev.swallowed, true);
  await sandbox.fetch('https://example.test/api/x', { method: 'POST', body: '{"a":1}' });
  assert.equal(wrong.sent.length, 0);
});

test('inject.js: bodies of sign-in / session / token requests are never forwarded', async () => {
  const { sandbox, fakePort, hello } = loadInject();
  const port = fakePort();
  hello(port);
  await sandbox.fetch('https://example.test/api/auth/login', { method: 'POST', body: '{"password":"hunter2"}' });
  await sandbox.fetch('https://example.test/api/session', { method: 'POST', body: '{"token":"secret"}' });
  await sandbox.fetch('https://example.test/api/chat', { method: 'POST', body: '{"model":"m"}' });
  const reqs = port.sent.filter((d) => d.kind === 'request');
  const login = reqs.find((d) => d.url.includes('/auth/login'));
  const sess = reqs.find((d) => d.url.includes('/session'));
  const chat = reqs.find((d) => d.url.includes('/api/chat'));
  assert.equal(login.body, null);
  assert.equal(sess.body, null);
  assert.equal(chat.body, '{"model":"m"}');
  assert.ok(!JSON.stringify(port.sent).includes('hunter2'));
});

test('inject.js: everything it sends passes the content script validator', async () => {
  const { sandbox, fakePort, hello } = loadInject();
  const port = fakePort();
  hello(port);
  await sandbox.fetch('https://example.test/api/usage', { method: 'GET' });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(port.sent.length >= 2);
  for (const d of port.sent) assert.ok(AM.validateInjectMessage(d), JSON.stringify(d).slice(0, 120));
});

test('inject.js: login, sign-up, password, payment and OAuth requests never forward a body (also on sites the user adds)', async () => {
  const { sandbox, fakePort, hello } = loadInject();
  const port = fakePort();
  hello(port);
  const urls = ['/login', '/api/v1/sign-in', '/signup', '/users/password/reset', '/oauth/authorize', '/checkout/pay', '/api/payment/intent', '/api/mfa/verify', '/account/2fa'];
  for (const u of urls) await sandbox.fetch('https://example.test' + u, { method: 'POST', body: '{"password":"hunter2","card":"4111111111111111"}' });
  const bodies = port.sent.filter((d) => d.kind === 'request');
  assert.equal(bodies.length, urls.length);
  assert.ok(bodies.every((d) => d.body == null), 'no body forwarded: ' + JSON.stringify(bodies.map((d) => d.url)));
});

test('inject.js: on a forwarded body, secret-looking fields are masked and the rest is untouched', async () => {
  const { sandbox, fakePort, hello } = loadInject();
  const port = fakePort();
  hello(port);
  await sandbox.fetch('https://example.test/api/chat', { method: 'POST', body: JSON.stringify({ model: 'gpt-x', api_key: 'sk-live-123', nested: { access_token: 'tok-9' }, prompt: 'hello' }) });
  await sandbox.fetch('https://example.test/api/form', { method: 'POST', body: 'model=m&passwd=abc&otp=123456&note=hi' });
  const [a, b] = port.sent.filter((d) => d.kind === 'request').map((d) => d.body);
  assert.equal(/sk-live-123|tok-9/.test(a), false);
  assert.match(a, /"model":"gpt-x"/);
  assert.match(a, /hello/);
  assert.equal(/abc|123456/.test(b), false);
  assert.match(b, /model=m/);
  assert.match(b, /note=hi/);
});
