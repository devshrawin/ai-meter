// ChatGPT: per-model chat caps are not exposed anywhere, so chat messages are counted locally
// (estimate). Real numbers where they exist: Codex 5h/weekly windows from /backend-api/wham/usage
// and feature counters (deep research, images) from conversation/init.
(() => {
  const AM = globalThis.AIMeter;
  const SEND_RE = /\/(backend-api|unauth-mweb)\/(f\/)?conversation(\?|$)/;
  // The anti-bot token is fetched right before every send, signed in or out, even when the
  // send itself isn't visible to the page hook (signed-out chat streams it elsewhere).
  const PRESEND_RE = /\/sentinel\/chat-requirements(\/finalize)?(\?|$)/;
  const MERGE_MS = 5000;
  const TOKEN_TTL = 10 * 60e3;

  AM.register({
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],

    init(ctx) {
      this.ctx = ctx;
      this.tok = null;
      this.tokAt = 0;
      this.est = AM.estimator(ctx, 'chatgpt');
      this.lastSend = 0;
      ctx.onRequest((d) => {
        if (d.method !== 'POST') return;
        const isSend = SEND_RE.test(d.url);
        if (!isSend && !PRESEND_RE.test(d.url)) return;
        const model = isSend ? AM.safeJSON(d.body)?.model : null;
        const fresh = Date.now() - this.lastSend > MERGE_MS;
        this.lastSend = Date.now();
        // One message fires both signals; count once, but let the real send upgrade the model name.
        if (fresh) this.est.record(model || 'auto');
        else if (model && model !== 'auto') this.est.relabelLast(model);
        clearTimeout(this.t);
        this.t = setTimeout(() => this.refresh(), 8000);
      });
      ctx.onResponse((d) => {
        if (d.status !== 200) return;
        if (/\/backend-api\/wham\/usage/.test(d.url)) this.parseUsage(AM.safeJSON(d.body));
        if (/\/backend-api\/conversation\/init/.test(d.url)) {
          const j = AM.safeJSON(d.body);
          const meters = AM.findLimits(j && j.limits_progress ? j.limits_progress : j);
          if (meters.length) ctx.report('features', meters);
        }
      });
      this.est.refresh();
      this.refresh();
      setInterval(() => ctx.visible() && this.refresh(), 120000);
    },

    // The access token lives only in memory and is only sent back to chatgpt.com.
    async token() {
      if (this.tok && Date.now() - this.tokAt < TOKEN_TTL) return this.tok;
      const s = await this.ctx.getJSON('/api/auth/session', { cache: 'no-store' });
      if (!s || !s.accessToken) throw new Error('no access token (signed out?)');
      this.tok = s.accessToken;
      this.tokAt = Date.now();
      return this.tok;
    },

    async refresh() {
      this.est.refresh();
      if (Date.now() < (this.noAuthUntil || 0)) return;
      try {
        const tok = await this.token();
        this.parseUsage(await this.ctx.getJSON('/backend-api/wham/usage', {
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' },
        }));
      } catch (e) {
        this.ctx.log('wham/usage failed:', e.message);
        if (/^40[13]/.test(e.message)) this.tok = null;
        if (/no access token/.test(e.message)) this.noAuthUntil = Date.now() + 10 * 60e3;
      }
    },

    parseUsage(j) {
      const meters = AM.parseChatGPTUsage(j);
      if (meters.length) this.ctx.report('codex', meters);
      else this.ctx.log('wham/usage returned no usage windows');
    },
  });
})();
