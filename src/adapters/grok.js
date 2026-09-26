// Grok: the app asks /rest/rate-limits per model and gets remaining/total back (real).
(() => {
  const AM = globalThis.AIMeter;
  const SEND_RE = /\/rest\/app-chat\/conversations\/(new|[^/]+\/responses)(\?|$)/;

  AM.register({
    id: 'grok',
    name: 'Grok',
    hosts: ['grok.com'],
    preferReal: true,

    init(ctx) {
      this.ctx = ctx;
      this.real = {};
      this.lastModel = null;
      this.est = AM.estimator(ctx, 'grok');
      ctx.onResponse((d) => {
        if (/\/rest\/rate-limits/.test(d.url) && d.status === 200) this.parse(AM.safeJSON(d.body), AM.safeJSON(d.reqBody));
      });
      ctx.onRequest((d) => {
        if (d.method !== 'POST' || !SEND_RE.test(d.url)) return;
        const model = AM.safeJSON(d.body)?.modelName || '';
        if (model && model !== this.lastModel) {
          this.lastModel = model;
          chrome.storage.local.set({ 'grok.model': model }).catch(() => {});
        }
        this.est.record(model);
        clearTimeout(this.t);
        this.t = setTimeout(() => this.refresh(), 4000);
      });
      chrome.storage.local.get('grok.model').then((g) => {
        if (!this.lastModel && g['grok.model']) this.lastModel = g['grok.model'];
        this.refresh();
      }).catch(() => this.est.refresh());
      setInterval(() => ctx.visible() && this.refresh(), 90000);
    },

    parse(j, req) {
      if (!j) return;
      const model = req?.modelName || 'Grok';
      const kind = req?.requestKind && req.requestKind !== 'DEFAULT' ? ' · ' + req.requestKind.toLowerCase() : '';
      const meters = AM.findLimits(j, { label: model + kind });
      if (!meters.length) return this.ctx.log('rate-limits response had no counters', j);
      this.real[model + kind] = meters;
      this.ctx.report('real', Object.values(this.real).flat());
    },

    async refresh() {
      this.est.refresh();
      if (!this.lastModel) return this.ctx.log('no Grok model seen yet — send a message so the model name can be captured');
      const req = { requestKind: 'DEFAULT', modelName: this.lastModel };
      try {
        const j = await this.ctx.getJSON('/rest/rate-limits', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(req),
        });
        this.parse(j, req);
      } catch (e) {
        this.ctx.log('rate-limits fetch failed:', e.message);
      }
    },
  });
})();
