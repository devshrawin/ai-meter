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

  // Window length in hours, from explicit data or the meter's id/label; unknown sorts between day and week.
  AM.windowHours = (m) => {
    if (m.windowHours > 0) return m.windowHours;
    const s = `${m.id} ${m.label}`.toLowerCase();
    if (/five_hour|session/.test(s)) return 5;
    const h = s.match(/(\d+)\s*h\b/);
    if (h) return Number(h[1]);
    if (/week|seven_day|7d/.test(s)) return 168;
    if (/month|30d/.test(s)) return 720;
    return 100;
  };

  // What the pill and badge show: the shortest-window (session) limit, unless another limit is already
  // exhausted — then that one, since it's what's actually blocking.
  AM.primaryMeter = (meters) => {
    const all = (meters || []).filter((m) => AM.pctOf(m) != null || m.remaining != null || m.used != null);
    // Secondary meters (model-specific buckets) only drive the pill if nothing else is available.
    const main = all.filter((m) => !m.secondary);
    const list = main.length ? main : all;
    if (!list.length) return (meters && meters[0]) || null;
    const blocked = list.filter((m) => AM.pctOf(m) >= 100);
    const pool = blocked.length ? blocked : list;
    return pool.reduce((best, m) => {
      const a = AM.windowHours(m);
      const b = AM.windowHours(best);
      if (a !== b) return a < b ? m : best;
      return (AM.pctOf(m) ?? -1) > (AM.pctOf(best) ?? -1) ? m : best;
    });
  };

  AM.sortMeters = (meters) => (meters || []).slice().sort((a, b) => AM.windowHours(a) - AM.windowHours(b));

  // ---- messages from the page-world hook ----
  // Everything arriving from inject.js is untrusted input (it was produced inside the page's own JS world). Only
  // well-formed messages with the expected field types and sizes get through, rebuilt field by field.
  AM.validateInjectMessage = (d) => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const str = (v, max) => typeof v === 'string' && v.length <= max;
    const opt = (v, max) => v == null || str(v, max);
    const url = (v) => str(v, 4000) && /^(https?|wss?):\/\//i.test(v);
    switch (d.kind) {
      case 'pong':
        return typeof d.fetchHooked === 'boolean' ? { kind: 'pong', fetchHooked: d.fetchHooked } : null;
      case 'request':
        if (!url(d.url) || !str(d.method, 12) || !opt(d.body, 20000)) return null;
        return { kind: 'request', url: d.url, method: d.method, body: d.body == null ? null : d.body };
      case 'response':
        if (!url(d.url) || !str(d.method, 12) || !Number.isInteger(d.status) || d.status < 100 || d.status > 599) return null;
        if (!opt(d.reqBody, 20000) || !opt(d.retryAfter, 64) || !opt(d.body, 270000)) return null;
        if ((d.binary != null && typeof d.binary !== 'boolean') || (d.shapeOnly != null && typeof d.shapeOnly !== 'boolean')) return null;
        return {
          kind: 'response', url: d.url, method: d.method, status: d.status,
          reqBody: d.reqBody == null ? null : d.reqBody, retryAfter: d.retryAfter == null ? null : d.retryAfter,
          binary: !!d.binary, shapeOnly: !!d.shapeOnly, body: d.body == null ? '' : d.body,
        };
      default:
        return null;
    }
  };

  // ---- "can't read usage here" ----
  // An adapter reports a problem when its usage call fails or its parser finds nothing. Transient errors
  // (the page hasn't made its own calls yet) must not flash a warning, so an 'error' only shows once it has
  // lasted PROBLEM_DELAY_MS; a definite 'signin' (signed out) shows at once.
  AM.PROBLEM_DELAY_MS = 15000;
  AM.problemVisible = (p, now = Date.now()) => !!p && (p.kind === 'signin' || now - (p.since || 0) >= AM.PROBLEM_DELAY_MS);
  // Only warn when nothing real is being shown: real numbers from the provider mean the usage path works.
  AM.problemToShow = (problem, meters, now = Date.now()) =>
    AM.problemVisible(problem, now) && !(meters || []).some((m) => m.source === 'real') ? problem : null;
  AM.describeProblem = (p) => (p && p.kind === 'signin'
    ? { title: 'Sign in to see limits', pill: 'sign in', detail: p.text || 'You are not signed in here, so the site has no limits to show.' }
    : { title: "Can't read usage here", pill: "can't read usage", detail: p && p.text ? String(p.text).slice(0, 160) : 'The site did not return usage in a form AI Meter understands.' });
  // "HTTP 401" from an error thrown by ctx.getJSON ("401 /path...") without leaking the path (it can hold ids).
  AM.errText = (e) => {
    const m = String((e && e.message) || e || '').match(/^(\d{3})\b/);
    return m ? 'HTTP ' + m[1] : String((e && e.message) || e || 'request failed').slice(0, 100);
  };
  AM.errIsAuth = (e) => /^40[13]\b/.test(String((e && e.message) || ''));

  // Text for the "Copy debug log" button. Shape-only debug entries (never message text); request URLs are included.
  AM.buildDiagnostics = ({ version, provider, host, problem, meters, log, now = Date.now() }) => {
    const lines = [`AI Meter ${version || '?'} | ${provider || '?'} | ${host || '?'} | ${new Date(now).toISOString()}`];
    if (problem) lines.push(`Problem: ${problem.kind}: ${problem.text || ''}`.trim());
    lines.push('Meters: ' + ((meters || []).map((m) => `${m.label} ${AM.meterValue(m)} [${m.source}]`).join('; ') || 'none'));
    const entries = (log || []).filter((e) => !provider || e.provider === provider).slice(0, 40);
    if (!entries.length) lines.push('(No debug entries. Tick Debug in Settings, reload the tab, then copy again for request details.)');
    for (const e of entries) {
      lines.push(`${new Date(e.t).toISOString().slice(11, 19)} ${e.kind || ''} ${e.method || ''}${e.status ? ' ' + e.status : ''} ${e.url || ''}${e.body ? ' | ' + String(e.body).slice(0, 300) : ''}`.replace(/\s+/g, ' ').trim());
    }
    return lines.join('\n');
  };
})();
