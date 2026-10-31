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
  let chat = null;
  const reqSubs = [];
  const resSubs = [];
  const groups = {};
  const pending = [];
  let problem = null; // { kind: 'error' | 'signin', text, since }
  let problemTimer = 0;

  const alive = () => AM.alive();
  const send = (msg) => {
    if (!alive()) return;
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {}
  };
  const safe = (fn, arg) => {
    try { fn(arg); } catch (e) { console.warn('[Headroom]', e); }
  };
  const dlog = (entry) => {
    if (!settings.debug || !alive()) return;
    const clean = { ...entry };
    if (clean.url) clean.url = AM.redact(clean.url);
    if (clean.body) clean.body = AM.redact(clean.body);
    AM.debugLog({ provider: adapter ? adapter.id : host, ...clean });
  };

  const ctx = {
    quotas: () => settings.quotas[adapter.id] || AM.defaultQuotasFor(adapter.id, settings),
    onRequest: (fn) => reqSubs.push(fn),
    onResponse: (fn) => resSubs.push(fn),
    visible: () => document.visibilityState === 'visible',
    debug: () => !!settings.debug,
    log: (...a) => {
      if (!settings.debug) return;
      console.log('[Headroom]', adapter.id, ...a);
      dlog({ kind: 'note', url: host, body: a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 3000) });
    },
    report(group, meters) {
      groups[group] = meters || [];
      if (group === 'real' && meters && meters.length) problem = null; // real numbers prove the usage path works
      publish();
    },
    // An adapter could not get usage ('error') or the user is signed out ('signin'). Shown in the pill and panel.
    problem(kind, text) {
      const t = String(text || '').slice(0, 160);
      if (!problem || problem.kind !== kind || problem.text !== t) problem = { kind, text: t, since: Date.now() };
      clearTimeout(problemTimer);
      problemTimer = setTimeout(publish, AM.PROBLEM_DELAY_MS + 200); // an 'error' becomes visible after the delay
      publish();
    },
    clearProblem() { problem = null; publish(); },
    setChat(stats) {
      chat = stats;
      publish();
    },
    async getJSON(url, init) {
      if (AM.dead) throw new Error('Headroom was reloaded');
      const r = await fetch(url, { credentials: 'include', ...(init || {}) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    },
  };

  function current() {
    const now = Date.now();
    const real = groups.real || [];
    const hasReal = real.length > 0;
    // The provider's own numbers beat guesses: if its main limits say you're not blocked, ignore
    // "limit reached" notices and 429s (which can be false alarms).
    const primary = real.filter((m) => !m.secondary);
    const realSaysOk = primary.length > 0 && primary.every((m) => (AM.pctOf(m) ?? 0) < 95);
    return Object.entries(groups)
      .filter(([g]) => !(adapter.preferReal && hasReal && g === 'estimate'))
      .filter(([g]) => !(realSaysOk && (g === 'banner' || g === 'ratelimit')))
      .flatMap(([, ms]) => ms)
      .filter((m) => m.source !== 'banner' || (m.resetAt ? m.resetAt > now : now - (m.seenAt || now) < 3600e3))
      .map((m) => ({ ...m, pct: AM.pctOf(m) }));
  }

  function publish() {
    if (!adapter || !alive()) return;
    const meters = current();
    const shown = AM.problemToShow(problem, meters);
    AM.widget.update(adapter.name, meters, settings, settings.chatStats ? chat : null, shown);
    send({ type: 'aimeter:usage', provider: adapter.id, name: adapter.name, meters, problem: shown });
  }

  // Iris's code is not in the always-loaded bundle: the background script injects it into this tab on request.
  AM.loadPet = () => new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: 'aimeter:loadPet' }, (r) => {
        if (chrome.runtime.lastError || !r || !r.ok) reject(new Error((r && r.error) || 'could not load Iris'));
        else resolve();
      });
    } catch (e) { reject(e); }
  });

  // "Copy debug log": diagnostics for the current provider, from this tab's state plus the stored debug log.
  AM.copyDiagnostics = async () => {
    let log = [];
    try { log = (await AM.storage.get('debug.log'))['debug.log'] || []; } catch {}
    let version = '';
    try { version = chrome.runtime.getManifest().version; } catch {}
    const text = AM.buildDiagnostics({ version, provider: adapter && adapter.id, host, problem, meters: current(), log });
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  };

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
      // Only a 429 on a real request counts, not on background telemetry.
      if (d.status === 429 && !NOISE.test(d.url)) {
        const wait = AM.toTime(d.retryAfter, 'rel');
        ctx.report('ratelimit', [{ id: 'ratelimit', label: 'Rate limited', pct: 100, source: 'banner', seenAt: Date.now(), resetAt: wait }]);
      }
      dlog({
        kind: 'response', method: d.method, status: d.status, url: d.url.split('?')[0],
        body: d.binary ? `(binary, ${Math.round((d.body || '').length * 0.75)} bytes)` : (d.shapeOnly ? 'shape: ' : '') + (d.body || '').slice(0, 3000),
      });
    }
  }

  // Private channel to the page-world hook (inject.js). Not window.postMessage: that is readable and forgeable by
  // every script on the page. We hand inject.js one end of a MessageChannel in a 'hello'; only it (it listens first
  // and swallows the event) holds the other end, so a page script cannot post here. Each message is validated.
  let port = null;
  let helloTries = 0;
  function connect() {
    if (port || AM.dead || helloTries >= 6) return;
    helloTries++;
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      if (AM.dead) return;
      const d = AM.validateInjectMessage(e.data);
      if (!d) return;
      if (!port) { port = ch.port1; checkHook(); } // first valid message from inject.js: the channel is live
      if (adapter) handle(d);
      else if (pending.length < 200) pending.push(d);
    };
    window.postMessage({ source: 'aimeter-content', kind: 'hello' }, location.origin, [ch.port2]);
    setTimeout(connect, 1500); // no answer yet (inject.js may start later): try again with a fresh channel
  }
  // inject.js announces itself when it starts, in case we sent our hello before it was listening.
  window.addEventListener('message', (e) => {
    if (!port && e.source === window && e.data && e.data.source === 'aimeter-inject' && e.data.kind === 'ready') connect();
  });
  connect();

  function checkHook() {
    if (port) port.postMessage({ kind: 'ping', debug: !!settings.debug });
    setTimeout(() => {
      if (!injectOk) dlog({ kind: 'status', url: host, body: 'network hook NOT active — request/response capture unavailable on this page' });
    }, 3000);
  }

  // A broken adapter (it throws, or its parser chokes on a changed response) must not take the pill, the other
  // handlers or the page down: failures become a visible "can't read usage" problem instead.
  const failed = (what, e) => {
    console.warn('[Headroom]', adapter && adapter.id, what, e);
    if (adapter) ctx.problem('error', 'Headroom hit an internal error reading this site (' + what + ')');
    if (problem) { problem.since = Date.now() - AM.PROBLEM_DELAY_MS; publish(); } // our own failure: show it now, not after the delay
  };
  const refreshAdapter = async () => {
    try { if (adapter && adapter.refresh) await adapter.refresh(); } catch (e) { failed('refresh', e); }
  };

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'aimeter:refresh' && adapter) {
      refreshAdapter().finally(() => reply({ ok: true }));
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings || !adapter) return;
    const wasDebug = settings.debug;
    settings = AM.mergeSettings(changes.settings.newValue);
    if (settings.debug !== wasDebug) checkHook();
    refreshAdapter();
    publish();
  });

  AM.loadSettings()
    .catch(() => AM.mergeSettings(null))
    .then((s) => {
      settings = s;
      adapter = AM.adapterFor(host, settings);
      if (!adapter) return;
      AM.siteId = adapter.id;
      // Lets the on-page panel change a setting (e.g. "Send Iris home"); onChanged below applies it.
      AM.setSetting = async (key, value) => {
        const { settings: stored } = await AM.storage.get('settings');
        await AM.storage.set({ settings: { ...(stored || {}), [key]: value } });
      };
      try { adapter.init(ctx); } catch (e) { failed('start', e); }
      try { AM.banner.watch(ctx); } catch (e) { console.warn('[Headroom] banner', e); }
      pending.splice(0).forEach(handle);
      publish();
      checkHook();
    });
})();
