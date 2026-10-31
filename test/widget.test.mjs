import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWidget } from './dom-stub.mjs';

const hour = 3600e3;
const real = (pct, extra = {}) => ({ id: 'five_hour', label: 'Session (5h)', pct, source: 'real', ...extra });

test('ok: pill shows name and percentage and no reset time; the level glyph is "ok"', () => {
  const w = loadWidget();
  w.update('Claude', [real(32, { resetAt: Date.now() + 13 * hour + 5 * 60e3 })]);
  assert.equal(w.pillText(), 'Claude32%');
  assert.equal(w.dotClass(), 'glyph lv-ok');
});

test('the reset time joins the pill from "close" upwards', () => {
  const w = loadWidget();
  w.update('Claude', [real(80, { resetAt: Date.now() + 13 * hour + 5 * 60e3 })]);
  assert.equal(w.pillText(), 'Claude80%· 13h 5m');
});

test('level glyph follows usage: close from 75, critical from 90, empty at 100 or a banner, unknown without a percentage', () => {
  const w = loadWidget();
  w.update('Claude', [real(74)]);
  assert.equal(w.dotClass(), 'glyph lv-ok');
  w.update('Claude', [real(80)]);
  assert.equal(w.dotClass(), 'glyph lv-close');
  w.update('Claude', [real(95)]);
  assert.equal(w.dotClass(), 'glyph lv-crit');
  w.update('Claude', [real(100)]);
  assert.equal(w.dotClass(), 'glyph lv-empty');
  w.update('Claude', [{ id: 'rl', label: 'Rate limited', pct: 40, source: 'banner' }]);
  assert.equal(w.dotClass(), 'glyph lv-empty', 'a banner hit forces the empty level');
  w.update('ChatGPT', [{ id: 'dr', label: 'Deep Research', remaining: 5, source: 'real' }]);
  assert.equal(w.dotClass(), 'glyph lv-unk');
  assert.equal(w.pillText(), 'ChatGPT5 left');
});

test('estimate: the panel row carries the "estimate" tag and the "next frees in" wording', () => {
  const w = loadWidget();
  w.update('ChatGPT', [{ id: 'gpt', label: 'Messages', used: 3, limit: 160, source: 'estimate', resetAt: Date.now() + 2 * hour }]);
  w.click();
  const panel = w.panelText();
  assert.match(panel, /Messages/);
  assert.match(panel, /3 \/ 160/);
  assert.match(panel, /next frees in 2h/);
  assert.match(panel, /estimate/);
});

test('past reset time reads "reset due" in the panel, not "resets in now"', () => {
  const w = loadWidget();
  w.update('Claude', [real(40, { resetAt: Date.now() - 1000 })]);
  w.click();
  assert.match(w.panelText(), /reset due/);
  assert.doesNotMatch(w.panelText(), /in now/);
});

test('"can\'t read usage": pill says so, dot is the warning colour, panel explains and offers the debug log', () => {
  const w = loadWidget();
  w.AM.copyDiagnostics = async () => true;
  w.update('Gemini', [], {}, null, { kind: 'error', text: 'HTTP 500', since: 0 });
  assert.match(w.pillText(), /can't read usage/);
  assert.equal(w.dotClass(), 'glyph lv-unk');
  w.click();
  assert.match(w.panelText(), /Can't read usage here/);
  assert.match(w.panelText(), /HTTP 500/);
  assert.match(w.panelText(), /Copy debug log/);
});

test('"sign in": pill and panel ask the user to sign in', () => {
  const w = loadWidget();
  w.update('Perplexity', [], {}, null, { kind: 'signin', text: '' });
  assert.match(w.pillText(), /sign in/);
  w.click();
  assert.match(w.panelText(), /Sign in to see limits/);
});

test('a problem next to real numbers adds a problem glyph instead of replacing them', () => {
  const w = loadWidget();
  w.update('Gemini', [real(9)], {}, null, { kind: 'error', text: 'x', since: 0 });
  assert.match(w.pillText(), /9%/);
  assert.equal(w.pill().byClass('glyph').length, 2, 'the level glyph plus the problem glyph');
  assert.equal(w.dotClass(), 'glyph lv-ok');
});

test('no data yet: pill says so and the panel says there is no data', () => {
  const w = loadWidget();
  w.update('Kimi', []);
  assert.equal(w.pillText(), 'Kimino data yet');
  w.click();
  assert.match(w.panelText(), /No usage data yet/);
});

test('chat stats: length and cache countdown on the pill; expired cache is labelled', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)], {}, { tokens: 12000, messages: 8, cachedUntil: Date.now() + 4 * 60e3, nextCost: 900 });
  assert.match(w.pillText(), /12k tok4m/);
  assert.equal(w.pill().byClass('cache').length, 1);
  w.update('Claude', [real(10)], {}, { tokens: 12000, messages: 8, cachedUntil: Date.now() - 1, nextCost: 900 });
  assert.equal(w.pill().byClass('cache').length, 0, 'no cache chip once it has expired');
  w.click();
  assert.match(w.panelText(), /Expired/);
});

test('settings.widget = false removes the pill; turning it back on remounts it', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)]);
  assert.ok(w.host);
  w.update('Claude', [real(10)], { widget: false });
  assert.equal(w.host, null);
  w.update('Claude', [real(10)], { widget: true });
  assert.ok(w.host);
});

test('the pill stays mounted across updates (so Iris is not reset)', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)]);
  const first = w.host;
  w.update('Claude', [real(20)]);
  assert.equal(w.host, first);
  assert.equal(w.document.body.children.length, 1);
});

test('a site that removes the pill from the page gets it back on the next update', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)]);
  w.host.remove();
  assert.equal(w.host, null);
  w.update('Claude', [real(11)]);
  assert.ok(w.host);
});

test('clicking the pill toggles the panel; the panel refreshes in place', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)]);
  assert.equal(w.panelText(), null);
  w.click();
  assert.match(w.panelText(), /10%/);
  w.update('Claude', [real(55)]);
  assert.match(w.panelText(), /55%/);
  w.click();
  assert.equal(w.panelText(), null);
});

test('dragging the pill moves it and remembers the position; a drag is not a click', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)]);
  const p = w.pill();
  p.fire('pointerdown', { clientX: 500, clientY: 500 });
  p.fire('pointermove', { clientX: 450, clientY: 480 });
  p.fire('pointerup', { clientX: 450, clientY: 480 });
  assert.equal(w.panelText(), null, 'a drag does not open the panel');
  const saved = JSON.parse(w.store['aimeter.pos']);
  assert.equal(saved.right, 1280 - 1000 + 50);
  assert.equal(saved.bottom, 800 - 700 + 20);
});

test('a dead extension context (reloaded) stops updating', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)]);
  w.AM.dead = true;
  w.update('Claude', [real(99)]);
  assert.match(w.pillText(), /10%/);
});

// ---- Iris's mood follows usage ----

test('Iris mood by usage: happy under 75, worried 75-89, stressed 90-99, asleep at 100', async () => {
  const w = loadWidget({ pet: true });
  w.update('Claude', [real(10)], { pet: true });
  await w.tick();
  assert.equal(w.pets.length, 1);
  const seen = [];
  for (const pct of [10, 74, 75, 89, 90, 99, 100]) {
    w.update('Claude', [real(pct)], { pet: true });
    seen.push(w.pets[0].moods.at(-1));
  }
  assert.deepEqual(seen, ['happy', 'happy', 'worried', 'worried', 'stressed', 'stressed', 'sleep']);
});

test('Iris with no percentage (counters only) is happy', async () => {
  const w = loadWidget({ pet: true });
  w.update('ChatGPT', [{ id: 'dr', label: 'DR', remaining: 0, source: 'real' }], { pet: true });
  await w.tick();
  w.update('ChatGPT', [{ id: 'dr', label: 'DR', remaining: 0, source: 'real' }], { pet: true });
  assert.equal(w.pets[0].moods.at(-1), 'happy');
});

test('Iris is not loaded on user-added sites, and the panel offers no Iris button there', async () => {
  const w = loadWidget({ pet: true });
  w.AM.siteId = 'site:example.test';
  w.AM.setSetting = () => {};
  w.update('Example', [real(10)], { pet: true });
  await w.tick();
  assert.equal(w.pets.length, 0);
  w.click();
  assert.doesNotMatch(w.panelText(), /Iris/);
});

test('Iris turned off in settings is destroyed; the pill stays', async () => {
  const w = loadWidget({ pet: true });
  w.update('Claude', [real(10)], { pet: true });
  await w.tick();
  const p = w.pets[0];
  w.update('Claude', [real(10)], { pet: false });
  await w.tick();
  assert.ok(w.host);
  // she is destroyed once she has left (leave() is optional on the stub, so destroy runs straight away)
  assert.equal(p.destroyed, true);
});

test('if Iris cannot load, the pill works without her', async () => {
  const w = loadWidget({ pet: true });
  w.AM.loadPet = () => Promise.reject(new Error('blocked'));
  w.AM.createPet = undefined;
  w.update('Claude', [real(10)], { pet: true });
  await w.tick();
  assert.equal(w.pets.length, 0);
  assert.match(w.pillText(), /10%/);
  assert.equal(w.root.byClass('wrap')[0].classList.contains('with-pet'), false);
});

// ---------- accessibility ----------

test('a11y: the pill is a named, focusable button whose label speaks the numbers and the state', () => {
  const w = loadWidget();
  w.update('Claude', [real(32, { resetAt: Date.now() + 3 * hour + 12 * 60e3 })]);
  const pill = w.pill();
  assert.equal(pill.attrs.role, 'button');
  assert.equal(pill.tabIndex, 0);
  assert.equal(pill.attrs['aria-expanded'], 'false');
  assert.match(pill.attrs['aria-label'], /^Claude: 32% used, plenty left, resets in 3h 1\dm\. Open details\.$/);
  w.click();
  assert.equal(pill.attrs['aria-expanded'], 'true');
  assert.match(pill.attrs['aria-label'], /Close details\.$/);
});

test('a11y: Enter and Space open the panel, Escape closes it, other keys do nothing', () => {
  const w = loadWidget();
  w.update('Claude', [real(32)]);
  const pill = w.pill();
  const key = (k, extra = {}) => { const e = { prevented: false }; pill.fire('keydown', { key: k, preventDefault() { e.prevented = true; }, ...extra }); return e; };
  assert.equal(key('Enter').prevented, true);
  assert.ok(w.panelText(), 'Enter opens');
  key('Escape');
  assert.equal(w.panelText(), null, 'Escape closes');
  key(' ');
  assert.ok(w.panelText(), 'Space opens');
  assert.equal(key('a').prevented, false);
  assert.ok(w.panelText(), 'an unrelated key leaves it as it was');
});

test('a11y: panel is a labelled region and each bar is a progressbar with a value and reset text', () => {
  const w = loadWidget();
  w.update('Claude', [real(32, { resetAt: Date.now() + 2 * hour + 5 * 60e3 }), { id: 'dr', label: 'Deep Research', remaining: 5, source: 'real' }]);
  w.click();
  const panel = w.root.byClass('panel')[0];
  assert.equal(panel.attrs.role, 'region');
  assert.equal(panel.attrs['aria-label'], 'Claude usage details');
  const bars = w.root.byClass('bar');
  assert.equal(bars.length, 1, 'a counter with no percentage has no bar');
  assert.equal(bars[0].attrs.role, 'progressbar');
  assert.equal(bars[0].attrs['aria-label'], 'Session (5h)');
  assert.equal(bars[0].attrs['aria-valuenow'], '32');
  assert.match(bars[0].attrs['aria-valuetext'], /^32%, resets in 2h/);
});

test('a11y: purely decorative bits are hidden from screen readers; the problem box is a status', () => {
  const w = loadWidget();
  w.update('Claude', [], {}, null, { kind: 'error', text: 'no usage figures', since: 0 });
  assert.equal(w.pill().byClass('glyph')[0].attrs['aria-hidden'], 'true');
  assert.match(w.pill().attrs['aria-label'], /can't read usage here/);
  w.click();
  assert.equal(w.root.byClass('prob')[0].attrs.role, 'status');
});

// ---------- bar style ----------

test('bar style: a thin full-width bar along the bottom, filled to the percentage, in the usage colour', () => {
  const w = loadWidget();
  w.update('Claude', [real(32, { resetAt: Date.now() + 3 * hour })], { meterStyle: 'bar-bottom' });
  assert.match(w.host.style.cssText, /left:0;right:0;bottom:0/);
  const pill = w.pill();
  assert.ok(pill.classList.contains('edge'));
  const fill = w.root.byClass('fill')[0];
  assert.equal(fill.style.width, '32%');
  assert.ok(fill.classList.contains('f-ok'));
  assert.ok(w.root.byClass('trk')[0].classList.contains('notched'), 'the 75% and 90% notches are on');
  w.update('Claude', [real(95)], { meterStyle: 'bar-bottom' });
  assert.equal(w.root.byClass('fill')[0].style.width, '95%');
  assert.ok(w.root.byClass('fill')[0].classList.contains('f-crit'));
  w.update('Claude', [real(100)], { meterStyle: 'bar-bottom' });
  assert.ok(!w.root.byClass('trk')[0].classList.contains('notched'), 'a full bar has no notches');
  assert.equal(pill.attrs.role, 'button');
  assert.match(w.pill().attrs['aria-label'], /^Headroom: Claude 100% used, limit reached/);
});

test('bar style: along the top it docks to the top edge', () => {
  const w = loadWidget();
  w.update('Claude', [real(10)], { meterStyle: 'bar-top' });
  assert.match(w.host.style.cssText, /left:0;right:0;top:0/);
  assert.ok(w.root.byClass('wrap')[0].classList.contains('top'));
});

test('bar style: a click opens the panel, there is no dragging, no Iris button, and Shift+arrows do nothing', () => {
  const w = loadWidget();
  w.update('Claude', [real(32)], { meterStyle: 'bar-top' });
  const before = w.host.style.cssText;
  const pill = w.pill();
  pill.fire('pointerdown');
  pill.fire('pointermove', { clientX: 300, clientY: 300 });
  pill.fire('pointerup');
  assert.ok(w.panelText(), 'a click (even with a wobble) opens the panel');
  assert.equal(w.host.style.cssText, before, 'the bar never moves');
  assert.equal(w.root.byClass('iris-btn').length, 0, 'Iris is not offered in bar style');
  pill.fire('keydown', { key: 'ArrowLeft', shiftKey: true, preventDefault() {} });
  assert.equal(w.host.style.cssText, before);
});

test('switching the style remounts the meter in place', () => {
  const w = loadWidget();
  w.update('Claude', [real(32)], { meterStyle: 'pill' });
  assert.equal(w.root.byClass('trk').length, 0);
  w.update('Claude', [real(32)], { meterStyle: 'bar-bottom' });
  assert.equal(w.root.byClass('trk').length, 1);
  w.update('Claude', [real(32)], { meterStyle: 'pill' });
  assert.equal(w.root.byClass('trk').length, 0);
  assert.ok(!w.pill().classList.contains('edge'));
});
