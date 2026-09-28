// Gemini: real 5h + weekly usage from the batchexecute RPC behind gemini.google.com/usage (jSf9Qc).
// Replay params (at, bl, f.sid) come from the app's own batchexecute calls or the page's WIZ_global_data.
(() => {
  const AM = globalThis.AIMeter;
  const RPC = 'jSf9Qc';

  AM.register({
    id: 'gemini',
    name: 'Gemini',
    hosts: ['gemini.google.com'],
    preferReal: true,

    init(ctx) {
      this.ctx = ctx;
      this.p = {};
      this.est = AM.estimator(ctx, 'gemini');
      ctx.onRequest((d) => {
        if (/\/batchexecute/.test(d.url)) this.remember(d);
        if (d.method === 'POST' && /StreamGenerate/.test(d.url)) {
          this.est.record('');
          clearTimeout(this.t);
          this.t = setTimeout(() => this.refresh(), 6000);
        }
      });
      ctx.onResponse((d) => {
        if (d.url.includes(RPC) && d.status === 200) this.parse(d.body);
      });
      this.est.refresh();
      this.refresh();
      setInterval(() => ctx.visible() && this.refresh(), 120000);
      AM.watchDomChat(ctx, {
        selector: 'user-query, model-response',
        ratio: 0.25,
        // Gemini's limits are compute-based and each turn re-reads the whole chat.
        next: (tokens) => tokens,
        note: 'Longer chats use more of your Gemini limit',
      });
    },

    remember(d) {
      try {
        const u = new URL(d.url);
        for (const [k, key] of [['bl', 'bl'], ['f.sid', 'fSid'], ['hl', 'hl'], ['rt', 'rt']]) {
          const v = u.searchParams.get(k);
          if (v) this.p[key] = v;
        }
        const at = d.body && new URLSearchParams(d.body).get('at');
        if (at) this.p.at = at;
      } catch {}
    },

    fromPage() {
      const html = document.documentElement.innerHTML;
      const grab = (k) => (html.match(new RegExp(`"${k}":"([^"]+)"`)) || [])[1];
      return { at: grab('SNlM0e'), bl: grab('cfb2h'), fSid: grab('FdrFJe') };
    },

    async refresh() {
      this.est.refresh();
      const page = this.p.at && this.p.bl && this.p.fSid ? {} : this.fromPage();
      const p = { ...page, ...this.p };
      if (!p.at || !p.bl || !p.fSid) return this.ctx.log('Gemini replay params missing (at/bl/f.sid)');
      const authuser = (location.pathname.match(/^\/u\/(\d+)/) || [])[1] || '0';
      const prefix = authuser === '0' ? '' : `/u/${authuser}`;
      const url = new URL(`${location.origin}${prefix}/_/BardChatUi/data/batchexecute`);
      url.searchParams.set('rpcids', RPC);
      url.searchParams.set('source-path', `${prefix}/usage`);
      url.searchParams.set('bl', p.bl);
      url.searchParams.set('f.sid', p.fSid);
      url.searchParams.set('hl', p.hl || document.documentElement.lang || 'en');
      url.searchParams.set('_reqid', String(100000 + Math.floor(Math.random() * 800000)));
      url.searchParams.set('rt', p.rt || 'c');
      url.searchParams.set('authuser', authuser);
      const body = new URLSearchParams();
      body.set('f.req', JSON.stringify([[[RPC, '[]', null, 'generic']]]));
      body.set('at', p.at);
      try {
        const r = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-goog-authuser': authuser },
          body: body.toString() + '&',
        });
        if (!r.ok) throw new Error(`${r.status}`);
        this.parse(await r.text());
      } catch (e) {
        this.ctx.log('Gemini usage RPC failed:', e.message);
      }
    },

    parse(text) {
      const { meters, error } = AM.parseGeminiUsage(text);
      if (meters.length) this.ctx.report('real', meters);
      else this.ctx.log('Gemini usage parse:', error);
    },
  });
})();
