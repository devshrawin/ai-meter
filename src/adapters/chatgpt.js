// ChatGPT: no public message-limit endpoint. Counts sends per model locally (estimate),
// plus any limits_progress the app itself loads (real, e.g. deep research / image counts).
(() => {
  const AM = globalThis.AIMeter;
  const SEND_RE = /\/backend-api\/(f\/)?conversation(\?|$)/;

  AM.register({
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],

    init(ctx) {
      this.est = AM.estimator(ctx, 'chatgpt');
      ctx.onRequest((d) => {
        if (d.method !== 'POST' || !SEND_RE.test(d.url)) return;
        const b = AM.safeJSON(d.body);
        this.est.record((b && b.model) || 'auto');
      });
      ctx.onResponse((d) => {
        if (/\/backend-api\/conversation\/init/.test(d.url) && d.status === 200) {
          const j = AM.safeJSON(d.body);
          const meters = AM.findLimits(j && j.limits_progress ? j.limits_progress : j);
          if (meters.length) ctx.report('real', meters);
        }
        if (d.status === 429 && /backend-api/.test(d.url)) {
          ctx.report('banner', [{ id: 'banner', label: 'Rate limited', pct: 100, source: 'banner', seenAt: Date.now() }]);
        }
      });
      this.est.refresh();
      setInterval(() => ctx.visible() && this.est.refresh(), 60000);
    },

    refresh() { this.est.refresh(); },
  });
})();
