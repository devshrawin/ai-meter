// ChatGPT: per-model chat caps are not exposed anywhere, so chat messages are counted locally
// (estimate). Real numbers where they exist: Codex 5h/weekly windows from /backend-api/wham/usage
// and feature counters (deep research, images) from conversation/init.
(() => {
  const AM = globalThis.AIMeter;
  const SEND_RE = /\/backend-api\/(f\/)?conversation(\?|$)/;
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
      ctx.onRequest((d) => {
        if (d.method !== 'POST' || !SEND_RE.test(d.url)) return;
        const b = AM.safeJSON(d.body);
        this.est.record((b && b.model) || 'auto');
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
      try {
        const tok = await this.token();
        this.parseUsage(await this.ctx.getJSON('/backend-api/wham/usage', {
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' },
        }));
      } catch (e) {
        this.ctx.log('wham/usage failed:', e.message);
        if (/^40[13]/.test(e.message)) this.tok = null;
      }
    },

    parseUsage(j) {
      const meters = AM.parseChatGPTUsage(j);
      if (meters.length) this.ctx.report('codex', meters);
      else this.ctx.log('wham/usage returned no usage windows');
    },
  });
})();
