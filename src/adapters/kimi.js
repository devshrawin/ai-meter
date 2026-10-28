// Kimi: MembershipService/GetSubscription → balances[].amountUsedRatio (real). Connect-RPC JSON.
(() => {
  const AM = globalThis.AIMeter;
  const SUB_PATH = '/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscription';

  AM.register({
    id: 'kimi',
    name: 'Kimi',
    hosts: ['kimi.com'],
    preferReal: true,

    init(ctx) {
      this.ctx = ctx;
      this.est = AM.estimator(ctx, 'kimi');
      ctx.onResponse((d) => {
        if (d.url.includes('GetSubscription') && d.status === 200) this.parse(AM.safeJSON(d.body));
      });
      ctx.onRequest((d) => {
        if (!AM.looksLikeSend(d) || /membership|billing/i.test(d.url)) return;
        this.est.record('');
      });
      this.est.refresh();
      this.refresh();
      setInterval(() => ctx.visible() && this.refresh(), 120000);
    },

    parse(j) {
      const meters = AM.parseKimiUsage(j);
      if (meters.length) this.ctx.report('real', meters);
      else { this.ctx.log('Kimi subscription had no balances'); this.ctx.problem('error', 'The subscription response had no usage balances'); }
    },

    // The endpoint wants a Bearer token; the web app keeps it in the kimi-auth cookie.
    async refresh() {
      this.est.refresh();
      const tok = (document.cookie.match(/(?:^|;\s*)kimi-auth=([^;]+)/) || [])[1];
      if (!tok) {
        this.ctx.log('kimi-auth cookie not readable; waiting for the app to load its subscription');
        return this.ctx.problem('error', 'Not signed in, or the sign-in cookie is not readable here');
      }
      try {
        this.parse(await this.ctx.getJSON(SUB_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'connect-protocol-version': '1', authorization: 'Bearer ' + decodeURIComponent(tok) },
          body: '{}',
        }));
      } catch (e) {
        this.ctx.log('Kimi subscription fetch failed:', e.message);
        this.ctx.problem(AM.errIsAuth(e) ? 'signin' : 'error', AM.errIsAuth(e) ? '' : 'Subscription request failed: ' + AM.errText(e));
      }
    },
  });
})();
