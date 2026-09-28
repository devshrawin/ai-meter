// chrome.storage-backed helpers for content scripts.
(() => {
  const AM = globalThis.AIMeter;
  const KEEP_MS = 8 * 24 * 3600e3;

  AM.loadSettings = async () => {
    const { settings } = await chrome.storage.local.get('settings');
    return AM.mergeSettings(settings);
  };

  // Writes are chained so a record followed quickly by a relabel can't lose either change.
  let eventChain = Promise.resolve();
  const mutate = (provider, fn) => {
    const key = 'events.' + provider;
    const run = eventChain.then(async () => {
      const got = await chrome.storage.local.get(key);
      const arr = fn(got[key] || []);
      await chrome.storage.local.set({ [key]: arr });
      return arr;
    });
    eventChain = run.catch(() => {});
    return run;
  };

  AM.events = {
    async list(provider) {
      await eventChain;
      const key = 'events.' + provider;
      const got = await chrome.storage.local.get(key);
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
    const report = (events) => ctx.report('estimate', AM.countMeters(events, ctx.quotas()));
    return {
      record: async (model) => report(await AM.events.record(provider, model)),
      relabelLast: async (model) => report(await AM.events.relabelLast(provider, model)),
      refresh: async () => report(await AM.events.list(provider)),
    };
  };

  // Serialized so bursts of network events don't overwrite each other's read-modify-write.
  let logChain = Promise.resolve();
  AM.debugLog = (entry) => {
    logChain = logChain.then(async () => {
      const { 'debug.log': log = [] } = await chrome.storage.local.get('debug.log');
      log.unshift({ t: Date.now(), ...entry });
      await chrome.storage.local.set({ 'debug.log': log.slice(0, 60) });
    }).catch(() => {});
    return logChain;
  };
})();
