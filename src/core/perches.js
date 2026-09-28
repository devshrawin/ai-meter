// Where Iris can perch on each site's page. Content-script only (touches the DOM).
//
// AM.PERCHES holds per-site selectors verified by inspecting the live site. Each entry may define:
//   composer       chat input box container (main perch; she stands on its top edge)
//   composerInput  the text input itself, when its visible box has no stable selector; the finder
//                  climbs from it to the styled container
//   replying       () => boolean: is the AI generating right now (from the send/stop button)
//   lastMessage    assistant message bubbles (the last visible one is used)
//   header         top bar / title area (she stands on its bottom edge, when there's room)
//   limitBanner    the site's own usage / limit warning
// Selectors are comma-separated lists; the first visible match wins. Anything not mapped, and
// user-added sites, fall back to the generic finders below.
(() => {
  const AM = globalThis.AIMeter;

  // Verified 2026-09-28 by inspecting each site's live DOM while signed out (desktop, 1280x800).
  // Only states visible without sending a message could be seen: stop buttons and reply bubbles
  // weren't observed, so `replying` and `lastMessage` fall back to the generic checks except where
  // the page itself declares them. Not mapped: claude, deepseek, copilot, poe (sign-in walls) and
  // mistral (Cloudflare bot check).
  AM.PERCHES = {
    chatgpt: {
      composer: 'form:has([data-composer-submit])',
      header: 'header[data-desktop-header], header[data-mobile-header]',
      // The submit button declares both labels (data-send-label / data-stop-label) and swaps its
      // aria-label between them, so this works in any UI language.
      replying: () => {
        const b = document.querySelector('button[data-composer-submit]');
        return !!b && !!b.getAttribute('data-stop-label') && b.getAttribute('aria-label') === b.getAttribute('data-stop-label');
      },
    },
    gemini: { composer: '[data-node-type="input-area"], input-area-v2', header: 'top-bar-actions' },
    grok: { composer: 'form[data-composer] .query-bar' },
    perplexity: { composerInput: '#ask-input' },
    kimi: { composer: '[data-testid="chat-editor"]' },
    qwen: { composer: '.message-input-container', header: 'header.header-desktop' },
    meta: { composerInput: 'input[aria-label="Ask Meta AI"]' },
  };

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  AM.isVisible = visible;

  const query = (sel, pickLast) => {
    if (!sel) return null;
    let found = null;
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('[data-aimeter]') || !visible(el)) continue;
      found = el;
      if (!pickLast) break;
    }
    return found;
  };

  const editableSel = 'textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"], input[type="text"]';

  // Widen a text input to its styled container (the box the user sees), but never to something
  // that fills the page.
  function styledBox(input, minWidth) {
    let best = input;
    let el = best;
    for (let i = 0; i < 6 && el.parentElement; i++) {
      el = el.parentElement;
      const r = el.getBoundingClientRect();
      if (r.height > innerHeight * 0.45 || r.width > innerWidth * 0.98) break;
      const cs = getComputedStyle(el);
      const styled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 ||
        cs.boxShadow !== 'none' || parseFloat(cs.borderRadius) > 4;
      if (styled && r.width >= best.getBoundingClientRect().width) best = el;
    }
    return best.getBoundingClientRect().width >= minWidth ? best : null;
  }

  // The chat box: the lowest visible text input on the page, widened to its styled container.
  function genericComposer(minWidth) {
    const inputs = [...document.querySelectorAll(editableSel)]
      .filter((el) => !el.closest('[data-aimeter]') && visible(el));
    if (!inputs.length) return null;
    inputs.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return styledBox(inputs[0], minWidth);
  }

  function genericHeader() {
    return query('header, [role="banner"]');
  }

  // Find the element for a perch kind on the current site.
  AM.findPerch = (kind, siteId, minWidth) => {
    const map = AM.PERCHES[siteId] || {};
    if (kind === 'lastMessage') return query(map.lastMessage, true);
    const el = query(map[kind]);
    if (el) return el;
    if (kind === 'composer') {
      const input = query(map.composerInput);
      return (input && styledBox(input, minWidth)) || genericComposer(minWidth);
    }
    if (kind === 'header') return genericHeader();
    if (kind === 'limitBanner') return AM.lastLimitEl && visible(AM.lastLimitEl) ? AM.lastLimitEl : null;
    return null;
  };

  // Is the AI still replying? Uses the site's stop button when mapped; otherwise "the page is still
  // changing" (DOM mutations outside our widget within the last 2.5s).
  let lastMutation = 0;
  let observing = false;
  const observe = () => {
    if (observing || !document.body) return;
    observing = true;
    new MutationObserver((muts) => {
      for (const m of muts) {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (t && !t.closest('[data-aimeter]')) { lastMutation = Date.now(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  AM.isReplying = (siteId) => {
    const map = AM.PERCHES[siteId] || {};
    if (map.replying) return map.replying();
    observe();
    return Date.now() - lastMutation < 2500;
  };
  AM.watchMutations = observe;

  // Recently typing in an editable field?
  let lastTyped = 0;
  addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(TEXTAREA|INPUT)$/.test(t.tagName))) lastTyped = Date.now();
  }, true);
  AM.recentlyTyped = (ms = 5000) => Date.now() - lastTyped < ms;
})();
