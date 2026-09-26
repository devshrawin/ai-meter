// Perplexity: GET /rest/rate-limit/all → remaining_pro / remaining_research / remaining_labs (real).
(() => {
  const AM = globalThis.AIMeter;
  const LIMITS_RE = /\/rest\/(rate-limit|user\/settings)/;
  const LABELS = { Pro: 'Pro searches', Research: 'Research', 'Agentic Research': 'Agentic research', Labs: 'Labs' };

  AM.register({
    id: 'perplexity',
    name: 'Perplexity',
    hosts: ['perplexity.ai'],
    preferReal: true,

    init(ctx) {
      this.ctx = ctx;
      this.est = AM.estimator(ctx, 'perplexity');
      ctx.onResponse((d) => {
        if (LIMITS_RE.test(d.url) && d.status === 200) this.parse(AM.safeJSON(d.body));
      });
      ctx.onRequest((d) => {
        if (d.method !== 'POST' || !/\/rest\/sse\/perplexity_ask/.test(d.url)) return;
        const b = AM.safeJSON(d.body);
        this.est.record(b?.params?.mode || b?.params?.model_preference || b?.mode || '');
        clearTimeout(this.t);
        this.t = setTimeout(() => this.refresh(), 5000);
      });
      this.est.refresh();
      this.refresh();
      setInterval(() => ctx.visible() && this.refresh(), 120000);
    },

    parse(j) {
      const meters = AM.findLimits(j).map((m) => ({ ...m, label: LABELS[m.label] || m.label }));
      if (meters.length) this.ctx.report('real', meters);
    },

    async refresh() {
      this.est.refresh();
      try {
        this.parse(await this.ctx.getJSON('/rest/rate-limit/all'));
      } catch (e) {
        this.ctx.log('rate-limit fetch failed:', e.message);
      }
    },
  });
})();
