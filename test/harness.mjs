// Shared test helper (not a test): loads the extension's core scripts and one adapter into a vm context
// with a stubbed page (document, location, fetch) and a recording ctx, the way content.js wires an adapter.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

export function loadAdapter(adapterFile, { fetch, cookie = '', pathname = '/', html = '' } = {}) {
  const reports = [];
  const problems = [];
  const logs = [];
  let adapter;
  const sandbox = {
    console, atob, btoa, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    fetch: fetch || (async () => { throw new Error('offline'); }),
    document: { cookie, documentElement: { innerHTML: html, lang: 'en' }, visibilityState: 'visible', addEventListener() {} },
    location: { pathname, origin: 'https://example.test', hostname: 'example.test' },
  };
  const ctx = vm.createContext(sandbox);
  for (const f of ['src/core/quotas.js', 'src/core/common.js', 'src/core/parsers.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const AM = ctx.AIMeter;
  AM.register = (a) => { adapter = a; };
  AM.estimator = () => ({ record() {}, refresh() {}, relabelLast() {} });
  AM.watchDomChat = () => {};
  vm.runInContext(read(adapterFile), ctx, { filename: adapterFile });
  const c = {
    onRequest() {}, onResponse() {}, visible: () => true, debug: () => true,
    log: (...a) => logs.push(a.join(' ')),
    report: (group, meters) => reports.push({ group, meters: JSON.parse(JSON.stringify(meters || [])) }),
    problem: (kind, text) => problems.push({ kind, text }),
    clearProblem() {},
    setChat() {},
    // same contract as content.js: a non-2xx throws "<status> <url>"
    async getJSON(url, init) {
      const r = await sandbox.fetch(url, { credentials: 'include', ...(init || {}) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    },
  };
  adapter.init(c);
  return { adapter, AM, reports, problems, logs };
}

export const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } });
