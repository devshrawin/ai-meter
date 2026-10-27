// Builds tools/site-smoke/dist/smoke-bundle.js: the extension's real MAIN-world hook + content scripts in one file,
// with a tiny in-memory chrome.* stub, so they can be injected into a live page (e.g. in the Claude desktop built-in
// browser, where the unpacked extension can't be installed) to smoke-test mounting, adapter selection, the network hook,
// and DOM selectors. Usage: node tools/site-smoke/build.mjs [port]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const port = process.argv[2] || '8799';
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const main = manifest.content_scripts.find((c) => c.world === 'MAIN');
const iso = manifest.content_scripts.find((c) => c.world !== 'MAIN');
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const stub = `
window.__smoke = { store: { settings: { debug: true, widget: true, pet: false } }, sent: [], errors: [] };
window.addEventListener('error', (e) => window.__smoke.errors.push(String(e.message)));
window.chrome = {
  runtime: {
    id: 'smoke-test',
    getURL: (p) => 'http://localhost:${port}/' + p,
    sendMessage: (m) => { window.__smoke.sent.push(m); return Promise.resolve({}); },
    onMessage: { addListener() {} },
  },
  storage: {
    onChanged: { addListener() {} },
    local: {
      get: async (k) => { const keys = typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k || {}); const o = {}; keys.forEach((x) => { if (x in window.__smoke.store) o[x] = window.__smoke.store[x]; }); return o; },
      set: async (o) => { Object.assign(window.__smoke.store, JSON.parse(JSON.stringify(o))); },
      remove: async (k) => { delete window.__smoke.store[k]; },
    },
  },
};
`;

const parts = [stub, ...main.js.map(read), ...iso.js.map(read)];
const out = '(() => {\nif (window.__smoke) return;\n' + parts.map((p) => `;(() => {\n${p}\n})();`).join('\n') + '\n})();\n';
mkdirSync(new URL('tools/site-smoke/dist/', root), { recursive: true });
writeFileSync(new URL('tools/site-smoke/dist/smoke-bundle.js', root), out);
console.log(`bundle: ${(out.length / 1024).toFixed(0)} KB, ${main.js.length + iso.js.length} files`);
