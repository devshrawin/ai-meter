// Small draggable on-page meter, isolated in a shadow root so site CSS can't touch it.
// The pill stays mounted between updates so the cat's animations aren't restarted on every refresh.
(() => {
  const AM = globalThis.AIMeter;
  const POS_KEY = 'aimeter.pos';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    .wrap { --bg: #ffffff; --fg: #1c1917; --muted: #78716c; --line: #e7e5e4; --track: #f0eeec;
      --low: #16a34a; --mid: #d97706; --high: #dc2626; --none: #a8a29e;
      --fur: #f2a65a; --fur-dark: #d9823a; --ink: #3b2a22; --pink: #f58fb1;
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px; color: var(--fg); }
    @media (prefers-color-scheme: dark) {
      .wrap { --bg: #1c1b1a; --fg: #f5f5f4; --muted: #a8a29e; --line: #3a3836; --track: #2e2c2a; }
    }
    .pill { position: relative; display: flex; align-items: center; gap: 7px; padding: 4px 10px 4px 8px; border-radius: 999px;
      background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 10px rgba(0,0,0,.12);
      font-size: 12px; line-height: 1; cursor: grab; user-select: none; white-space: nowrap; touch-action: none; }
    .pill.has-pet { padding-left: 4px; }
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

    /* --- cat --- */
    .pet { position: relative; width: 26px; height: 22px; flex: none; cursor: pointer; }
    .pet svg { width: 26px; height: 22px; overflow: visible; display: block; }
    .cat { transform-origin: 50% 90%; animation: breathe 3.2s ease-in-out infinite; }
    .fur { fill: var(--fur); } .fur-line { stroke: var(--fur); fill: none; stroke-width: 2.6; stroke-linecap: round; }
    .ink { fill: var(--ink); } .ink-line { stroke: var(--ink); fill: none; stroke-width: 0.9; stroke-linecap: round; }
    .pink { fill: var(--pink); }
    .stripe { stroke: var(--fur-dark); stroke-width: 0.9; stroke-linecap: round; fill: none; }
    .tail { transform-origin: 21px 19px; animation: sway 2.6s ease-in-out infinite alternate; }
    .eyes-open { transform-box: fill-box; transform-origin: center; animation: blink 5s infinite; }
    .eyes-shut, .eyes-joy, .sweat, .z { display: none; }
    .blush { opacity: .55; }
    .ear-l, .ear-r { transform-box: fill-box; transition: transform .4s; }
    .ear-l { transform-origin: 100% 100%; } .ear-r { transform-origin: 0% 100%; }

    .pet[data-mood="worried"] .blush { opacity: 0; }
    .pet[data-mood="worried"] .ear-l { transform: rotate(-12deg); }
    .pet[data-mood="worried"] .ear-r { transform: rotate(12deg); }
    .pet[data-mood="stressed"] .blush { opacity: 0; }
    .pet[data-mood="stressed"] .sweat { display: inline; animation: drip 1.6s ease-in infinite; }
    .pet[data-mood="stressed"] .ear-l { transform: rotate(-22deg); }
    .pet[data-mood="stressed"] .ear-r { transform: rotate(22deg); }
    .pet[data-mood="stressed"] .tail { animation-duration: .9s; }
    .pet[data-mood="sleep"] .eyes-open { display: none; }
    .pet[data-mood="sleep"] .eyes-shut { display: inline; }
    .pet[data-mood="sleep"] .z { display: block; }
    .pet[data-mood="sleep"] .cat { animation-duration: 5s; }
    .pet[data-mood="sleep"] .tail { animation: none; transform: rotate(18deg); }
    .pet.awake .eyes-open { display: inline; } .pet.awake .eyes-shut { display: none; } .pet.awake .z { display: none; }
    .pet.joy .eyes-open, .pet.joy .eyes-shut { display: none; }
    .pet.joy .eyes-joy { display: inline; }
    .pet.joy .blush { opacity: .9; }

    .pet.hop svg { animation: hop .6s cubic-bezier(.3,1.6,.5,1); }
    .pet.purr svg { animation: purr .08s linear 8; }
    .pet.spin svg { animation: spin .7s ease-in-out; }
    .pet.stretch svg { animation: stretch .9s ease-in-out; }

    .z { position: absolute; font-size: 8px; font-weight: 700; color: var(--muted); pointer-events: none; }
    .z1 { right: -3px; top: -4px; animation: zz 2.4s ease-in-out infinite; }
    .z2 { right: -8px; top: -9px; font-size: 6px; animation: zz 2.4s ease-in-out 1.2s infinite; }
    .fx { position: absolute; left: 50%; top: 0; pointer-events: none; font-size: 11px; font-weight: 700; color: var(--pink);
      animation: floatUp 1s ease-out forwards; white-space: nowrap; }

    @keyframes breathe { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.02,.975); } }
    @keyframes blink { 0%,93%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes sway { from { transform: rotate(-10deg); } to { transform: rotate(14deg); } }
    @keyframes drip { 0% { transform: translateY(0); opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(4px); opacity: 0; } }
    @keyframes hop { 0% { transform: translateY(0) scale(1,1); } 20% { transform: translateY(1px) scale(1.12,.86); }
      55% { transform: translateY(-9px) scale(.94,1.08); } 85% { transform: translateY(0) scale(1.06,.94); } 100% { transform: none; } }
    @keyframes purr { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } }
    @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes stretch { 0%,100% { transform: scale(1,1); } 40% { transform: scale(1.25,.8) translateY(2px); } 70% { transform: scale(.92,1.1); } }
    @keyframes zz { 0% { opacity: 0; transform: translate(0,3px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(4px,-5px); } }
    @keyframes floatUp { 0% { opacity: 0; transform: translate(-50%, 0) scale(.6); } 20% { opacity: 1; transform: translate(-50%,-6px) scale(1.1); }
      100% { opacity: 0; transform: translate(calc(-50% + var(--dx, 0px)), -24px) scale(1); } }
    @media (prefers-reduced-motion: reduce) {
      .pet *, .pet svg { animation: none !important; transition: none !important; }
      .fx { animation: none; transform: translate(-50%, -14px); }
    }
  `;

  const CAT_SVG = `
    <svg viewBox="0 0 28 24" aria-hidden="true">
      <g class="cat">
        <path class="tail fur-line" d="M21 19 C26.5 19.5 27.5 13.5 24.6 10.6"/>
        <path class="fur ear-l" d="M5.2 10.5 L6.6 2.4 L11.6 7.2 Z"/>
        <path class="fur ear-r" d="M22.8 10.5 L21.4 2.4 L16.4 7.2 Z"/>
        <path class="pink" d="M6.9 8.3 L7.5 4.7 L9.8 6.9 Z"/>
        <path class="pink" d="M21.1 8.3 L20.5 4.7 L18.2 6.9 Z"/>
        <ellipse class="fur" cx="14" cy="13.6" rx="9.6" ry="8.1"/>
        <path class="stripe" d="M14 6 v2.2 M11.6 6.5 l.6 1.8 M16.4 6.5 l-.6 1.8"/>
        <g class="eyes-open ink"><ellipse cx="10.3" cy="13" rx="1.25" ry="1.7"/><ellipse cx="17.7" cy="13" rx="1.25" ry="1.7"/>
          <circle cx="10.7" cy="12.4" r=".4" fill="#fff"/><circle cx="18.1" cy="12.4" r=".4" fill="#fff"/></g>
        <g class="eyes-shut ink-line"><path d="M9 13.2 q1.3 1.1 2.6 0"/><path d="M16.4 13.2 q1.3 1.1 2.6 0"/></g>
        <g class="eyes-joy ink-line"><path d="M9 13.8 q1.3 -1.8 2.6 0"/><path d="M16.4 13.8 q1.3 -1.8 2.6 0"/></g>
        <ellipse class="pink blush" cx="7.9" cy="16.3" rx="1.4" ry=".85"/>
        <ellipse class="pink blush" cx="20.1" cy="16.3" rx="1.4" ry=".85"/>
        <path class="pink" d="M13.1 15.5 h1.8 l-.9 1 z"/>
        <path class="ink-line" d="M12.3 17.1 q.85 .85 1.7 0 q.85 .85 1.7 0"/>
        <path class="ink-line" d="M4.5 15.2 h3 M4.8 17 l2.8 -.6 M23.5 15.2 h-3 M23.2 17 l-2.8 -.6" stroke-width=".55"/>
        <path class="sweat" fill="#7cc4ff" d="M22.8 5.6 q1.5 2.4 0 3.2 q-1.5 -.8 0 -3.2z"/>
      </g>
    </svg>
    <span class="z z1">z</span><span class="z z2">z</span>`;

  let host = null;
  let root = null;
  let panelBox = null;
  let pill = null;
  let info = null;
  let pet = null;
  let dot = null;
  let expanded = false;
  let petOn = null;
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

  // --- cat behaviour ---
  const moodFor = (pct) => (pct == null || pct < 75 ? 'happy' : pct < 90 ? 'worried' : pct < 100 ? 'stressed' : 'sleep');
  let clicks = [];
  let reacting = false;

  function particle(text, dx = 0, delay = 0) {
    setTimeout(() => {
      if (!pet) return;
      const p = el('span', 'fx', text);
      p.style.setProperty('--dx', dx + 'px');
      pet.append(p);
      setTimeout(() => p.remove(), 1100);
    }, delay);
  }

  const REACTIONS = ['hop', 'purr', 'stretch', 'spin', 'joy', 'awake'];
  let doneTimer = null;

  function react() {
    if (!pet) return;
    const now = Date.now();
    // Count every click, even mid-reaction, so a burst can trigger the special one.
    clicks = clicks.filter((t) => now - t < 4000).concat(now);
    const burst = clicks.length >= 8 && pet.dataset.mood !== 'sleep';
    if (reacting && !burst) return;
    clearTimeout(doneTimer);
    pet.classList.remove(...REACTIONS);
    void pet.offsetWidth; // restart CSS animation if the same class is re-added
    reacting = true;
    const done = (cls, ms) => { doneTimer = setTimeout(() => { pet && pet.classList.remove(...REACTIONS); reacting = false; }, ms); };

    if (pet.dataset.mood === 'sleep') {
      pet.classList.add('awake', 'stretch');
      particle(['!', '5 more min…', 'mrrp?'][Math.floor(Math.random() * 3)]);
      return done('stretch', 1400);
    }
    if (burst) {
      clicks = [];
      pet.classList.add('joy', 'spin');
      ['♥', '♥', '♥'].forEach((h, i) => particle(h, (i - 1) * 10, i * 120));
      particle('nya~!', 0, 250);
      return done('spin', 1300);
    }
    const pick = [
      () => { pet.classList.add('joy', 'hop'); particle('♥'); return 'hop'; },
      () => { pet.classList.add('joy', 'purr'); particle('prrr'); return 'purr'; },
      () => { pet.classList.add('joy', 'stretch'); particle('mew'); return 'stretch'; },
      () => { pet.classList.add('joy', 'hop'); particle('♥', -6); particle('♥', 6, 150); return 'hop'; },
    ];
    const cls = pick[Math.floor(Math.random() * pick.length)]();
    done(cls, 1000);
  }

  function buildPill() {
    pill.textContent = '';
    pill.classList.toggle('has-pet', petOn);
    pet = dot = null;
    if (petOn) {
      pet = el('span', 'pet');
      pet.innerHTML = CAT_SVG;
      pet.title = 'Pet me';
      pill.append(pet);
    } else {
      dot = el('span', 'dot');
      pill.append(dot);
    }
    info = el('span', 'info');
    pill.append(info);
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
    const wrap = el('div', 'wrap');
    panelBox = el('div');
    pill = el('div', 'pill');
    pill.title = 'AI Meter — click for details, drag to move';
    attachDrag(pill);
    wrap.append(panelBox, pill);
    root.append(style, wrap);
    document.body.appendChild(host);
    petOn = null;
    ticker = setInterval(render, 30000);
  }

  function unmount() {
    if (host) host.remove();
    host = root = panelBox = pill = info = pet = dot = null;
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
      else if (start.onPet) react();
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

    if (pet) pet.dataset.mood = moodFor(topPct);
    if (dot) dot.className = 'dot ' + AM.level(topPct);
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
  }

  AM.widget = {
    update(name, meters, settings, chat) {
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
      const wantPet = settings.pet !== false;
      if (wantPet !== petOn) {
        petOn = wantPet;
        buildPill();
      }
      render();
    },
  };
})();
