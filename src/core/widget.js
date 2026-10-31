// Small draggable on-page meter, isolated in a shadow root so site CSS can't touch it.
// The pill stays mounted between updates so Iris (pet.js) isn't reset on every refresh.
// Look and tokens: the Headroom meter redesign (levels = glyph + colour + bar pattern, source tags = three shapes).
(() => {
  const AM = globalThis.AIMeter;
  const POS_KEY = 'aimeter.pos';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: inherit; }
    .wrap { --hr-bg: #f7f6fc; --hr-surf: #ffffff; --hr-text: #1f1d2b; --hr-muted: #5c5873; --hr-accent: #5b3fbf;
      --hr-line: #d9d6e6; --hr-edge: #8e8aa3; --hr-track: #e8e5f2;
      --hr-ok: #16794a; --hr-close: #a85a00; --hr-crit: #c42b2b; --hr-crit-2: #8f1d1d; --hr-empty: #7d1d3f; --hr-unk: #6b6880;
      --hr-real-bg: #3d3566; --hr-real-fg: #ffffff; --hr-ban-bg: #fff1dc; --hr-ban-fg: #7a3d00; --hr-ban-line: #a85a00; --hr-prob-bg: #fff6e8;
      --hr-shadow: 0 0 0 1px rgba(31,29,43,.04), 0 6px 18px -6px rgba(60,48,120,.30);
      --hr-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      --hr-bar-h: 6px; --hr-bar-h-hover: 10px;
      --hr-dur-fast: 120ms; --hr-dur-med: 200ms; --hr-dur-fill: 600ms; --hr-ease: cubic-bezier(.2,.8,.2,1);
      display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 6px; color: var(--hr-text); font-family: var(--hr-font); }
    .wrap.with-pet { gap: 74px; padding-top: 70px; }
    @media (prefers-color-scheme: dark) {
      .wrap { --hr-bg: #14121c; --hr-surf: #1e1b29; --hr-text: #eeebf7; --hr-muted: #aaa5c0; --hr-accent: #bba8ff;
        --hr-line: #34304a; --hr-edge: #6a6585; --hr-track: #2c283d;
        --hr-ok: #4fd18b; --hr-close: #f5b544; --hr-crit: #ff7b7b; --hr-crit-2: #ffb3b3; --hr-empty: #ff9fc0; --hr-unk: #9a96b0;
        --hr-real-bg: #d9d0ff; --hr-real-fg: #14121c; --hr-ban-bg: #3a2a12; --hr-ban-fg: #ffd9a3; --hr-ban-line: #f5b544; --hr-prob-bg: #2a2216;
        --hr-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 8px 22px -6px rgba(0,0,0,.65); }
    }
    @media (prefers-reduced-motion: reduce) { .wrap { --hr-dur-fast: 0ms; --hr-dur-med: 0ms; --hr-dur-fill: 0ms; } }
    .lv-ok { color: var(--hr-ok); } .lv-close { color: var(--hr-close); } .lv-crit { color: var(--hr-crit); }
    .lv-empty { color: var(--hr-empty); } .lv-unk { color: var(--hr-unk); }
    .g { width: 12px; height: 12px; flex: none; display: block; }
    .glyph { display: inline-flex; flex: none; }

    /* The pill */
    .pill { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 12px 0 10px; border-radius: 999px;
      background: var(--hr-surf); border: 1px solid var(--hr-line); box-shadow: var(--hr-shadow); color: var(--hr-text);
      font-size: 12.5px; font-weight: 600; line-height: 1; cursor: grab; user-select: none; white-space: nowrap; touch-action: none; }
    .pill:active { cursor: grabbing; }
    .pill:focus-visible, .btn:focus-visible { outline: 2px solid var(--hr-accent); outline-offset: 2px; }
    .info { display: inline-flex; align-items: center; gap: 7px; }
    .pct { font-variant-numeric: tabular-nums; font-weight: 700; }
    .sub { color: var(--hr-muted); font-weight: 500; }
    .sep { width: 1px; height: 14px; background: var(--hr-line); }
    .cache { display: inline-flex; align-items: center; gap: 3px; color: var(--hr-accent); font-weight: 600; }

    /* Source tags: three shapes, never colour alone */
    .tag { display: inline-flex; align-items: center; gap: 3px; height: 18px; padding: 0 6px; border-radius: 5px; font-size: 10.5px; font-weight: 700;
      letter-spacing: .02em; white-space: nowrap; }
    .t-real { background: var(--hr-real-bg); color: var(--hr-real-fg); }
    .t-est { border: 1px dashed var(--hr-edge); color: var(--hr-muted); }
    .t-ban { background: var(--hr-ban-bg); color: var(--hr-ban-fg); border: 1px solid var(--hr-ban-line); }

    /* The panel */
    .panel { width: 280px; background: var(--hr-surf); border: 1px solid var(--hr-line); border-radius: 14px; box-shadow: var(--hr-shadow);
      padding: 14px 14px 12px; font-size: 12.5px; line-height: 1.4; color: var(--hr-text); text-align: left; }
    .ph { display: flex; justify-content: space-between; align-items: center; margin: 0 0 10px; }
    .nm { font-size: 14px; font-weight: 700; }
    .brand { font-size: 11.5px; font-weight: 700; color: var(--hr-accent); }
    .sec { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--hr-muted); margin: 0 0 4px; }
    .kv { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    .kv span:last-child { text-align: right; }
    .k { color: var(--hr-muted); }
    .hint { color: var(--hr-muted); font-size: 11.5px; margin: 4px 0 0; }
    .rule { height: 1px; background: var(--hr-line); margin: 11px 0; }
    .empty { color: var(--hr-muted); }
    .row { margin: 0 0 11px; }
    .rt { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 600; }
    .v { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-weight: 700; }
    .bar { position: relative; height: 6px; border-radius: 3px; background: var(--hr-track); margin: 6px 0 5px; overflow: hidden; }
    /* the 75% and 90% notches are gaps cut out of the bar, so the page behind shows through */
    .notched { -webkit-mask-image: linear-gradient(90deg, #000 calc(75% - 1px), transparent calc(75% - 1px), transparent calc(75% + 1px), #000 calc(75% + 1px), #000 calc(90% - 1px), transparent calc(90% - 1px), transparent calc(90% + 1px), #000 calc(90% + 1px));
      mask-image: linear-gradient(90deg, #000 calc(75% - 1px), transparent calc(75% - 1px), transparent calc(75% + 1px), #000 calc(75% + 1px), #000 calc(90% - 1px), transparent calc(90% - 1px), transparent calc(90% + 1px), #000 calc(90% + 1px)); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; transition: width var(--hr-dur-fill) var(--hr-ease); }
    .f-ok { background: var(--hr-ok); } .f-close { background: var(--hr-close); } .f-empty { background: var(--hr-empty); }
    .f-crit { background: repeating-linear-gradient(135deg, var(--hr-crit) 0 3px, var(--hr-crit-2) 3px 6px); }
    .f-unk { background: repeating-linear-gradient(90deg, var(--hr-unk) 0 8px, transparent 8px 16px); }
    .rm { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11.5px; color: var(--hr-muted); }
    .btn { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--hr-edge);
      background: var(--hr-bg); color: var(--hr-text); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn:hover { border-color: var(--hr-accent); }
    .foot { display: flex; justify-content: flex-end; }
    .iris-face { width: 14px; height: auto; transition: filter var(--hr-dur-med), opacity var(--hr-dur-med); }
    .iris-btn.away .iris-face { filter: grayscale(1); opacity: .6; }
    .prob { border: 1px solid var(--hr-ban-line); background: var(--hr-prob-bg); border-radius: 10px; padding: 10px 12px; }
    .pt { display: flex; align-items: center; gap: 6px; font-weight: 700; margin: 0 0 2px; }
    .prob p { margin: 0 0 8px; color: var(--hr-muted); font-size: 11.5px; word-break: break-word; }
    .prob .btn { background: var(--hr-surf); }

    /* Bar style: a thin full-width bar along the top or bottom edge; the label chip shows on hover or focus */
    .wrap.edge { width: 100%; gap: 0; }
    .wrap.edge .pbox { margin: 8px 12px; }
    .pill.edge { align-self: stretch; display: block; width: 100%; height: var(--hr-bar-h); padding: 0; border: 0; border-radius: 0; background: transparent;
      box-shadow: none; cursor: pointer; overflow: visible; transition: height var(--hr-dur-fast); }
    .pill.edge::after { content: ""; position: absolute; left: 0; right: 0; height: 12px; }
    .wrap.edge.bottom .pill.edge::after { bottom: 0; } .wrap.edge.top .pill.edge::after { top: 0; }
    .pill.edge:hover, .pill.edge:focus-visible { height: var(--hr-bar-h-hover); }
    .pill.edge:focus-visible { outline: 0; }
    .wrap.edge.bottom .pill.edge:focus-visible { box-shadow: 0 -2px 0 0 var(--hr-accent); }
    .wrap.edge.top .pill.edge:focus-visible { box-shadow: 0 2px 0 0 var(--hr-accent); }
    .trk { position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: var(--hr-track); overflow: hidden; }
    .pill.edge .fill { border-radius: 0; }
    .pill.edge .f-unk { width: 100% !important; top: 2px; bottom: 2px; }
    .pill.edge .info { position: absolute; left: 50%; transform: translateX(-50%); height: 28px; padding: 0 12px 0 10px; border-radius: 999px; background: var(--hr-surf);
      border: 1px solid var(--hr-line); box-shadow: var(--hr-shadow); pointer-events: none; opacity: 0; transition: opacity var(--hr-dur-fast); }
    .wrap.edge.bottom .pill.edge .info { bottom: 100%; margin-bottom: 10px; }
    .wrap.edge.top .pill.edge .info { top: 100%; margin-top: 10px; }
    .pill.edge:hover .info, .pill.edge:focus-visible .info { opacity: 1; }
    .pill.edge[aria-expanded="true"] .info { opacity: 0; }
  `;

  let host = null;
  let root = null;
  let wrap = null;
  let panelBox = null;
  let pill = null;
  let info = null;
  let pet = null;
  let petOn = false;
  let petPending = false;
  let petCssAdded = false;
  let barMode = null; // 'top' | 'bottom' | null (pill)
  let barFill = null;
  let barTrack = null;
  let styleEl = null;
  let lastSettings = {};
  let expanded = false;
  let last = { name: 'Headroom', meters: [], chat: null, problem: null };
  let ticker = null;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // ---- glyphs (SVG built node by node; no innerHTML) ----
  const node = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const svgOf = (cls, w, h, vb, kids) => {
    const s = node('svg', { viewBox: vb, 'aria-hidden': 'true' });
    if (cls) s.setAttribute('class', cls);
    if (w) { s.setAttribute('width', w); s.setAttribute('height', h); }
    kids.forEach((k) => s.append(k));
    return s;
  };
  const CUR = 'currentColor';
  const GLYPHS = {
    ok: () => [node('circle', { cx: 6, cy: 6, r: 5, fill: CUR })],
    close: () => [node('circle', { cx: 6, cy: 6, r: 4.6, fill: 'none', stroke: CUR, 'stroke-width': 1.6 }), node('path', { d: 'M6 1.4a4.6 4.6 0 0 1 0 9.2z', fill: CUR })],
    crit: () => [node('path', { d: 'M6 .8 11.4 10.6H.6z', fill: CUR })],
    empty: () => [node('rect', { x: 1.2, y: 1.2, width: 9.6, height: 9.6, rx: 1.6, fill: CUR })],
    unk: () => [node('circle', { cx: 6, cy: 6, r: 4.6, fill: 'none', stroke: CUR, 'stroke-width': 1.6, 'stroke-dasharray': '2.4 2' })],
    problem: () => [node('circle', { cx: 6, cy: 6, r: 4.8, fill: 'none', stroke: CUR, 'stroke-width': 1.5 }),
      node('path', { d: 'M6 3.3v3.4', stroke: CUR, 'stroke-width': 1.6, 'stroke-linecap': 'round' }), node('circle', { cx: 6, cy: 8.7, r: 0.9, fill: CUR })],
  };
  const glyph = (kind) => svgOf('g', null, null, '0 0 12 12', GLYPHS[kind]());
  const clock = () => svgOf(null, 11, 11, '0 0 12 12', [node('circle', { cx: 6, cy: 6, r: 4.8, fill: 'none', stroke: CUR, 'stroke-width': 1.4 }),
    node('path', { d: 'M6 3.4V6l1.8 1.2', fill: 'none', stroke: CUR, 'stroke-width': 1.4, 'stroke-linecap': 'round' })]);
  const tick = () => svgOf(null, 9, 9, '0 0 10 10', [node('path', { d: 'M1.5 5.2 4 7.6 8.6 2.6', fill: 'none', stroke: CUR, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
  const flag = () => svgOf(null, 9, 9, '0 0 10 10', [node('path', { d: 'M2 1v8.4', stroke: CUR, 'stroke-width': 1.4, 'stroke-linecap': 'round' }), node('path', { d: 'M2.6 1.2h5.6L6.9 3.3l1.3 2.1H2.6z', fill: CUR })]);
  const glyphBox = (kind, level) => {
    const b = el('span', 'glyph lv-' + (level || 'unk'));
    b.setAttribute('aria-hidden', 'true');
    b.append(glyph(kind));
    return b;
  };

  // usage levels: ok under 75, close 75-89, crit 90-99, empty 100 (or a banner hit), unk = no number
  const levelOf = (m, pct) => (m && m.source === 'banner' ? 'empty' : pct == null ? 'unk' : pct >= 100 ? 'empty' : pct >= 90 ? 'crit' : pct >= 75 ? 'close' : 'ok');
  const LEVEL_WORDS = { ok: 'plenty left', close: 'getting close', crit: 'nearly out', empty: 'limit reached', unk: '' };
  const problemKind = (p) => (p && p.kind === 'signin' ? 'unk' : 'problem');

  const tagEl = (source) => {
    if (source === 'real') { const t = el('span', 'tag t-real'); t.append(tick(), 'real'); return t; }
    if (source === 'estimate') return el('span', 'tag t-est', '≈ estimate');
    if (source === 'banner') { const t = el('span', 'tag t-ban'); t.append(flag(), 'banner'); return t; }
    return null;
  };

  const loadPos = () => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY));
      const ok = (n) => Number.isFinite(n) && n >= -20 && n <= 20000;
      return p && ok(p.right) && ok(p.bottom) ? { right: p.right, bottom: p.bottom } : null;
    } catch { return null; }
  };
  const savePos = (p) => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
  };

  const moodFor = (pct) => (pct == null || pct < 75 ? 'happy' : pct < 90 ? 'worried' : pct < 100 ? 'stressed' : 'sleep');

  // Iris's engine and sprites are loaded into the tab only when she is switched on, and only on the built-in sites
  // (the sprites are web-accessible to those hosts alone; a site added in Settings gets the meter without her).
  const irisAvailable = () => !barMode && (!AM.siteId || !String(AM.siteId).startsWith('site:'));
  let petLoad = null;
  function ensurePet() {
    if (AM.createPet) return Promise.resolve(true);
    if (!petLoad) {
      petLoad = (AM.loadPet ? AM.loadPet() : Promise.reject(new Error('no loader')))
        .then(() => !!AM.createPet, () => false)
        .then((ok) => { if (!ok) petLoad = null; return ok; });
    }
    return petLoad;
  }
  function applyPetSettings() {
    if (!pet) return;
    pet.setExplore(lastSettings.explore !== false);
    if (pet.setEnergy) pet.setEnergy(lastSettings.irisEnergy);
  }

  function setPet(on) {
    if (on && !irisAvailable()) on = false;
    if (on === petOn && (!on || pet || petPending)) return;
    petOn = on;
    const old = pet;
    pet = null;
    if (old) {
      // Sent home: let her say bye and walk off first (bounded, in case the tab is hidden and frames stall).
      const gone = !on && old.leave ? Promise.race([old.leave(), new Promise((r) => setTimeout(r, 4000))]) : Promise.resolve();
      gone.finally(() => { old.destroy(); if (!petOn && wrap) wrap.classList.remove('with-pet'); });
    } else if (!on) {
      wrap.classList.remove('with-pet');
    }
    if (on) {
      wrap.classList.add('with-pet');
      petPending = true;
      ensurePet().then((ok) => {
        petPending = false;
        if (!petOn || pet || !host || !wrap) return;
        if (!ok) { petOn = false; wrap.classList.remove('with-pet'); return; }
        if (!petCssAdded && AM.PET_CSS && styleEl) { styleEl.textContent += AM.PET_CSS; petCssAdded = true; }
        pet = AM.createPet(pill, host);
        applyPetSettings();
        render();
      });
    }
  }

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('div');
    host.setAttribute('data-aimeter', '');
    const ms = lastSettings.meterStyle;
    barMode = ms === 'bar-top' ? 'top' : ms === 'bar-bottom' ? 'bottom' : null;
    const pos = loadPos() || { right: 16, bottom: 16 };
    host.style.cssText = barMode
      ? `position:fixed;left:0;right:0;${barMode}:0;z-index:2147483646;`
      : `position:fixed;right:${pos.right}px;bottom:${pos.bottom}px;z-index:2147483646;`;
    root = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = CSS;
    styleEl = style;
    wrap = el('div', barMode ? 'wrap edge ' + barMode : 'wrap');
    panelBox = el('div', 'pbox');
    pill = el('div', barMode ? 'pill edge' : 'pill');
    pill.title = barMode ? 'Headroom — click for details' : 'Headroom — click for details, drag to move';
    pill.setAttribute('role', 'button');
    pill.tabIndex = 0;
    pill.setAttribute('aria-expanded', 'false');
    info = el('span', 'info');
    barFill = null;
    barTrack = null;
    if (barMode) { barTrack = el('span', 'trk'); barFill = el('span', 'fill'); barTrack.append(barFill); pill.append(barTrack); }
    pill.append(info);
    attachDrag(pill);
    attachKeys(pill);
    wrap.append(pill, panelBox);
    root.append(style, wrap);
    document.body.appendChild(host);
    petOn = false;
    ticker = setInterval(render, 30000);
  }

  function unmount() {
    if (pet) pet.destroy();
    if (host) host.remove();
    host = root = wrap = panelBox = pill = info = pet = barFill = barTrack = null;
    barMode = null;
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
      if (!start || barMode) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      // Dragging Iris herself picks her up and carries her (the pill stays put).
      if (start.onPet) {
        if (!start.carrying && Math.hypot(dx, dy) >= 6 && pet && pet.grab) start.carrying = pet.grab(e.clientX, e.clientY);
        if (start.carrying) { start.moved = true; pet.carry(e.clientX, e.clientY); }
        return;
      }
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      if (!start.moved && pet) pet.setDragging(true);
      start.moved = true;
      host.style.right = Math.max(0, Math.min(innerWidth - 60, start.right - dx)) + 'px';
      host.style.bottom = Math.max(0, Math.min(innerHeight - 30, start.bottom - dy)) + 'px';
    });
    const end = (e) => {
      if (!start) return;
      if (start.carrying) {
        if (pet) pet.drop(e && e.clientX, e && e.clientY);
      } else if (start.moved) {
        savePos({ right: parseInt(host.style.right, 10), bottom: parseInt(host.style.bottom, 10) });
        if (pet) pet.setDragging(false);
      } else if (start.onPet && pet) pet.react();
      else { expanded = !expanded; render(); }
      start = null;
    };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', () => {
      if (start && start.carrying && pet) pet.drop();
      else if (start && start.moved && pet) pet.setDragging(false);
      start = null;
    });
  }

  function attachKeys(target) {
    target.addEventListener('keydown', (e) => {
      if (e.target !== target) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        expanded = !expanded;
        render();
      } else if (e.key === 'Escape' && expanded) {
        e.preventDefault();
        expanded = false;
        render();
      } else if (!barMode && e.shiftKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        e.preventDefault();
        const step = 16;
        const cur = { right: parseFloat(host.style.right) || 0, bottom: parseFloat(host.style.bottom) || 0 };
        const dx = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
        const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        const right = Math.max(0, Math.min(innerWidth - 60, cur.right + dx));
        const bottom = Math.max(0, Math.min(innerHeight - 30, cur.bottom + dy));
        host.style.right = right + 'px';
        host.style.bottom = bottom + 'px';
        savePos({ right, bottom });
      }
    });
  }

  function cacheState(chat, now) {
    const left = chat.cachedUntil ? chat.cachedUntil - now : null;
    if (left == null) return { cls: 'off', dur: '', long: 'Not cached' };
    if (left <= 0) return { cls: 'off', dur: '', long: 'Expired — next message re-reads the whole chat' };
    const d = AM.formatDuration(left);
    return { cls: left < 10 * 60e3 ? 'soon' : 'on', dur: d, long: `Cached for ${d}` };
  }
  // Only Claude has a cache model; other sites leave cachedUntil undefined.
  const hasCache = (chat) => chat && chat.cachedUntil !== undefined;
  const cacheChip = (text) => {
    const c = el('span', 'cache');
    c.append(clock(), text);
    return c;
  };

  function chatSection(chat, now) {
    const box = el('div', 'chat');
    box.append(el('p', 'sec', 'This chat'));
    const line = (k, v) => {
      const r = el('div', 'kv');
      r.append(el('span', 'k', k), typeof v === 'string' ? el('span', null, v) : v);
      box.append(r);
    };
    line('Length', `≈ ${chat.tokens.toLocaleString()} tokens · ${chat.messages} msgs`);
    let cachedNow = false;
    if (hasCache(chat)) {
      const c = cacheState(chat, now);
      cachedNow = c.cls !== 'off';
      line('Cache', cachedNow ? cacheChip(c.long) : el('span', 'k', c.long));
    }
    if (chat.nextCost != null) line('Next message', `≈ ${chat.nextCost.toLocaleString()} tokens${cachedNow ? ' (rest cached)' : ''}`);
    if (chat.note) box.append(el('p', 'hint', chat.note));
    box.append(el('div', 'rule'));
    return box;
  }

  function problemBox(p) {
    const d = AM.describeProblem(p);
    const box = el('div', 'prob');
    box.setAttribute('role', 'status');
    const title = el('p', 'pt');
    title.append(glyphBox(problemKind(p)), d.title);
    box.append(title, el('p', null, d.detail));
    if (AM.copyDiagnostics) {
      const btn = el('button', 'btn', 'Copy debug log');
      btn.type = 'button';
      btn.title = 'Copies what Headroom saw on this page (request addresses and shapes, never message text)';
      btn.setAttribute('aria-live', 'polite');
      btn.addEventListener('click', async () => {
        const ok = await AM.copyDiagnostics();
        btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
        setTimeout(() => { btn.textContent = 'Copy debug log'; }, 2000);
      });
      box.append(btn);
    }
    return box;
  }

  function limitRow(m, now) {
    const pct = AM.pctOf(m);
    const level = levelOf(m, pct);
    const value = AM.meterValue(m);
    const row = el('div', 'row');
    const rt = el('div', 'rt');
    const v = el('span', pct != null ? 'v lv-' + level : 'v');
    if (pct != null) v.append(glyph(level), Math.round(pct) + '%');
    else v.textContent = value;
    rt.append(el('span', null, m.label), v);
    row.append(rt);
    const reset = AM.resetText(m, now);
    if (pct != null) {
      const bar = el('div', level === 'empty' ? 'bar' : 'bar notched');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', m.label);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      bar.setAttribute('aria-valuetext', value + (reset ? ', ' + reset : ''));
      const fill = el('i', 'fill f-' + level);
      fill.style.width = pct + '%';
      bar.append(fill);
      row.append(bar);
    }
    // "3 / 160" style counts stay visible when the headline is a percentage
    const lead = pct != null && !/%$/.test(value) ? value : '';
    const rm = el('div', 'rm');
    rm.style.marginTop = pct != null ? '' : '4px';
    rm.append(el('span', null, [lead, reset].filter(Boolean).join(' · ')));
    const tag = tagEl(m.source);
    if (tag) rm.append(tag);
    row.append(rm);
    return row;
  }

  function renderPanel(meters, now) {
    panelBox.textContent = '';
    if (!expanded) return;
    const panel = el('div', 'panel');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', last.name + ' usage details');
    const h = el('div', 'ph');
    h.setAttribute('role', 'heading');
    h.setAttribute('aria-level', '2');
    h.append(el('span', 'nm', last.name), el('span', 'brand', 'Headroom'));
    panel.append(h);
    if (last.chat) panel.append(chatSection(last.chat, now));
    if (last.problem) panel.append(problemBox(last.problem));
    else if (!meters.length) panel.append(el('div', 'empty', 'No usage data yet. Send a message or open usage settings.'));
    for (const m of meters) panel.append(limitRow(m, now));
    if (AM.setSetting && irisAvailable()) {
      panel.append(el('div', 'rule'));
      const foot = el('div', 'foot');
      const btn = el('button', 'btn iris-btn' + (petOn ? '' : ' away'));
      btn.type = 'button';
      btn.title = petOn ? 'Iris goes home and the meter stays' : 'Iris comes back to the meter';
      const face = el('img', 'iris-face');
      face.alt = '';
      try { face.src = chrome.runtime.getURL('src/assets/iris/sit.webp'); } catch {}
      btn.append(face, el('span', null, petOn ? 'Send Iris home' : 'Bring Iris back'));
      btn.addEventListener('click', () => AM.setSetting('pet', !petOn));
      foot.append(btn);
      panel.append(foot);
    }
    panelBox.append(panel);
  }

  const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

  function render() {
    if (!root) return;
    const meters = AM.sortMeters(last.meters);
    const now = Date.now();
    const top = AM.primaryMeter(meters);
    const topPct = top ? AM.pctOf(top) : null;
    const level = top ? levelOf(top, topPct) : 'unk';
    const desc = last.problem ? AM.describeProblem(last.problem) : null;
    renderPanel(meters, now);

    // spoken summary
    pill.setAttribute('aria-expanded', String(expanded));
    {
      let say;
      if (!top) say = desc ? lowerFirst(desc.title) : 'no usage data yet';
      else {
        say = topPct != null ? Math.round(topPct) + '% used' + (LEVEL_WORDS[level] ? ', ' + LEVEL_WORDS[level] : '') : AM.meterValue(top);
        const left = top.resetAt ? AM.formatDuration(top.resetAt - now) : '';
        if (left) say += ', resets in ' + left;
        if (desc) say += '. ' + desc.title;
      }
      const act = expanded ? 'Close details.' : 'Open details.';
      pill.setAttribute('aria-label', barMode ? `Headroom: ${last.name} ${say}. ${act}` : `${last.name}: ${say}. ${act}`);
    }

    // the bar itself
    if (barFill) {
      const unk = topPct == null;
      barFill.className = 'fill f-' + (unk ? 'unk' : level);
      barFill.style.width = (unk ? 100 : topPct) + '%';
      barTrack.className = !unk && level !== 'empty' ? 'trk notched' : 'trk';
    }

    // pill content / bar label chip
    info.textContent = '';
    const gKind = !top ? (desc ? problemKind(last.problem) : 'unk') : level === 'unk' ? 'unk' : level;
    info.append(glyphBox(gKind, level));
    info.append(el('span', null, last.name));
    if (!top) {
      info.append(el('span', 'sub', desc ? desc.pill : 'no data yet'));
    } else if (topPct != null) {
      info.append(el('span', 'pct lv-' + level, Math.round(topPct) + '%'));
    } else {
      info.append(el('span', 'pct', AM.meterValue(top)));
    }
    if (top && topPct != null) {
      const rt = top.resetAt ? AM.formatDuration(top.resetAt - now) : '';
      if (barMode) { if (rt) info.append(el('span', 'sub', '· resets in ' + rt)); }
      else if (rt && level !== 'ok') info.append(el('span', 'sub', '· ' + rt)); // the reset time only matters from "close" up
    }
    if (desc && top) {
      const flagBox = glyphBox('problem', 'unk');
      flagBox.title = desc.title;
      info.append(flagBox);
    }
    if (barMode) {
      if (!top && desc) info.lastChild.textContent = lowerFirst(desc.title);
      const tag = top && topPct != null ? tagEl(top.source) : null;
      if (tag) info.append(tag);
    } else if (last.chat) {
      const sep = el('span', 'sep');
      sep.setAttribute('aria-hidden', 'true');
      info.append(sep, el('span', 'sub', AM.fmtTokens(last.chat.tokens) + ' tok'));
      if (hasCache(last.chat)) {
        const c = cacheState(last.chat, now);
        if (c.cls !== 'off') info.append(cacheChip(c.dur));
      }
    }
    if (pet) {
      pet.setMood(moodFor(topPct));
      pet.nudge();
    }
  }

  AM.widget = {
    destroy: unmount,
    get pet() { return pet; }, // for debugging from the console: AIMeter.widget.pet.play('yarn')
    update(name, meters, settings, chat, problem) {
      if (AM.dead) return;
      last = { name, meters, chat: chat || null, problem: problem || null };
      if (!settings.widget) return unmount();
      const wanted = settings.meterStyle === 'bar-top' || settings.meterStyle === 'bar-bottom' ? settings.meterStyle : 'pill';
      if (host && lastSettings.meterStyle !== undefined && wanted !== (lastSettings.meterStyle || 'pill')) unmount();
      lastSettings = settings;
      if (!host) {
        if (!document.body) {
          document.addEventListener('DOMContentLoaded', () => AM.widget.update(name, last.meters, settings, last.chat, last.problem), { once: true });
          return;
        }
        mount();
      } else if (!host.isConnected && document.body) {
        document.body.appendChild(host);
      }
      setPet(settings.pet !== false);
      applyPetSettings();
      render();
    },
  };
})();
