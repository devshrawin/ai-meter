import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const ctx = vm.createContext({ console });
vm.runInContext(readFileSync(new URL('../src/core/quotas.js', import.meta.url), 'utf8'), ctx, { filename: 'quotas.js' });
const AM = ctx.AIMeter;

const covers = (patterns, host) => patterns.some((p) => {
  const m = p.match(/^https:\/\/([^/]+)\/\*$/);
  return m && (m[1] === host || m[1] === 'www.' + host);
});

test('every provider host is granted and has content scripts in the manifest', () => {
  const content = manifest.content_scripts.flatMap((c) => c.matches);
  for (const p of AM.PROVIDERS) {
    for (const h of p.hosts) {
      assert.ok(covers(manifest.host_permissions, h), `${p.id}: ${h} missing from host_permissions`);
      assert.ok(covers(content, h), `${p.id}: ${h} missing from content_scripts matches`);
    }
  }
});

test('Copilot is matched on its current address (copilot.microsoft.com now redirects to copilot.com)', () => {
  assert.equal(AM.providerForHost('copilot.com').id, 'copilot');
  assert.equal(AM.providerForHost('www.copilot.com').id, 'copilot');
  assert.equal(AM.providerForHost('copilot.microsoft.com').id, 'copilot');
});

test('web_accessible_resources are limited to the provider hosts (no https://*/*)', () => {
  const war = manifest.web_accessible_resources.flatMap((r) => r.matches);
  assert.ok(war.length > 0);
  assert.ok(!war.includes('https://*/*'), 'Iris sprites must not be readable by every site');
  for (const m of war) assert.ok(manifest.host_permissions.includes(m), `${m} is not a provider host`);
  for (const p of AM.PROVIDERS) for (const h of p.hosts) assert.ok(covers(war, h), `${p.id}: ${h} cannot load Iris sprites`);
});

test("Iris's engine is not in the always-loaded content scripts, and is injected on demand", () => {
  const loaded = manifest.content_scripts.flatMap((c) => c.js);
  assert.ok(AM.PET_BUNDLE.length >= 3);
  for (const f of AM.PET_BUNDLE) {
    assert.ok(!loaded.includes(f), `${f} must not load on every provider tab`);
    assert.ok(!AM.CONTENT_BUNDLE.includes(f), `${f} must not be in the custom-site bundle`);
    assert.ok(existsSync(new URL('../' + f, import.meta.url)), `${f} exists`);
  }
  assert.ok(manifest.permissions.includes('scripting'), 'chrome.scripting.executeScript needs the scripting permission');
});

test('the widget loads and works without the pet engine present', () => {
  const sb = { console, document: { createElement() { return {}; } }, localStorage: {}, setInterval: () => 0, chrome: {} };
  const c = vm.createContext(sb);
  for (const f of ['src/core/quotas.js', 'src/core/common.js', 'src/core/widget.js']) vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), c, { filename: f });
  assert.equal(typeof c.AIMeter.widget.update, 'function');
  assert.equal(c.AIMeter.createPet, undefined, 'no pet until it is requested');
});
