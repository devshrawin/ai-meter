// Small draggable on-page meter, isolated in a shadow root so site CSS can't touch it.
// The pill stays mounted between updates so Iris (pet.js) isn't reset on every refresh.
(() => {
  const AM = globalThis.AIMeter;
  const POS_KEY = 'aimeter.pos';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    .wrap { --bg: #ffffff; --fg: #1c1917; --muted: #78716c; --line: #e7e5e4; --track: #f0eeec;
      --low: #16a34a; --mid: #d97706; --high: #dc2626; --none: #a8a29e;
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px; color: var(--fg); }
    .wrap.with-pet { gap: 30px; padding-top: 22px; }
    @media (prefers-color-scheme: dark) {
      .wrap { --bg: #1c1b1a; --fg: #f5f5f4; --muted: #a8a29e; --line: #3a3836; --track: #2e2c2a; }
    }
    .pill { position: relative; display: flex; align-items: center; gap: 7px; padding: 5px 10px 5px 8px; border-radius: 999px;
      background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 10px rgba(0,0,0,.12);
      font-size: 12px; line-height: 1; cursor: grab; user-select: none; white-space: nowrap; touch-action: none; }
    .pill:active { cursor: grabbing; }
    .info { display: flex; align-items: center; gap: 7px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--none); flex: none; }
    .dot.low { background: var(--low); } .dot.mid { background: var(--mid); } .dot.high { background: var(--high); }
    .muted { color: var(--muted); }
    .panel { width: 270px; padding: 10px 12px; border-radius: 12px; background: var(--bg);
      border: 1px solid var(--line); box-shadow: 0 6px 24px rgba(0,0,0,.16); font-size: 12px; }
    .panel h4 { margin: 0 0 8px; font-size: 12px; font-weight: 600; display: flex; justify-content: space-between; }
    .row { margin: 8px 0; }
    .row .top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .bar { height: 5px; border-radius: 3px; background: var(--track); overflow: hidden; }
    .fill { height: 100%; background: var(--none); border-radius: 3px; }
    .fill.low { background: var(--low); } .fill.mid { background: var(--mid); } .fill.high { background: var(--high); }
    .sub { display: flex; justify-content: space-between; margin-top: 3px; font-size: 11px; color: var(--muted); }
    .tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--line); color: var(--muted); }
    .empty { color: var(--muted); }
    .sep { width: 1px; height: 12px; background: var(--line); }
    .cache.on { color: var(--low); } .cache.soon { color: var(--mid); } .cache.off { color: var(--muted); }
    .chat { margin: 2px 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
    .chat-h { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
    .kv { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
    .kv span:last-child { text-align: right; }
    .note { font-size: 11px; color: var(--muted); margin-top: 4px; }
  ` + AM.PET_CSS;

  let host = null;
  let root = null;
  let wrap = null;
  let panelBox = null;
  let pill = null;
  let info = null;
  let dot = null;
  let pet = null;
  let petOn = false;
  let expanded = false;
  let last = { name: 'AI Meter', meters: [], chat: null };
  let ticker = null;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const loadPos = () => {
    try { return JSON.parse(localStorage.getItem(POS_KEY)) || null; } catch { return null; }
  };
  const savePos = (p) => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
  };

  const moodFor = (pct) => (pct == null || pct < 75 ? 'happy' : pct < 90 ? 'worried' : pct < 100 ? 'stressed' : 'sleep');

  function setPet(on) {
    if (on === petOn && (!on || pet)) return;
    petOn = on;
    wrap.classList.toggle('with-pet', on);
    if (pet) pet.destroy();
    pet = on ? AM.createPet(pill, host) : null;
  }

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('div');
    host.setAttribute('data-aimeter', '');
    const pos = loadPos() || { right: 16, bottom: 16 };
    host.style.cssText = `position:fixed;right:${pos.right}px;bottom:${pos.bottom}px;z-index:2147483646;`;
    root = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = CSS;
    wrap = el('div', 'wrap');
    panelBox = el('div');
    pill = el('div', 'pill');
    pill.title = 'AI Meter — click for details, drag to move';
    dot = el('span', 'dot');
    info = el('span', 'info');
    pill.append(dot, info);
    attachDrag(pill);
    wrap.append(panelBox, pill);
    root.append(style, wrap);
    document.body.appendChild(host);
    petOn = false;
    ticker = setInterval(render, 30000);
  }

  function unmount() {
    if (pet) pet.destroy();
    if (host) host.remove();
    host = root = wrap = panelBox = pill = info = dot = pet = null;
    petOn = false;
    clearInterval(ticker);
  }

  function attachDrag(target) {
    let start = null;
    target.addEventListener('pointerdown', (e) => {
      const r = host.getBoundingClientRect();
      const onPet = !!(e.target && e.target.closest && e.target.closest('.pet'));
      start = { x: e.clientX, y: e.clientY, right: innerWidth - r.right, bottom: innerHeight - r.bottom, moved: false, onPet };
      try { target.setPointerCapture(e.pointerId); } catch {}
    });
    target.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      start.moved = true;
      host.style.right = Math.max(0, Math.min(innerWidth - 60, start.right - dx)) + 'px';
      host.style.bottom = Math.max(0, Math.min(innerHeight - 30, start.bottom - dy)) + 'px';
    });
    target.addEventListener('pointerup', () => {
      if (!start) return;
      if (start.moved) savePos({ right: parseInt(host.style.right, 10), bottom: parseInt(host.style.bottom, 10) });
      else if (start.onPet && pet) pet.react();
      else { expanded = !expanded; render(); }
      start = null;
    });
  }

  function cacheState(chat, now) {
    const left = chat.cachedUntil ? chat.cachedUntil - now : null;
    if (left == null) return { cls: 'off', short: 'no cache', long: 'Not cached' };
    if (left <= 0) return { cls: 'off', short: 'cache expired', long: 'Expired — next message re-reads the whole chat' };
    const d = AM.formatDuration(left);
    return { cls: left < 10 * 60e3 ? 'soon' : 'on', short: 'cached ' + d, long: `Cached for ${d}` };
  }
  // Only Claude has a cache model; other sites leave cachedUntil undefined.
  const hasCache = (chat) => chat && chat.cachedUntil !== undefined;

  function chatSection(chat, now) {
    const box = el('div', 'chat');
    box.append(el('div', 'chat-h', 'This chat'));
    const line = (k, v, cls) => {
      const r = el('div', 'kv');
      r.append(el('span', 'muted', k), el('span', cls || null, v));
      box.append(r);
    };
    line('Length', `≈ ${chat.tokens.toLocaleString()} tokens · ${chat.messages} msgs`);
    let cachedNow = false;
    if (hasCache(chat)) {
      const c = cacheState(chat, now);
      cachedNow = c.cls !== 'off';
      line('Cache', c.long, 'cache ' + c.cls);
    }
    if (chat.nextCost != null) line('Next message', `≈ ${chat.nextCost.toLocaleString()} tokens${cachedNow ? ' (rest cached)' : ''}`);
    if (chat.note) box.append(el('div', 'note', chat.note));
    return box;
  }

  function renderPanel(meters, now) {
    panelBox.textContent = '';
    if (!expanded) return;
    const panel = el('div', 'panel');
    const h = el('h4');
    h.append(el('span', null, last.name), el('span', 'muted', 'AI Meter'));
    panel.append(h);
    if (last.chat) panel.append(chatSection(last.chat, now));
    if (!meters.length) panel.append(el('div', 'empty', 'No usage data yet. Send a message or open usage settings.'));
    for (const m of meters) {
      const pct = AM.pctOf(m);
      const row = el('div', 'row');
      const t = el('div', 'top');
      t.append(el('span', null, m.label), el('span', null, AM.meterValue(m)));
      const bar = el('div', 'bar');
      const fill = el('div', 'fill ' + AM.level(pct));
      fill.style.width = (pct ?? 0) + '%';
      bar.append(fill);
      const sub = el('div', 'sub');
      sub.append(el('span', null, AM.resetText(m, now)), el('span', 'tag', m.source));
      row.append(t, bar, sub);
      panel.append(row);
    }
    panelBox.append(panel);
  }

  function render() {
    if (!root) return;
    const meters = AM.sortMeters(last.meters);
    const now = Date.now();
    const top = AM.primaryMeter(meters);
    const topPct = top ? AM.pctOf(top) : null;
    renderPanel(meters, now);

    dot.className = 'dot ' + AM.level(topPct);
    info.textContent = '';
    if (!top) {
      info.append(el('span', null, last.name), el('span', 'muted', '—'));
    } else {
      info.append(el('span', null, last.name), el('span', null, topPct != null ? Math.round(topPct) + '%' : AM.meterValue(top)));
      const rt = top.resetAt ? AM.formatDuration(top.resetAt - now) : '';
      if (rt) info.append(el('span', 'muted', '· ' + rt));
    }
    if (last.chat) {
      info.append(el('span', 'sep'), el('span', null, AM.fmtTokens(last.chat.tokens) + ' tok'));
      if (hasCache(last.chat)) {
        const c = cacheState(last.chat, now);
        info.append(el('span', 'cache ' + c.cls, c.short));
      }
    }
    if (pet) {
      pet.setMood(moodFor(topPct));
      pet.nudge();
    }
  }

  AM.widget = {
    destroy: unmount,
    update(name, meters, settings, chat) {
      if (AM.dead) return;
      last = { name, meters, chat: chat || null };
      if (!settings.widget) return unmount();
      if (!host) {
        if (!document.body) {
          document.addEventListener('DOMContentLoaded', () => AM.widget.update(name, last.meters, settings, last.chat), { once: true });
          return;
        }
        mount();
      } else if (!host.isConnected && document.body) {
        document.body.appendChild(host);
      }
      setPet(settings.pet !== false);
      render();
    },
  };
})();
