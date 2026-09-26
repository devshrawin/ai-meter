// Counting adapter for sites that expose no usage numbers, and for sites the user adds.
// Must load after the named adapters: adapterFor() falls back to it.
(() => {
  const AM = globalThis.AIMeter;

  const SEND_HINT = /(conversation|completions?|chat|ask|generate|messages?|responses?|prompt|query|stream)s?(\/|$)/i;
  const NOT_SEND = /(title|feedback|rename|delete|share|upload|history|list|search|settings|suggest|autocomplete|typeahead|vote|rating|stop|cancel|report|read|seen|sync)/i;
  const WS_TEXT = /"(content|text|prompt|message|query|input)"\s*:\s*"[^"]{2,}/;

  // Best-effort guess for unknown sites: a POST to a chat-looking path with a real body,
  // or a WebSocket frame carrying text content.
  AM.looksLikeSend = (d) => {
    const path = d.url.split('?')[0];
    if (d.method === 'WS') return WS_TEXT.test(d.body || '');
    return d.method === 'POST' && SEND_HINT.test(path) && !NOT_SEND.test(path) && (d.body || '').length > 30;
  };

  const post = (re) => (d) => d.method === 'POST' && re.test(d.url);

  // Send endpoints from community reverse-engineering (see README); unverified sites fall back to the heuristic.
  const SITES = {
    deepseek: { send: post(/\/api\/v0\/chat\/completion(\?|$)/), model: (b) => (b && b.thinking_enabled ? 'thinking' : '') },
    qwen: { send: post(/\/api\/v2\/chat\/completions/), model: (b) => (b && (b.model || (b.models && b.models[0]))) || '' },
    mistral: { send: AM.looksLikeSend },
    copilot: { send: (d) => d.method === 'WS' && /\/c\/api\/chat/.test(d.url) && /"event"\s*:\s*"send"/.test(d.body || '') },
    meta: { send: (d) => d.method === 'POST' && /\/api\/graphql/.test(d.url) && /SendMessage/i.test(d.body || '') },
    poe: { send: (d) => d.method === 'POST' && /gql_POST/.test(d.url) && /sendMessageMutation/i.test(d.body || '') },
  };

  AM.makeGeneric = (id, name, cfg) => ({
    id,
    name,
    init(ctx) {
      this.est = AM.estimator(ctx, id);
      this.last = 0;
      ctx.onRequest((d) => {
        if (!cfg.send(d)) return;
        // One user send often fires several matching requests; count it once.
        if (Date.now() - this.last < 1500) return;
        this.last = Date.now();
        this.est.record(cfg.model ? cfg.model(AM.safeJSON(d.body)) : '');
      });
      this.est.refresh();
      setInterval(() => ctx.visible() && this.est.refresh(), 60000);
    },
    refresh() { this.est.refresh(); },
  });

  for (const [id, cfg] of Object.entries(SITES)) {
    const p = AM.PROVIDERS.find((x) => x.id === id);
    AM.register({ ...AM.makeGeneric(id, p.name, cfg), hosts: p.hosts });
  }

  AM.adapterFor = (host, settings) => {
    const named = AM.adapters.find((a) => a.hosts && a.hosts.some((h) => host === h || host.endsWith('.' + h)));
    if (named) return named;
    const site = AM.customSiteFor(host, settings);
    return site ? AM.makeGeneric('site:' + site.host, site.name || site.host, { send: AM.looksLikeSend }) : null;
  };
})();
