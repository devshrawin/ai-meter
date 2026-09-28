// Claude: reads the same usage endpoint that powers Settings > Usage (real numbers),
// plus per-chat length / cache / next-message estimates from the open conversation.
(() => {
  const AM = globalThis.AIMeter;
  const LABELS = {
    five_hour: 'Session (5h)',
    seven_day: 'Weekly',
    seven_day_opus: 'Weekly · Opus',
    seven_day_sonnet: 'Weekly · Sonnet',
    seven_day_oauth_apps: 'Weekly · Apps',
  };
  const USAGE_RE = /\/api\/organizations\/([^/]+)\/usage(\?|$)/;

  AM.register({
    id: 'claude',
    name: 'Claude',
    hosts: ['claude.ai'],

    init(ctx) {
      this.ctx = ctx;
      this.org = null;
      ctx.onResponse((d) => {
        const m = d.url.match(USAGE_RE);
        if (m && d.status === 200) {
          this.org = m[1];
          this.parse(AM.safeJSON(d.body));
        }
      });
      ctx.onRequest((d) => {
        if (d.method === 'POST' && /\/completion(\?|$)/.test(d.url)) {
          AM.emit('send');
          clearTimeout(this.t1);
          clearTimeout(this.t2);
          this.t1 = setTimeout(() => this.refresh(), 5000);
          this.t2 = setTimeout(() => this.refresh(), 45000);
        }
      });
      this.refresh();
      setInterval(() => ctx.visible() && this.refresh(), 60000);
      document.addEventListener('visibilitychange', () => ctx.visible() && this.refresh());
      // claude.ai is a single-page app: watch for switching chats.
      this.path = location.pathname;
      setInterval(() => {
        if (location.pathname !== this.path) {
          this.path = location.pathname;
          this.refreshChat();
        }
      }, 1000);
    },

    chatId() {
      return (location.pathname.match(/\/chat\/([0-9a-f-]{36})/i) || [])[1] || null;
    },

    async refreshChat() {
      const id = this.chatId();
      if (!id) return this.ctx.setChat(null);
      try {
        const org = await this.orgId();
        const conv = await this.ctx.getJSON(
          `/api/organizations/${org}/chat_conversations/${id}?tree=True&rendering_mode=messages&render_all_tools=true`);
        if (id === this.chatId()) this.ctx.setChat(AM.claudeChatStats(conv));
      } catch (e) {
        this.ctx.log('chat fetch failed:', e.message);
      }
    },

    async orgId() {
      if (this.org) return this.org;
      const c = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
      if (c) return (this.org = decodeURIComponent(c[1]));
      const orgs = await this.ctx.getJSON('/api/organizations');
      const list = Array.isArray(orgs) ? orgs : [];
      const pick = list.find((o) => (o.capabilities || []).includes('chat')) || list[0];
      if (!pick) throw new Error('no organization');
      return (this.org = pick.uuid || pick.id);
    },

    async refresh() {
      this.refreshChat();
      try {
        const org = await this.orgId();
        this.parse(await this.ctx.getJSON(`/api/organizations/${org}/usage`));
      } catch (e) {
        this.ctx.log('usage fetch failed:', e.message);
        if (/^40[134]/.test(e.message)) this.org = null;
      }
    },

    parse(j) {
      if (!j || typeof j !== 'object') return;
      const meters = [];
      for (const [k, v] of Object.entries(j)) {
        if (!v || typeof v !== 'object' || typeof v.utilization !== 'number') continue;
        // Unused buckets come back as 0% with no reset time; hide until they start counting.
        if (v.utilization === 0 && !v.resets_at && !LABELS[k]) continue;
        meters.push({
          id: k,
          label: LABELS[k] || AM.prettyKey(k),
          pct: v.utilization,
          resetAt: AM.toTime(v.resets_at),
          source: 'real',
        });
      }
      if (meters.length) this.ctx.report('real', meters);
      else this.ctx.log('usage response had no utilization fields', j);
    },
  });
})();
