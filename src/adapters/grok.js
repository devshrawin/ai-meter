// Grok chat usage: per-model query limits from POST /rest/rate-limits ({remainingQueries,totalQueries,windowSizeSeconds}),
// verified live 2026-10-17 (it counts down as you send). The gRPC-web GrokBuildBilling/GetGrokCreditsConfig weekly pool
// is a separate (Grok Build) credit pool: when it carries no usage figure we ignore it instead of showing a false 0%.
// Messages are sent over the /ws/mgw WebSocket.
(() => {
  const AM = globalThis.AIMeter;
  const CREDITS_PATH = '/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig';
  // Empty request message wrapped in a gRPC-web frame, as the app sends it.
  const CREDITS_BODY = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x02, 0x08, 0x00]);

  AM.register({
    id: 'grok',
    name: 'Grok',
    hosts: ['grok.com'],
    preferReal: true,

    init(ctx) {
      this.ctx = ctx;
      this.est = AM.estimator(ctx, 'grok');
      this.limits = [];
      this.credits = [];
      this.lastModel = '';
      ctx.onRequest((d) => {
        let model = null;
        if (d.method === 'WS' && /\/ws\/mgw/.test(d.url)) {
          const ev = AM.safeJSON(d.body)?.event;
          if (!ev || !ev.item) return;
          model = ev.item.modelName || ev.item.model || '';
        } else if (d.method === 'POST' && /\/rest\/app-chat\/conversations\/(new|[^/]+\/responses)(\?|$)/.test(d.url)) {
          model = AM.safeJSON(d.body)?.modelName || '';
        } else {
          return;
        }
        if (model) this.lastModel = String(model).toLowerCase();
        this.est.record(model);
        clearTimeout(this.t);
        this.t = setTimeout(() => this.refresh(), 6000);
      });
      ctx.onResponse((d) => {
        if (d.status !== 200) return;
        if (d.url.includes('GetGrokCreditsConfig') && d.binary) this.parseCredits(AM.b64ToBytes(d.body));
        else if (/\/rest\/rate-limits/.test(d.url)) {
          const meters = AM.findLimits(AM.safeJSON(d.body), { label: AM.safeJSON(d.reqBody)?.modelName || 'Grok' });
          if (meters.length) ctx.report('legacy', meters);
        }
      });
      this.est.refresh();
      this.refresh();
      setInterval(() => ctx.visible() && this.refresh(), 120000);
    },

    async refresh() {
      this.est.refresh();
      try {
        const r = await fetch(CREDITS_PATH, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/grpc-web+proto', 'x-grpc-web': '1', accept: '*/*' },
          body: CREDITS_BODY,
        });
        const status = r.headers.get('grpc-status');
        if (!r.ok || (status && status !== '0')) {
          throw new Error(`HTTP ${r.status} grpc-status ${status || '-'} ${r.headers.get('grpc-message') || ''}`.trim());
        }
        this.parseCredits(new Uint8Array(await r.arrayBuffer()));
      } catch (e) {
        this.ctx.log('Grok credits fetch failed:', e.message);
      }
      await this.refreshLimits();
    },

    // Chat limits per model: remainingQueries / totalQueries over windowSizeSeconds (24h on the free tier).
    async refreshLimits() {
      const models = [...new Set(['grok-4', 'grok-3'].concat(this.lastModel && /^grok-[\w.-]+$/.test(this.lastModel) ? [this.lastModel] : []))];
      const out = [];
      for (const modelName of models) {
        try {
          const r = await fetch('/rest/rate-limits', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ requestKind: 'DEFAULT', modelName }),
          });
          if (!r.ok) { this.ctx.log('Grok rate-limits', modelName, 'HTTP', r.status); continue; }
          const j = await r.json();
          if (!(typeof j.totalQueries === 'number' && j.totalQueries > 0 && typeof j.remainingQueries === 'number')) continue;
          const hours = j.windowSizeSeconds ? Math.round(j.windowSizeSeconds / 3600) : null;
          const resetAt = j.remainingQueries <= 0 && j.waitTimeSeconds ? Date.now() + j.waitTimeSeconds * 1000 : undefined;
          out.push({
            id: modelName,
            label: AM.prettyKey(modelName) + (hours ? ` (${hours}h)` : ''),
            limit: j.totalQueries,
            remaining: j.remainingQueries,
            used: j.totalQueries - j.remainingQueries,
            resetAt,
            source: 'real',
            // the model she's actually using drives the pill; the others sit underneath
            secondary: !!this.lastModel && !this.lastModel.includes(modelName),
          });
        } catch (e) {
          this.ctx.log('Grok rate-limits', modelName, 'failed:', e.message);
        }
      }
      if (out.length) { this.limits = out; this.publish(); }
    },

    publish() {
      this.ctx.report('real', [...this.limits, ...this.credits]);
    },

    parseCredits(bytes) {
      // Debug only: the raw gRPC-web payload (numbers only, no chat text) so the parsed % can be checked against Grok's own UI.
      const { meters, error } = AM.parseGrokCredits(bytes);
      this.ctx.log('Grok credits parsed:', meters.length ? meters.map((m) => `${m.label} ${m.pct}%`).join(', ') : error,
        '| raw', bytes.length, 'bytes:', Array.from(bytes.slice(0, 160), (b) => b.toString(16).padStart(2, '0')).join(' '));
      // Grok Build credit pool: shown only when it really reports usage, and never as the main meter (it isn't chat usage).
      this.credits = meters.filter((m) => !m.inferred).map((m) => ({ ...m, label: 'Grok Build credits (weekly)', secondary: true }));
      if (meters.length) this.publish();
      else this.ctx.log('Grok credits parse:', error);
    },
  });
})();
