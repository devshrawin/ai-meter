// Gemini: Google exposes no usage numbers. Counts prompts locally, tagged with the
// model shown in the mode picker so Pro/Thinking can be tracked separately (estimate).
(() => {
  const AM = globalThis.AIMeter;
  const PICKER = [
    '[data-test-id="bard-mode-menu-button"]',
    'bard-mode-switcher button',
    'button[aria-label*="mode" i]',
    'button[aria-haspopup="menu"][class*="model"]',
  ];

  AM.register({
    id: 'gemini',
    name: 'Gemini',
    hosts: ['gemini.google.com'],

    init(ctx) {
      this.est = AM.estimator(ctx, 'gemini');
      ctx.onRequest((d) => {
        if (d.method === 'POST' && /StreamGenerate/.test(d.url)) this.est.record(this.model());
      });
      this.est.refresh();
      setInterval(() => ctx.visible() && this.est.refresh(), 60000);
    },

    model() {
      for (const sel of PICKER) {
        const t = document.querySelector(sel)?.textContent?.trim();
        if (t && t.length < 60) return t;
      }
      return '';
    },

    refresh() { this.est.refresh(); },
  });
})();
