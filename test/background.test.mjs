import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBackground, makeStorage } from './chrome-stub.mjs';

const meter = (pct, extra = {}) => ({ id: 'five_hour', label: 'Session (5h)', pct, source: 'real', ...extra });
const titles = (bg) => bg.notifications.map((n) => n.title);
const hour = 3600e3;

test('thresholds: 75, 90 and 100 each notify once as usage climbs', async () => {
  const bg = loadBackground();
  for (const pct of [10, 50, 76, 80, 91, 95, 100, 100]) await bg.usage('claude', 'Claude', [meter(pct)]);
  assert.deepEqual(titles(bg), ['Claude: Session (5h) at 76%', 'Claude: Session (5h) at 91%', 'Claude: Session (5h) at 100%']);
  assert.equal(bg.notifications[2].priority, 2, '100% is high priority');
  assert.equal(bg.notifications[0].priority, 1);
});

test('a jump across several thresholds notifies once, for the highest', async () => {
  const bg = loadBackground();
  await bg.usage('claude', 'Claude', [meter(5)]);
  await bg.usage('claude', 'Claude', [meter(97)]);
  assert.equal(bg.notifications.length, 1);
  assert.match(bg.notifications[0].title, /97%/);
});

test('usage that falls back below a threshold re-arms it', async () => {
  const bg = loadBackground();
  await bg.usage('claude', 'Claude', [meter(80)]);
  await bg.usage('claude', 'Claude', [meter(10)]);
  await bg.usage('claude', 'Claude', [meter(80)]);
  assert.equal(bg.notifications.length, 2);
});

test('each provider and meter is tracked separately', async () => {
  const bg = loadBackground();
  await bg.usage('claude', 'Claude', [meter(80), meter(80, { id: 'seven_day', label: 'Weekly' })]);
  await bg.usage('gemini', 'Gemini', [meter(80)]);
  assert.equal(bg.notifications.length, 3);
});

test('no duplicate notification after the service worker restarts', async () => {
  const storage = makeStorage();
  const first = loadBackground({ storage });
  await first.usage('claude', 'Claude', [meter(80)]);
  assert.equal(first.notifications.length, 1);
  const second = loadBackground({ storage }); // MV3 killed the worker and started it again; state lives in storage
  await second.usage('claude', 'Claude', [meter(82)]);
  assert.equal(second.notifications.length, 0);
  await second.usage('claude', 'Claude', [meter(93)]);
  assert.equal(second.notifications.length, 1, 'a higher threshold still notifies');
});

test('two usage messages arriving together still notify once (no read-modify-write race)', async () => {
  const bg = loadBackground();
  await bg.usageTogether('claude', 'Claude', [meter(80)]);
  assert.equal(bg.notifications.length, 1, JSON.stringify(titles(bg)));
});

test('settings: notify off sends nothing; custom thresholds are honoured', async () => {
  const off = loadBackground({ storage: makeStorage({ settings: { notify: false } }) });
  await off.usage('claude', 'Claude', [meter(99)]);
  assert.equal(off.notifications.length, 0);
  const custom = loadBackground({ storage: makeStorage({ settings: { thresholds: [50] } }) });
  await custom.usage('claude', 'Claude', [meter(60)]);
  await custom.usage('claude', 'Claude', [meter(70)]);
  assert.equal(custom.notifications.length, 1);
});

test('meters without a percentage never notify', async () => {
  const bg = loadBackground();
  await bg.usage('chatgpt', 'ChatGPT', [{ id: 'dr', label: 'Deep Research', remaining: 0, source: 'real' }]);
  assert.equal(bg.notifications.length, 0);
});

test('a reset alarm is scheduled at 90%+ with a future reset, and not otherwise', async () => {
  const bg = loadBackground();
  const soon = Date.now() + hour;
  await bg.usage('claude', 'Claude', [meter(95, { resetAt: soon })]);
  assert.equal(bg.alarms.length, 1);
  assert.equal(bg.alarms[0].when, soon);
  assert.match(bg.alarms[0].name, /^reset\|claude\|five_hour\|/);
  await bg.usage('gemini', 'Gemini', [meter(50, { resetAt: soon })]);
  await bg.usage('grok', 'Grok', [meter(95, { resetAt: Date.now() + 1000 })]);
  assert.equal(bg.alarms.length, 1, 'below 90% or about to reset: no alarm');
});

test('reset alarm: notifies "has reset" and re-arms the thresholds', async () => {
  const bg = loadBackground();
  await bg.usage('claude', 'Claude', [meter(95, { resetAt: Date.now() + hour })]);
  bg.notifications.length = 0;
  await bg.fireAlarm(bg.alarms[0].name);
  assert.deepEqual(titles(bg), ['Claude: Session (5h) has reset']);
  assert.deepEqual(bg.storage.data.notified, {});
  await bg.usage('claude', 'Claude', [meter(80)]);
  assert.equal(bg.notifications.length, 2, 'the 75% warning can fire again after the reset');
});

test('reset alarm respects notify off, and still re-arms', async () => {
  const bg = loadBackground();
  await bg.usage('claude', 'Claude', [meter(95, { resetAt: Date.now() + hour })]);
  const name = bg.alarms[0].name;
  bg.storage.data.settings = { notify: false };
  bg.notifications.length = 0;
  await bg.fireAlarm(name);
  assert.equal(bg.notifications.length, 0);
  assert.deepEqual(bg.storage.data.notified, {});
});

test('reset alarm survives a "|" in the provider name or meter label', async () => {
  const bg = loadBackground();
  await bg.usage('site:x.test', 'My | Site', [meter(95, { label: 'a|b', resetAt: Date.now() + hour })]);
  bg.notifications.length = 0;
  await bg.fireAlarm(bg.alarms[0].name);
  assert.deepEqual(titles(bg), ['My | Site: a|b has reset']);
});

test('badge shows the primary meter percentage with its level colour', async () => {
  const bg = loadBackground();
  await bg.usage('claude', 'Claude', [meter(96)]);
  assert.ok(bg.badges.some((b) => b.text === '96'));
  assert.ok(bg.badges.some((b) => b.color === '#dc2626'));
  await bg.usage('claude', 'Claude', []);
  assert.ok(bg.badges.some((b) => b.text === ''));
});

test('usage is stored per provider with its problem state', async () => {
  const bg = loadBackground();
  await bg.usage('kimi', 'Kimi', [], { kind: 'signin', text: 'x' });
  const e = bg.storage.data['usage.kimi'];
  assert.equal(e.name, 'Kimi');
  assert.equal(e.problem.kind, 'signin');
  assert.ok(e.updatedAt > 0);
});

test('custom sites: content scripts are re-registered only where permission is still granted', async () => {
  const storage = makeStorage({ settings: { customSites: [{ host: 'a.test' }, { host: 'b.test' }] } });
  const bg = loadBackground({ storage, contains: async ({ origins }) => origins[0].includes('a.test') });
  bg.listeners.startup.forEach((fn) => fn());
  await bg.settle();
  assert.ok(bg.registeredScripts.length > 0);
  assert.ok(bg.registeredScripts.every((s) => s.matches.every((m) => m.includes('a.test'))));
});

test('loadPet is refused without a sender tab and injects the Iris bundle otherwise', async () => {
  const bg = loadBackground();
  const replies = [];
  const [fn] = bg.listeners.message;
  assert.equal(fn({ type: 'aimeter:loadPet' }, {}, (r) => replies.push(r)), undefined);
  assert.equal(replies[0].ok, false);
  assert.equal(fn({ type: 'aimeter:loadPet' }, { tab: { id: 3 }, frameId: 0 }, (r) => replies.push(r)), true);
  await bg.settle();
  assert.equal(replies[1].ok, true);
});
