// Watches for the provider's own "you've hit your limit" / "N messages remaining" notices.
(() => {
  const AM = globalThis.AIMeter;

  // Only wording a site uses to tell *you* you're blocked. Bare phrases like "rate limit" or
  // "usage limit" are excluded: they turn up in ordinary conversation (e.g. chatting about limits).
  const LIMIT_RE = /(you['’]ve (hit|reached|used up) (your|the)\b|you have (hit|reached) (your|the)\b|\blimit reached\b|reached (your|the) (usage |message |daily |weekly )?limit|out of (free )?messages|usage limit (reached|exceeded)|too many (requests|messages)[.,!]? (please )?(try|wait))/i;
  const REMAINING_RE = /\b(\d+)\s+(messages?|prompts?|queries|requests)\s+(remaining|left)\b/i;
  // Chat content, inputs and code blocks: text there is conversation, not a notice.
  const SKIP = [
    '[data-message-author-role]', '[data-testid*="message"]', '[data-test-render-count]', '[data-is-streaming]',
    '.markdown', '.prose', '[class*="markdown"]', '.font-claude-message', '.font-claude-response',
    '.font-user-message', '[contenteditable]', 'textarea', 'pre', 'code', 'article', '[role="article"]',
    'message-content', 'user-query', 'model-response', '.model-response-text', '.query-text',
  ].join(',');
  const MAX_PENDING = 400;

  AM.banner = {
    watch(ctx) {
      const pending = new Set();
      let timer = null;

      const check = () => {
        timer = null;
        const nodes = [...pending];
        pending.clear();
        for (const n of nodes) {
          const el = n.nodeType === 1 ? n : n.parentElement;
          if (!el || !el.isConnected || el.closest(SKIP)) continue;
          const text = (el.textContent || '').trim();
          if (!text || text.length > 300) continue;
          if (LIMIT_RE.test(text)) {
            ctx.log('limit notice', text);
            AM.lastLimitEl = el;
            AM.emit('limit', { el });
            ctx.report('banner', [{
              id: 'banner', label: 'Limit reached', pct: 100, source: 'banner',
              resetAt: AM.parseReset(text), seenAt: Date.now(), note: text.slice(0, 160),
            }]);
            return;
          }
          const rem = text.match(REMAINING_RE);
          if (rem) {
            ctx.log('remaining notice', text);
            ctx.report('banner', [{
              id: 'banner', label: 'Remaining (notice)', remaining: Number(rem[1]), source: 'banner',
              resetAt: AM.parseReset(text), seenAt: Date.now(), note: text.slice(0, 160),
            }]);
            return;
          }
        }
      };

      new MutationObserver((muts) => {
        for (const m of muts) {
          if (pending.size >= MAX_PENDING) break;
          if (m.type === 'characterData') pending.add(m.target);
          else m.addedNodes.forEach((n) => pending.add(n));
        }
        if (!timer && pending.size) timer = setTimeout(check, 600);
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    },
  };
})();
