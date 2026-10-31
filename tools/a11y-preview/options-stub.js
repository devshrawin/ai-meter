(() => {
  const data = { settings: { customSites: [{ host: 'chat.example.com', limit: 40, windowHours: 3 }] } };
  const ls = { 'debug.log': [{ t: Date.now(), provider: 'claude', kind: 'response', status: 200, url: 'https://claude.ai/api/usage', body: '{"five_hour":{"utilization":9}}' }] };
  Object.assign(data, ls);
  window.chrome = {
    storage: { local: { get: async (k) => (k == null ? { ...data } : typeof k === 'string' ? { [k]: data[k] } : {}), set: async (o) => Object.assign(data, o), remove: async () => {} }, onChanged: { addListener() {} } },
    permissions: { request: async () => true, remove: async () => true, contains: async () => true },
    scripting: { registerContentScripts: async () => {}, unregisterContentScripts: async () => {} },
    runtime: { getURL: (p) => '/' + p, getManifest: () => ({ version: '1.0.0' }) },
  };
})();
