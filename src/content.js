(() => {
  const AM = globalThis.AIMeter;
  const adapter = AM.adapters.find((a) =>
    a.hosts.some((h) => location.hostname === h || location.hostname.endsWith('.' + h)));
  if (!adapter || window.top !== window) return;

  let settings = AM.mergeSettings(null);
  const reqSubs = [];
  const resSubs = [];
  const groups = {};
  let injectOk = false;

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

  const ctx = {
    quotas: () => settings.quotas[adapter.id] || AM.DEFAULT_QUOTAS[adapter.id] || [],
    onRequest: (fn) => reqSubs.push(fn),
    onResponse: (fn) => resSubs.push(fn),
    visible: () => document.visibilityState === 'visible',
    log: (...a) => {
      if (!settings.debug) return;
      console.log('[AI Meter]', adapter.id, ...a);
      const text = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 3000);
      if (alive()) AM.debugLog({ provider: adapter.id, kind: 'note', url: location.host, body: text });
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
    const meters = current();
    AM.widget.update(adapter.name, meters, settings);
    send({ type: 'aimeter:usage', provider: adapter.id, name: adapter.name, meters });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'aimeter-inject') return;
    const d = e.data;
    if (d.kind === 'pong') {
      injectOk = true;
      if (settings.debug && alive()) AM.debugLog({ provider: adapter.id, kind: 'status', url: location.host, body: `network hook active (fetch hooked: ${d.fetchHooked})` });
      return;
    }
    if (d.kind === 'request') {
      reqSubs.forEach((f) => safe(f, d));
      if (settings.debug && d.method === 'POST' && alive()) {
        AM.debugLog({ provider: adapter.id, kind: 'request', method: d.method, url: d.url.split('?')[0] }).catch(() => {});
      }
    } else if (d.kind === 'response') {
      resSubs.forEach((f) => safe(f, d));
      if (settings.debug && alive()) {
        AM.debugLog({ provider: adapter.id, kind: 'response', method: d.method, status: d.status, url: d.url.split('?')[0], body: (d.body || '').slice(0, 3000) }).catch(() => {});
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'aimeter:refresh') {
      Promise.resolve(adapter.refresh && adapter.refresh()).finally(() => reply({ ok: true }));
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const wasDebug = settings.debug;
    settings = AM.mergeSettings(changes.settings.newValue);
    if (settings.debug && !wasDebug) checkHook();
    if (adapter.refresh) adapter.refresh();
    publish();
  });

  function checkHook() {
    window.postMessage({ source: 'aimeter-content', kind: 'ping' }, location.origin);
    setTimeout(() => {
      if (!injectOk && settings.debug && alive()) {
        AM.debugLog({ provider: adapter.id, kind: 'status', url: location.host, body: 'network hook NOT active — request/response capture unavailable on this page' });
      }
    }, 3000);
  }

  AM.loadSettings()
    .catch(() => AM.mergeSettings(null))
    .then((s) => {
      settings = s;
      adapter.init(ctx);
      AM.banner.watch(ctx);
      publish();
      checkHook();
    });
})();
