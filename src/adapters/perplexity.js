// Perplexity: picks up remaining-query counters from the app's own settings / rate-limit
// calls when present (real), otherwise counts queries locally (estimate).
(() => {
  const AM = globalThis.AIMeter;
  const LIMITS_RE = /\/rest\/(rate-limit|user\/settings)/;

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
      });
      this.est.refresh();
      this.refresh();
    },

    parse(j) {
      const meters = AM.findLimits(j);
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
