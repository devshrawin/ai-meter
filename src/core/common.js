// Pure helpers shared by content scripts, popup and tests. No chrome.* or DOM access here.
(() => {
  const AM = (globalThis.AIMeter = globalThis.AIMeter || { adapters: [] });
  const HOUR = 3600e3;

  AM.register = (adapter) => AM.adapters.push(adapter);

  AM.safeJSON = (s) => {
    if (s == null) return null;
    if (typeof s === 'object') return s;
    try { return JSON.parse(s); } catch { return null; }
  };

  const clamp = (n) => Math.max(0, Math.min(100, n));

  AM.pctOf = (m) => {
    if (typeof m.pct === 'number' && isFinite(m.pct)) return clamp(m.pct);
    if (m.limit > 0 && typeof m.used === 'number') return clamp((m.used / m.limit) * 100);
    if (m.limit > 0 && typeof m.remaining === 'number') return clamp(((m.limit - m.remaining) / m.limit) * 100);
    return null;
  };

  // hint 'rel' = a number means "seconds from now".
  AM.toTime = (v, hint, now = Date.now()) => {
    if (v == null || v === '') return undefined;
    if (typeof v === 'string') {
      if (/^\d+(\.\d+)?$/.test(v.trim())) return AM.toTime(Number(v), hint, now);
      const t = Date.parse(v);
      return isNaN(t) ? undefined : t;
    }
    if (typeof v !== 'number' || !isFinite(v)) return undefined;
    if (v > 1e12) return v;
    if (v > 1e9 && hint !== 'rel') return v * 1000;
    return now + v * 1000;
  };

  AM.prettyKey = (k) =>
    String(k)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'limit';

  const REM_RE = /^(remaining|left)|remaining$|_left$|Left$/i;
  const TOT_RE = /^(total|limit|max|quota|cap)(_?queries|_?count)?$/i;
  const RESET_RE = /^(resets?_?(at|after|in|time)|reset[A-Z]\w*|wait_?time_?seconds|retry_?after)$/i;

  const resetOf = (o, now) => {
    for (const [k, v] of Object.entries(o)) {
      if (!RESET_RE.test(k)) continue;
      const t = AM.toTime(v, /wait|retry|after|_in$|In$/i.test(k) ? 'rel' : 'auto', now);
      if (t) return t;
    }
    return undefined;
  };

  const keyLabel = (k) => AM.prettyKey(k.replace(/^(remaining|left)_?|_?(remaining|left)$/gi, ''));

  // Walks any JSON blob and pulls out objects that look like quota counters.
  AM.findLimits = (json, opts = {}) => {
    const out = [];
    const now = opts.now || Date.now();
    const source = opts.source || 'real';
    const walk = (node, parentKey, depth) => {
      if (!node || typeof node !== 'object' || depth > 6) return;
      if (Array.isArray(node)) {
        node.forEach((n) => walk(n, parentKey, depth + 1));
        return;
      }
      const remKeys = Object.keys(node).filter((k) => REM_RE.test(k) && typeof node[k] === 'number');
      if (remKeys.length) {
        const totKey = remKeys.length === 1 ? Object.keys(node).find((k) => TOT_RE.test(k) && typeof node[k] === 'number') : null;
        const named = node.feature_name || node.name || node.model || node.modelName || node.title;
        for (const rk of remKeys) {
          const generic = /^(remaining|left)(_?queries|_?count)?$/i.test(rk);
          const label =
            (depth === 0 && opts.label) ||
            (named ? AM.prettyKey(named) : generic ? (parentKey ? AM.prettyKey(parentKey) : 'Limit') : keyLabel(rk));
          const m = { id: slug(label) + (out.some((o) => o.id === slug(label)) ? '-' + out.length : ''), label, remaining: node[rk], source };
          if (totKey) {
            m.limit = node[totKey];
            m.used = node[totKey] - node[rk];
          }
          const reset = resetOf(node, now);
          if (reset) m.resetAt = reset;
          out.push(m);
        }
      }
      for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') walk(v, k, depth + 1);
    };
    walk(json, opts.parentKey || '', 0);
    return out;
  };

  // Rolling-window counts of locally recorded sends.
  AM.countMeters = (events, rules, now = Date.now()) => {
    const compiled = (rules || []).map((r) => {
      let re;
      try { re = new RegExp(r.pattern || '.*', 'i'); } catch { re = /.*/; }
      return { ...r, re, hits: [] };
    });
    for (const e of events || []) {
      const r = compiled.find((c) => c.re.test(e.m || ''));
      if (r && now - e.t < r.windowHours * HOUR) r.hits.push(e.t);
    }
    return compiled
      .map((r) => ({
        id: r.id,
        label: r.label,
        used: r.hits.length,
        limit: r.limit > 0 ? r.limit : undefined,
        resetAt: r.hits.length ? Math.min(...r.hits) + r.windowHours * HOUR : undefined,
        windowHours: r.windowHours,
        source: 'estimate',
      }))
      .filter((m) => m.used > 0 || m.limit);
  };

  // Pulls a reset time out of banner text like "resets at 5:00 PM" or "try again in 3 hours".
  AM.parseReset = (text, now = Date.now()) => {
    if (!text) return undefined;
    const rel = text.match(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i);
    if (rel) {
      const n = Number(rel[1]);
      const unit = rel[2].toLowerCase();
      const mult = unit.startsWith('d') ? 24 * HOUR : unit.startsWith('h') ? HOUR : 60e3;
      return now + n * mult;
    }
    const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/i);
    const h24 = !ampm && text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!ampm && !h24) return undefined;
    let h = Number((ampm || h24)[1]);
    const min = Number((ampm || h24)[2] || 0);
    if (ampm) {
      const pm = ampm[3].toLowerCase() === 'p';
      if (h === 12) h = pm ? 12 : 0;
      else if (pm) h += 12;
    }
    const d = new Date(now);
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  };

  AM.formatDuration = (ms) => {
    if (ms == null || !isFinite(ms)) return '';
    if (ms <= 0) return 'now';
    const m = Math.ceil(ms / 60e3);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 48) return h + 'h ' + (m % 60) + 'm';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  };

  AM.meterValue = (m) => {
    const pct = AM.pctOf(m);
    if (m.limit > 0 && typeof m.used === 'number') return `${m.used} / ${m.limit}`;
    if (typeof m.remaining === 'number') return `${m.remaining} left`;
    if (pct != null) return Math.round(pct) + '%';
    if (typeof m.used === 'number') return `${m.used} used`;
    return '';
  };

  AM.resetText = (m, now = Date.now()) => {
    if (!m.resetAt) return '';
    const d = AM.formatDuration(m.resetAt - now);
    return m.source === 'estimate' ? `next frees in ${d}` : `resets in ${d}`;
  };

  AM.level = (pct) => (pct == null ? 'none' : pct >= 90 ? 'high' : pct >= 75 ? 'mid' : 'low');

  AM.topMeter = (meters) => {
    let top = null;
    for (const m of meters || []) {
      const p = AM.pctOf(m);
      if (p != null && (top == null || p > AM.pctOf(top))) top = m;
    }
    return top || (meters && meters[0]) || null;
  };
})();
