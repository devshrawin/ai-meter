window.chrome = { runtime: { id: 'preview', getURL: (p) => '/' + p, getManifest: () => ({ version: '1.0.0' }) },
  storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } } };
