// Sample data for the popup preview (shapes match what background.js stores under "usage.<provider>").
(() => {
  const now = Date.now();
  const H = 3600e3;
  const state = new URLSearchParams(location.search).get('state') || 'default';
  const entry = (provider, name, ago, meters, problem = null) => ({ provider, name, updatedAt: now - ago, meters, problem });
  const claude = entry('claude', 'Claude', 3 * 60e3, [
    { id: 'five_hour', label: 'Session (5h)', pct: 0, source: 'real' },
    { id: 'seven_day', label: 'Weekly', pct: 32, resetAt: now + 13 * H + 9 * 60e3, source: 'real' },
  ]);
  const chatgpt = entry('chatgpt', 'ChatGPT', 49 * H, [
    { id: 'gpt', label: 'Messages', used: 3, limit: 160, source: 'estimate', resetAt: now - 1000 },
    { id: 'dr', label: 'Deep Research', remaining: 5, source: 'real', resetAt: now + 28 * 24 * H },
    { id: 'fu', label: 'File Upload', remaining: 2, source: 'real', resetAt: now - 1000 },
    { id: 'pt', label: 'Paste Text To File', remaining: 3, source: 'real', resetAt: now - 1000 },
    { id: 'ig', label: 'Image Gen', remaining: 9, source: 'real', resetAt: now - 1000 },
    { id: 'rs', label: 'Reason', remaining: 18, source: 'real', resetAt: now - 1000 },
    { id: 'od', label: 'Odyssey', remaining: 1, source: 'real', resetAt: now - 1000 },
  ]);
  const gemini = entry('gemini', 'Gemini', 20 * 60e3, [
    { id: 'session', label: 'Session (5h)', pct: 9, resetAt: now + 3 * H + 56 * 60e3, source: 'real' },
    { id: 'weekly', label: 'Weekly', pct: 0, resetAt: now + 2 * 24 * H + 21 * H, source: 'real' },
  ]);
  const grok = entry('grok', 'Grok', 9 * 60e3, [
    { id: 'grok-3', label: 'Grok 3 (24h)', used: 15, limit: 30, remaining: 15, source: 'real' },
    { id: 'grok-4', label: 'Grok 4 (24h)', used: 0, limit: 7, remaining: 7, source: 'real', secondary: true },
  ]);
  const hot = entry('claude', 'Claude', 60e3, [
    { id: 'five_hour', label: 'Session (5h)', pct: 96, resetAt: now + 42 * 60e3, source: 'real' },
    { id: 'seven_day', label: 'Weekly', pct: 81, resetAt: now + 2 * 24 * H, source: 'real' },
  ]);
  const perplexity = entry('perplexity', 'Perplexity', 5 * 60e3, [], { kind: 'signin', text: 'Sign in to Perplexity to see your remaining searches.', since: now - 1000 });
  const kimi = entry('kimi', 'Kimi', 12 * 60e3, [], { kind: 'error', text: 'Not signed in, or the sign-in cookie is not readable here', since: now - 60e3 });
  const sets = {
    default: [claude, chatgpt],
    many: [hot, chatgpt, gemini, grok, perplexity, kimi],
    problem: [perplexity, kimi, gemini],
    empty: [],
  };
  const data = {};
  for (const e of sets[state] || sets.default) data['usage.' + e.provider] = e;
  window.chrome = {
    storage: { local: { get: async () => data }, onChanged: { addListener() {} } },
    runtime: { openOptionsPage() {}, getManifest: () => ({ version: '0.9.0' }) },
    tabs: { query: async () => [], sendMessage: async () => ({}) },
  };
})();
