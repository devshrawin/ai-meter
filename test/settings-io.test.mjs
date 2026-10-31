import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadBackground } from './chrome-stub.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const AM = (() => {
  const ctx = vm.createContext({ console });
  for (const f of ['src/core/quotas.js', 'src/core/common.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx.AIMeter;
})();
const plain = (v) => JSON.parse(JSON.stringify(v));
const wrap = (settings) => JSON.stringify({ app: 'ai-meter', format: 1, settings });

test('export holds settings only, with a version and a timestamp', () => {
  const file = plain(AM.buildExport({ notify: false, thresholds: [60, 95], usage: { secret: 1 }, 'debug.log': ['x'], customSites: [{ host: 'chat.example.com', limit: 5, windowHours: 2 }] }, '1.0.0', new Date('2026-10-31T10:00:00Z')));
  assert.equal(file.app, 'ai-meter');
  assert.equal(file.version, '1.0.0');
  assert.equal(file.exportedAt, '2026-10-31T10:00:00.000Z');
  assert.equal(file.settings.notify, false);
  assert.deepEqual(file.settings.thresholds, [60, 95]);
  assert.equal('usage' in file.settings, false);
  assert.equal('debug.log' in file.settings, false);
  assert.deepEqual(Object.keys(file.settings).sort(), ['chatStats', 'customSites', 'debug', 'explore', 'irisEnergy', 'notify', 'pet', 'quotas', 'thresholds', 'widget']);
});

test('export then import round-trips the settings', () => {
  const settings = AM.mergeSettings({ notify: false, irisEnergy: 'lively', thresholds: [50, 80], quotas: { gemini: [{ id: 'm', label: 'Prompts', pattern: '.*', limit: 77, windowHours: 5 }] }, customSites: [{ host: 'chat.example.com', limit: 9, windowHours: 3 }] });
  const r = AM.parseImport(JSON.stringify(AM.buildExport(settings, '1.0.0')));
  assert.equal(r.ok, true);
  assert.equal(r.settings.notify, false);
  assert.equal(r.settings.irisEnergy, 'lively');
  assert.deepEqual(plain(r.settings.thresholds), [50, 80]);
  assert.equal(r.settings.quotas.gemini[0].limit, 77);
  assert.deepEqual(plain(r.sites), [{ host: 'chat.example.com', limit: 9, windowHours: 3 }]);
});

test('import rejects things that are not a backup', () => {
  for (const [text, msg] of [
    ['not json', /valid JSON/],
    ['[]', /not an AI Meter backup/],
    ['{"app":"other","settings":{}}', /not an AI Meter backup/],
    ['{"app":"ai-meter"}', /not an AI Meter backup/],
    ['{"app":"ai-meter","settings":[]}', /not an AI Meter backup/],
    [' '.repeat(200001), /too large/],
    [null, /too large/],
  ]) {
    const r = AM.parseImport(text);
    assert.equal(r.ok, false, String(text).slice(0, 30));
    assert.match(r.error, msg);
  }
});

test('import keeps only well-typed values and drops the rest', () => {
  const r = AM.parseImport(wrap({
    widget: 'yes', notify: true, debug: 1, irisEnergy: 'wild', thresholds: [50, -1, 'x', 101, 90],
    quotas: {
      gemini: [
        { id: 'ok', label: 'Prompts', pattern: 'a|b', limit: 10, windowHours: 5 },
        { id: 'bad-regex', label: 'x', pattern: '(', limit: 1, windowHours: 1 },
        { id: 'neg', label: 'x', pattern: '.*', limit: -1, windowHours: 1 },
        { id: 'zero-window', label: 'x', pattern: '.*', limit: 1, windowHours: 0 },
        { id: 'long', label: 'x'.repeat(101), pattern: '.*', limit: 1, windowHours: 1 },
        'junk', null,
      ],
      'bad id!': [], __proto__: [], evil: 'no',
    },
    customSites: [{ host: 'chat.example.com', limit: 'x', windowHours: -3 }, { host: '*.evil.com' }, { host: 'localhost' }, { host: 5 }, null],
    extra: 'dropped',
  }));
  assert.equal(r.ok, true);
  assert.equal('widget' in r.settings, false);
  assert.equal(r.settings.notify, true);
  assert.equal('debug' in r.settings, false);
  assert.equal('irisEnergy' in r.settings, false);
  assert.deepEqual(plain(r.settings.thresholds), [50, 90]);
  assert.deepEqual(plain(r.settings.quotas.gemini.map((x) => x.id)), ['ok']);
  assert.deepEqual(Object.keys(r.settings.quotas), ['gemini']);
  assert.equal('extra' in r.settings, false);
  assert.deepEqual(plain(r.sites), [{ host: 'chat.example.com', limit: 0, windowHours: 24 }]);
});

test('import cannot pollute prototypes', () => {
  const r = AM.parseImport('{"app":"ai-meter","settings":{"quotas":{"__proto__":[{"id":"a","label":"b","pattern":".*","limit":1,"windowHours":1}],"constructor":[]}}}');
  assert.equal(r.ok, true);
  assert.equal({}.limit, undefined);
  assert.equal(Object.keys(r.settings.quotas).includes('__proto__'), false);
  assert.equal(r.settings.quotas.limit, undefined);
  assert.deepEqual(Object.keys(r.settings.quotas), ['constructor']);
});

test('first install opens the welcome page; an update or browser update does not', async () => {
  const bg = await loadBackground();
  const fire = async (details) => { for (const fn of bg.listeners.installed) await fn(details); await bg.settle(); };
  await fire({ reason: 'update' });
  await fire({ reason: 'chrome_update' });
  assert.equal(bg.tabsCreated.length, 0);
  await fire({ reason: 'install' });
  assert.equal(bg.tabsCreated.length, 1);
  assert.match(bg.tabsCreated[0].url, /src\/welcome\/welcome\.html$/);
});
