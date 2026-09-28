// Small draggable on-page meter, isolated in a shadow root so site CSS can't touch it.
(() => {
  const AM = globalThis.AIMeter;
  const POS_KEY = 'aimeter.pos';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    .wrap { --bg: #ffffff; --fg: #1c1917; --muted: #78716c; --line: #e7e5e4; --track: #f0eeec;
      --low: #16a34a; --mid: #d97706; --high: #dc2626; --none: #a8a29e;
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px; color: var(--fg); }
    @media (prefers-color-scheme: dark) {
      .wrap { --bg: #1c1b1a; --fg: #f5f5f4; --muted: #a8a29e; --line: #3a3836; --track: #2e2c2a; }
    }
    .pill { display: flex; align-items: center; gap: 7px; padding: 5px 10px 5px 8px; border-radius: 999px;
      background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 10px rgba(0,0,0,.12);
      font-size: 12px; line-height: 1; cursor: grab; user-select: none; white-space: nowrap; }
    .pill:active { cursor: grabbing; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--none); flex: none; }
    .dot.low { background: var(--low); } .dot.mid { background: var(--mid); } .dot.high { background: var(--high); }
    .muted { color: var(--muted); }
    .panel { width: 260px; padding: 10px 12px; border-radius: 12px; background: var(--bg);
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
  `;

  let host = null;
  let root = null;
  let expanded = false;
  let last = { name: 'AI Meter', meters: [] };
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

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('div');
    host.setAttribute('data-aimeter', '');
    const pos = loadPos() || { right: 16, bottom: 16 };
    host.style.cssText = `position:fixed;right:${pos.right}px;bottom:${pos.bottom}px;z-index:2147483646;`;
    root = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = CSS;
    root.append(style, el('div', 'wrap'));
    document.body.appendChild(host);
    ticker = setInterval(render, 30000);
  }

  function unmount() {
    if (host) host.remove();
    host = root = null;
    clearInterval(ticker);
  }

  function attachDrag(pill) {
    let start = null;
    pill.addEventListener('pointerdown', (e) => {
      const r = host.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, right: innerWidth - r.right, bottom: innerHeight - r.bottom, moved: false };
      try { pill.setPointerCapture(e.pointerId); } catch {}
    });
    pill.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      start.moved = true;
      const right = Math.max(0, Math.min(innerWidth - 60, start.right - dx));
      const bottom = Math.max(0, Math.min(innerHeight - 30, start.bottom - dy));
      host.style.right = right + 'px';
      host.style.bottom = bottom + 'px';
    });
    pill.addEventListener('pointerup', () => {
      if (!start) return;
      if (start.moved) savePos({ right: parseInt(host.style.right, 10), bottom: parseInt(host.style.bottom, 10) });
      else { expanded = !expanded; render(); }
      start = null;
    });
  }

  function render() {
    if (!root) return;
    const wrap = root.querySelector('.wrap');
    wrap.textContent = '';
    const { name } = last;
    const meters = AM.sortMeters(last.meters);
    const now = Date.now();
    const top = AM.primaryMeter(meters);
    const topPct = top ? AM.pctOf(top) : null;

    if (expanded) {
      const panel = el('div', 'panel');
      const h = el('h4');
      h.append(el('span', null, name), el('span', 'muted', 'AI Meter'));
      panel.append(h);
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
      wrap.append(panel);
    }

    const pill = el('div', 'pill');
    pill.title = 'AI Meter — click for details, drag to move';
    pill.append(el('span', 'dot ' + AM.level(topPct)));
    if (!top) {
      pill.append(el('span', null, name), el('span', 'muted', '—'));
    } else {
      pill.append(el('span', null, name), el('span', null, topPct != null ? Math.round(topPct) + '%' : AM.meterValue(top)));
      const rt = top.resetAt ? AM.formatDuration(top.resetAt - now) : '';
      if (rt) pill.append(el('span', 'muted', '· ' + rt));
    }
    attachDrag(pill);
    wrap.append(pill);
  }

  AM.widget = {
    update(name, meters, settings) {
      last = { name, meters };
      if (!settings.widget) return unmount();
      if (!host) {
        if (!document.body) {
          document.addEventListener('DOMContentLoaded', () => { mount(); render(); }, { once: true });
          return;
        }
        mount();
      } else if (!host.isConnected && document.body) {
        document.body.appendChild(host);
      }
      render();
    },
  };
})();
