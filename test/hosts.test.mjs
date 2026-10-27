import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
