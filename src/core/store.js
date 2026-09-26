// chrome.storage-backed helpers for content scripts.
(() => {
  const AM = globalThis.AIMeter;
  const KEEP_MS = 8 * 24 * 3600e3;

  AM.loadSettings = async () => {
    const { settings } = await chrome.storage.local.get('settings');
    return AM.mergeSettings(settings);
  };

  AM.events = {
    async list(provider) {
      const key = 'events.' + provider;
      const got = await chrome.storage.local.get(key);
      return got[key] || [];
    },
    // Only the model name and a timestamp are stored, never prompt text.
    async record(provider, model) {
      const key = 'events.' + provider;
      const now = Date.now();
      const arr = (await AM.events.list(provider)).filter((e) => now - e.t < KEEP_MS);
      arr.push({ t: now, m: String(model || '').slice(0, 80) });
      await chrome.storage.local.set({ [key]: arr });
      return arr;
    },
  };

  AM.estimator = (ctx, provider) => {
    const report = (events) => ctx.report('estimate', AM.countMeters(events, ctx.quotas()));
    return {
      record: async (model) => report(await AM.events.record(provider, model)),
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
