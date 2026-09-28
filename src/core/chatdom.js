// Per-chat stats read from the page's own rendered messages — works signed in or out, no API calls.
(() => {
  const AM = globalThis.AIMeter;

  // cfg: { selector, ratio (tokens per char), systemTokens?, next?(tokens) → tokens, note? }
  AM.watchDomChat = (ctx, cfg) => {
    let lastKey = '';
    const run = () => {
      if (!ctx.visible()) return;
      const nodes = document.querySelectorAll(cfg.selector);
      if (!nodes.length) {
        if (lastKey !== 'none') {
          lastKey = 'none';
          ctx.setChat(null);
        }
        return;
      }
      let chars = 0;
      for (const n of nodes) chars += (n.textContent || '').length;
      const tokens = Math.ceil(chars * cfg.ratio) + (cfg.systemTokens || 0);
      const key = `${location.pathname}:${nodes.length}:${tokens}`;
      if (key === lastKey) return;
      lastKey = key;
      ctx.setChat({
        tokens,
        messages: nodes.length,
        nextCost: cfg.next ? cfg.next(tokens) : undefined,
        note: cfg.note,
      });
    };
    run();
    setInterval(run, 4000);
  };
})();
