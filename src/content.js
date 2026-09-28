(() => {
  const AM = globalThis.AIMeter;
  if (window.top !== window) return;

  const host = location.hostname;
  const NOISE = /\/_data\/|cdn-cgi|\/rum\b|analytics|telemetry|statsig|sentry|segment|amplitude|datadog|event_logging|\/ping\b|heartbeat|\/log(s|ging)?\b|\/events?\b|\/t\/?$/i;
  // Debug log records the structure of a request body (key names, model-like values), never message text.
  const MODELISH = /model|mode|kind|type|effort|reasoning/i;
  const bodyShape = (body) => {
    const j = AM.safeJSON(body);
    if (!j || typeof j !== 'object' || Array.isArray(j)) return body ? `(${body.length} chars, not JSON)` : '';
    const parts = Object.keys(j).slice(0, 30).map((k) => {
      const v = j[k];
      if (MODELISH.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) return `${k}=${String(v).slice(0, 40)}`;
      if (v && typeof v === 'object' && !Array.isArray(v)) return `${k}{${Object.keys(v).slice(0, 12).join(',')}}`;
      return k;
    });
    return 'keys: ' + parts.join(', ');
  };

  let settings = AM.mergeSettings(null);
  let adapter = null;
  let injectOk = false;
  const reqSubs = [];
  const resSubs = [];
  const groups = {};
  const pending = [];

  const alive = () => {
    try { return !!chrome.runtime?.id; } catch { return false; }
  };
  const send = (msg) => {
    if (!alive()) return;
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {}
  };
  const safe = (fn, arg) => {
    try { fn(arg); } catch (e) { console.warn('[AI Meter]', e); }
  };
  const dlog = (entry) => {
    if (settings.debug && alive()) AM.debugLog({ provider: adapter ? adapter.id : host, ...entry });
  };

  const ctx = {
    quotas: () => settings.quotas[adapter.id] || AM.defaultQuotasFor(adapter.id, settings),
    onRequest: (fn) => reqSubs.push(fn),
    onResponse: (fn) => resSubs.push(fn),
    visible: () => document.visibilityState === 'visible',
    log: (...a) => {
      if (!settings.debug) return;
      console.log('[AI Meter]', adapter.id, ...a);
      dlog({ kind: 'note', url: host, body: a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 3000) });
    },
    report(group, meters) {
      groups[group] = meters || [];
      publish();
    },
    async getJSON(url, init) {
      const r = await fetch(url, { credentials: 'include', ...(init || {}) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    },
  };

  function current() {
    const now = Date.now();
    const hasReal = (groups.real || []).length > 0;
    return Object.entries(groups)
      .filter(([g]) => !(adapter.preferReal && hasReal && g === 'estimate'))
      .flatMap(([, ms]) => ms)
      .filter((m) => m.source !== 'banner' || (m.resetAt ? m.resetAt > now : now - (m.seenAt || now) < 3600e3))
      .map((m) => ({ ...m, pct: AM.pctOf(m) }));
  }

  function publish() {
    if (!adapter) return;
    const meters = current();
    AM.widget.update(adapter.name, meters, settings);
    send({ type: 'aimeter:usage', provider: adapter.id, name: adapter.name, meters });
  }

  function handle(d) {
    if (d.kind === 'pong') {
      injectOk = true;
      dlog({ kind: 'status', url: host, body: `network hook active (fetch hooked: ${d.fetchHooked})` });
      return;
    }
    if (d.kind === 'request') {
      reqSubs.forEach((f) => safe(f, d));
      if ((d.method === 'POST' || d.method === 'WS') && !NOISE.test(d.url)) {
        dlog({ kind: 'request', method: d.method, url: d.url.split('?')[0], body: bodyShape(d.body) });
      }
    } else if (d.kind === 'response') {
      if (!d.shapeOnly) resSubs.forEach((f) => safe(f, d));
      if (d.status === 429) {
        const wait = AM.toTime(d.retryAfter, 'rel');
        ctx.report('ratelimit', [{ id: 'ratelimit', label: 'Rate limited', pct: 100, source: 'banner', seenAt: Date.now(), resetAt: wait }]);
      }
      dlog({
        kind: 'response', method: d.method, status: d.status, url: d.url.split('?')[0],
        body: d.binary ? `(binary, ${Math.round((d.body || '').length * 0.75)} bytes)` : (d.shapeOnly ? 'shape: ' : '') + (d.body || '').slice(0, 3000),
      });
    }
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'aimeter-inject') return;
    if (adapter) handle(e.data);
    else if (pending.length < 200) pending.push(e.data);
  });

  function checkHook() {
    window.postMessage({ source: 'aimeter-content', kind: 'ping', debug: !!settings.debug }, location.origin);
    setTimeout(() => {
      if (!injectOk) dlog({ kind: 'status', url: host, body: 'network hook NOT active — request/response capture unavailable on this page' });
    }, 3000);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'aimeter:refresh' && adapter) {
      Promise.resolve(adapter.refresh && adapter.refresh()).finally(() => reply({ ok: true }));
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings || !adapter) return;
    const wasDebug = settings.debug;
    settings = AM.mergeSettings(changes.settings.newValue);
    if (settings.debug !== wasDebug) checkHook();
    if (adapter.refresh) adapter.refresh();
    publish();
  });

  AM.loadSettings()
    .catch(() => AM.mergeSettings(null))
    .then((s) => {
      settings = s;
      adapter = AM.adapterFor(host, settings);
      if (!adapter) return;
      adapter.init(ctx);
      AM.banner.watch(ctx);
      pending.splice(0).forEach(handle);
      publish();
      checkHook();
    });
})();
