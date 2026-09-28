// chrome.storage-backed helpers for content scripts, plus shutdown handling.
//
// When the extension is reloaded or updated, content scripts already running in open tabs keep
// running but lose their connection to the extension; every chrome.* call then throws
// "Extension context invalidated". Such an orphaned copy detects that, stops its timers,
// removes its widget and goes quiet. The freshly injected copy takes over after a tab reload.
(() => {
  const AM = globalThis.AIMeter;
  const KEEP_MS = 8 * 24 * 3600e3;

  // Track intervals created by our scripts so an orphaned copy can stop all of them.
  // This only affects the extension's isolated world, never the page's own timers.
  const timers = new Set();
  const nativeSetInterval = globalThis.setInterval.bind(globalThis);
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = nativeSetInterval(() => { if (!AM.dead) fn(...args); }, ms);
    timers.add(id);
    return id;
  };

  const isInvalidated = (e) => /context invalidated/i.test((e && e.message) || String(e));

  // Page-level events other parts react to: 'send' (a message went out), 'limit' (the site showed
  // its own limit notice).
  AM.bus = new EventTarget();
  AM.emit = (type, detail) => { if (!AM.dead) AM.bus.dispatchEvent(new CustomEvent(type, { detail })); };

  AM.dead = false;
  AM.shutdown = () => {
    if (AM.dead) return;
    AM.dead = true;
    for (const id of timers) clearInterval(id);
    timers.clear();
    try { AM.widget && AM.widget.destroy(); } catch {}
  };

  AM.alive = () => {
    if (AM.dead) return false;
    try {
      if (chrome.runtime && chrome.runtime.id) return true;
    } catch {}
    AM.shutdown();
    return false;
  };

  // Storage calls that resolve to empty results instead of throwing once the extension is gone.
  const storage = {
    async get(keys) {
      if (!AM.alive()) return {};
      try {
        return await chrome.storage.local.get(keys);
      } catch (e) {
        if (isInvalidated(e)) { AM.shutdown(); return {}; }
        throw e;
      }
    },
    async set(obj) {
      if (!AM.alive()) return;
      try {
        await chrome.storage.local.set(obj);
      } catch (e) {
        if (isInvalidated(e)) { AM.shutdown(); return; }
        throw e;
      }
    },
  };
  AM.storage = storage;

  // Last line of defence: swallow invalidation rejections from any of our own async paths.
  addEventListener('unhandledrejection', (ev) => {
    if (isInvalidated(ev.reason)) {
      ev.preventDefault();
      AM.shutdown();
    }
  });

  AM.loadSettings = async () => {
    const { settings } = await storage.get('settings');
    return AM.mergeSettings(settings);
  };

  // Writes are chained so a record followed quickly by a relabel can't lose either change.
  let eventChain = Promise.resolve();
  const mutate = (provider, fn) => {
    const key = 'events.' + provider;
    const run = eventChain.then(async () => {
      const got = await storage.get(key);
      const arr = fn(got[key] || []);
      await storage.set({ [key]: arr });
      return arr;
    });
    eventChain = run.catch(() => {});
    return run;
  };

  AM.events = {
    async list(provider) {
      await eventChain;
      const key = 'events.' + provider;
      const got = await storage.get(key);
      return got[key] || [];
    },
    // Only the model name and a timestamp are stored, never prompt text.
    record(provider, model) {
      const now = Date.now();
      return mutate(provider, (arr) => {
        const kept = arr.filter((e) => now - e.t < KEEP_MS);
        kept.push({ t: now, m: String(model || '').slice(0, 80) });
        return kept;
      });
    },
    relabelLast(provider, model) {
      return mutate(provider, (arr) => {
        if (arr.length) arr[arr.length - 1].m = String(model || '').slice(0, 80);
        return arr;
      });
    },
  };

  AM.estimator = (ctx, provider) => {
    const report = (events) => { if (!AM.dead) ctx.report('estimate', AM.countMeters(events, ctx.quotas())); };
    const safe = (p) => p.then(report).catch((e) => { if (!isInvalidated(e)) console.warn('[AI Meter]', e); });
    return {
      record: (model) => { AM.emit('send'); return safe(AM.events.record(provider, model)); },
      relabelLast: (model) => safe(AM.events.relabelLast(provider, model)),
      refresh: () => safe(AM.events.list(provider)),
    };
  };

  // Serialized so bursts of network events don't overwrite each other's read-modify-write.
  let logChain = Promise.resolve();
  AM.debugLog = (entry) => {
    logChain = logChain.then(async () => {
      const { 'debug.log': log = [] } = await storage.get('debug.log');
      if (AM.dead) return;
      log.unshift({ t: Date.now(), ...entry });
      await storage.set({ 'debug.log': log.slice(0, 60) });
    }).catch(() => {});
    return logChain;
  };
})();
