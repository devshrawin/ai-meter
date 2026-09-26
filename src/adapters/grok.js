// Grok: since mid-2026 usage is one weekly percentage pool, served as gRPC-web protobuf from
// GrokBuildBilling/GetGrokCreditsConfig (real). Messages are sent over the /ws/mgw WebSocket.
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
    },

    parseCredits(bytes) {
      const { meters, error } = AM.parseGrokCredits(bytes);
      if (meters.length) this.ctx.report('real', meters);
      else this.ctx.log('Grok credits parse:', error);
    },
  });
})();
