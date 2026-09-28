// Provider registry, default estimate rules and settings. No chrome.* or DOM access here.
// Estimate rules are matched top-down against the model name seen in each send; first match wins.
(() => {
  const AM = (globalThis.AIMeter = globalThis.AIMeter || { adapters: [] });

  // source: what kind of number we can get. 'real' = provider-reported, 'estimate' = local counting.
  AM.PROVIDERS = [
    { id: 'claude', name: 'Claude', hosts: ['claude.ai'], source: 'real' },
    { id: 'chatgpt', name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'], source: 'estimate + real (Codex)' },
    { id: 'gemini', name: 'Gemini', hosts: ['gemini.google.com'], source: 'real' },
    { id: 'grok', name: 'Grok', hosts: ['grok.com'], source: 'real' },
    { id: 'perplexity', name: 'Perplexity', hosts: ['perplexity.ai'], source: 'real' },
    { id: 'kimi', name: 'Kimi', hosts: ['kimi.com'], source: 'real' },
    { id: 'deepseek', name: 'DeepSeek', hosts: ['chat.deepseek.com'], source: 'estimate' },
    { id: 'qwen', name: 'Qwen', hosts: ['chat.qwen.ai'], source: 'estimate' },
    { id: 'mistral', name: 'Le Chat', hosts: ['chat.mistral.ai'], source: 'estimate' },
    { id: 'copilot', name: 'Copilot', hosts: ['copilot.microsoft.com'], source: 'estimate' },
    { id: 'meta', name: 'Meta AI', hosts: ['meta.ai'], source: 'estimate' },
    { id: 'poe', name: 'Poe', hosts: ['poe.com'], source: 'estimate' },
  ];

  // Must match the isolated-world content_scripts list in manifest.json (checked by tests).
  AM.CONTENT_BUNDLE = [
    'src/core/quotas.js',
    'src/core/common.js',
    'src/core/parsers.js',
    'src/core/store.js',
    'src/core/banner.js',
    'src/core/perches.js',
    'src/core/iris-frames.js',
    'src/core/walk8-frames.js',
    'src/core/pet.js',
    'src/core/widget.js',
    'src/core/chatdom.js',
    'src/adapters/claude.js',
    'src/adapters/chatgpt.js',
    'src/adapters/gemini.js',
    'src/adapters/grok.js',
    'src/adapters/perplexity.js',
    'src/adapters/kimi.js',
    'src/adapters/generic.js',
    'src/content.js',
  ];

  AM.siteScripts = (host) => {
    const matches = [`https://${host}/*`];
    return [
      { id: 'aimeter-main-' + host, matches, js: ['src/inject.js'], world: 'MAIN', runAt: 'document_start' },
      { id: 'aimeter-iso-' + host, matches, js: AM.CONTENT_BUNDLE, runAt: 'document_start' },
    ];
  };

  const hostMatches =(host, h) => host === h || host.endsWith('.' + h);

  AM.customSiteFor = (host, settings) =>
    ((settings && settings.customSites) || []).find((s) => hostMatches(host, s.host));

  AM.providerForHost = (host, settings) => {
    const p = AM.PROVIDERS.find((x) => x.hosts.some((h) => hostMatches(host, h)));
    if (p) return p;
    const s = AM.customSiteFor(host, settings);
    return s ? { id: 'site:' + s.host, name: s.name || s.host, hosts: [s.host], source: 'estimate', custom: true } : undefined;
  };

  const count = (label, limit = 0, windowHours = 24) => [{ id: 'messages', label, pattern: '.*', limit, windowHours }];

  // Published limits as of 2026-09; they change often, so every rule is editable in settings.
  AM.DEFAULT_QUOTAS = {
    chatgpt: [
      { id: 'thinking', label: 'Thinking', pattern: 'thinking|^o\\d|-t-', limit: 3000, windowHours: 168 },
      { id: 'messages', label: 'Messages', pattern: '.*', limit: 160, windowHours: 3 },
    ],
    gemini: count('Prompts'),
    grok: count('Messages', 0, 168),
    perplexity: count('Queries'),
    kimi: count('Messages'),
    deepseek: count('Messages'),
    qwen: count('Messages'),
    mistral: count('Messages', 25, 24),
    copilot: count('Messages'),
    meta: count('Messages'),
    poe: count('Messages'),
  };

  AM.defaultQuotasFor = (id, settings) => {
    if (AM.DEFAULT_QUOTAS[id]) return AM.DEFAULT_QUOTAS[id];
    if (id.startsWith('site:')) {
      const s = ((settings && settings.customSites) || []).find((x) => 'site:' + x.host === id);
      if (s) return count('Messages', s.limit || 0, s.windowHours || 24);
    }
    return [];
  };

  AM.DEFAULT_SETTINGS = {
    widget: true,
    chatStats: true,
    pet: true,
    explore: true,
    notify: true,
    thresholds: [75, 90, 100],
    debug: false,
    quotas: AM.DEFAULT_QUOTAS,
    customSites: [],
  };

  AM.mergeSettings = (s) => ({
    ...AM.DEFAULT_SETTINGS,
    ...(s || {}),
    quotas: { ...AM.DEFAULT_QUOTAS, ...((s && s.quotas) || {}) },
    customSites: Array.isArray(s && s.customSites) ? s.customSites : [],
  });
})();
