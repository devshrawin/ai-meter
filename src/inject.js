// Runs in the page's own JS world. Mirrors network activity to the content script via postMessage.
(() => {
  if (window.__aimeterInjected) return;
  window.__aimeterInjected = true;

  const TAG = 'aimeter-inject';
  // Endpoints whose full response bodies adapters need (usage / limits / billing).
  const WATCH = /rate[-_]?limit|usage|limits|conversation\/init|quota|credit|billing|balance|entitlement|subscription|rpcids=[^&]*jSf9Qc/i;
  // Analytics/telemetry endpoints that would flood the discovery log.
  const NOISE = /\/_data\/|cdn-cgi|\/rum\b|analytics|telemetry|statsig|sentry|segment|amplitude|datadog|event_logging|\/ping\b|heartbeat|\/log(s|ging)?\b|\/events?\b|\/t\/?$/i;
  // Never forward bodies from auth endpoints: they carry identity and tokens.
  const PRIVATE = /\/auth\/|\/session\b|\/token\b|\/me\b|\/account\b|\/profile\b/i;
  const BINARY = /grpc|proto|octet-stream/i;
  const MAX_REQ = 20000;
  const MAX_RES = 200000;
  let captureAll = false;

  const post = (d) => {
    try { window.postMessage({ source: TAG, ...d }, location.origin); } catch {}
  };
  const abs = (u) => {
    try { return new URL(String(u), location.href).href; } catch { return String(u); }
  };
  const sameSite = (url) => {
    try {
      const h = new URL(url).hostname;
      const base = location.hostname.split('.').slice(-2).join('.');
      return h === base || h.endsWith('.' + base);
    } catch { return false; }
  };
  const bodyText = (b) => {
    if (typeof b === 'string') return b.slice(0, MAX_REQ);
    if (b instanceof URLSearchParams) return b.toString().slice(0, MAX_REQ);
    return null;
  };
  const toB64 = (buf) => {
    const bytes = new Uint8Array(buf.slice(0, 65536));
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  };

  // 'full' = send body text, 'binary' = send base64 bytes, 'shape' = send only JSON key names, null = skip.
  const mode = (url, status, ct) => {
    if (PRIVATE.test(url)) return null;
    if (status === 429) return 'full';
    if (WATCH.test(url)) return BINARY.test(ct) ? 'binary' : ct.includes('json') || ct.includes('text') ? 'full' : null;
    if (captureAll && ct.includes('json') && !ct.includes('event-stream') && sameSite(url) && !NOISE.test(url)) return 'shape';
    return null;
  };

  const shape = (text) => {
    try {
      const walk = (v, d) => {
        if (Array.isArray(v)) return v.length ? [walk(v[0], d + 1)] : [];
        if (v && typeof v === 'object') {
          if (d > 3) return '{…}';
          const o = {};
          for (const k of Object.keys(v).slice(0, 25)) o[k] = walk(v[k], d + 1);
          return o;
        }
        return typeof v;
      };
      return JSON.stringify(walk(JSON.parse(text), 0)).slice(0, 3000);
    } catch { return '(unparsed)'; }
  };

  const emit = (m, url, method, status, reqBody, res) => {
    const retryAfter = res.headers ? res.headers.get('retry-after') : null;
    if (m === 'binary') {
      res.clone().arrayBuffer()
        .then((b) => post({ kind: 'response', url, method, status, reqBody, retryAfter, binary: true, body: toB64(b) }))
        .catch(() => {});
    } else {
      res.clone().text()
        .then((t) => post({ kind: 'response', url, method, status, reqBody, retryAfter, shapeOnly: m === 'shape', body: m === 'shape' ? shape(t) : t.slice(0, MAX_RES) }))
        .catch(() => {});
    }
  };

  const wrap = (base) => async function (input, init) {
    let url = '';
    let method = 'GET';
    let body = null;
    try {
      if (input instanceof Request) {
        url = input.url;
        method = input.method;
      } else {
        url = abs(input);
      }
      if (init && init.method) method = init.method;
      method = method.toUpperCase();
      body = bodyText(init && init.body);
      if (body == null && input instanceof Request && method !== 'GET' && method !== 'HEAD') {
        input.clone().text()
          .then((t) => post({ kind: 'request', url, method, body: t.slice(0, MAX_REQ) }))
          .catch(() => post({ kind: 'request', url, method, body: null }));
      } else {
        post({ kind: 'request', url, method, body });
      }
    } catch {}

    const res = await base.apply(this, arguments);
    try {
      const m = mode(url, res.status, res.headers.get('content-type') || '');
      if (m) emit(m, url, method, res.status, body, res);
    } catch {}
    return res;
  };

  let ourFetch = wrap(window.fetch);
  window.fetch = ourFetch;
  // Some apps replace window.fetch after load; re-wrap whatever they installed.
  setInterval(() => {
    if (window.fetch !== ourFetch) {
      ourFetch = wrap(window.fetch);
      window.fetch = ourFetch;
    }
  }, 2000);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'aimeter-content' || e.data.kind !== 'ping') return;
    captureAll = !!e.data.debug;
    post({ kind: 'pong', fetchHooked: window.fetch === ourFetch });
  });

  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__aimeter = { method: String(method).toUpperCase(), url: abs(url) };
    return XO.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (b) {
    const info = this.__aimeter;
    if (info) {
      const body = bodyText(b);
      post({ kind: 'request', ...info, body });
      this.addEventListener('load', () => {
        try {
          const m = mode(info.url, this.status, this.getResponseHeader('content-type') || '');
          if (!m || m === 'binary') return;
          let t = null;
          if (this.responseType === '' || this.responseType === 'text') t = this.responseText;
          else if (this.responseType === 'json') t = JSON.stringify(this.response);
          if (t == null) return;
          post({
            kind: 'response', ...info, status: this.status, reqBody: body,
            retryAfter: this.getResponseHeader('retry-after'),
            shapeOnly: m === 'shape', body: m === 'shape' ? shape(t) : t.slice(0, MAX_RES),
          });
        } catch {}
      });
    }
    return XS.apply(this, arguments);
  };

  const WSS = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      if (typeof data === 'string' && data.length > 40) post({ kind: 'request', url: this.url, method: 'WS', body: data.slice(0, MAX_REQ) });
    } catch {}
    return WSS.apply(this, arguments);
  };
})();
