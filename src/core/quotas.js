// Default estimate rules for providers that don't expose real usage numbers.
// Rules are matched top-down against the model name seen in each request; first match wins.
(() => {
  const AM = (globalThis.AIMeter = globalThis.AIMeter || { adapters: [] });

  AM.PROVIDERS = [
    { id: 'claude', name: 'Claude', hosts: ['claude.ai'] },
    { id: 'chatgpt', name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'] },
    { id: 'gemini', name: 'Gemini', hosts: ['gemini.google.com'] },
    { id: 'grok', name: 'Grok', hosts: ['grok.com'] },
    { id: 'perplexity', name: 'Perplexity', hosts: ['perplexity.ai'] },
  ];

  AM.providerForHost = (host) =>
    AM.PROVIDERS.find((p) => p.hosts.some((h) => host === h || host.endsWith('.' + h)));

  AM.DEFAULT_QUOTAS = {
    chatgpt: [
      { id: 'thinking', label: 'Thinking', pattern: 'thinking|^o\\d|-t-', limit: 3000, windowHours: 168 },
      { id: 'messages', label: 'Messages', pattern: '.*', limit: 160, windowHours: 3 },
    ],
    gemini: [
      { id: 'pro', label: 'Pro / Thinking', pattern: 'pro|think', limit: 100, windowHours: 24 },
      { id: 'prompts', label: 'Prompts', pattern: '.*', limit: 0, windowHours: 24 },
    ],
    grok: [{ id: 'queries', label: 'Queries', pattern: '.*', limit: 0, windowHours: 2 }],
    perplexity: [{ id: 'queries', label: 'Queries', pattern: '.*', limit: 0, windowHours: 24 }],
  };

  AM.DEFAULT_SETTINGS = {
    widget: true,
    notify: true,
    thresholds: [75, 90, 100],
    debug: false,
    quotas: AM.DEFAULT_QUOTAS,
  };

  AM.mergeSettings = (s) => ({
    ...AM.DEFAULT_SETTINGS,
    ...(s || {}),
    quotas: { ...AM.DEFAULT_QUOTAS, ...((s && s.quotas) || {}) },
  });
})();
