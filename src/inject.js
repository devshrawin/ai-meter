// Runs in the page's own JS world. Mirrors network activity to the content script via postMessage.
(() => {
  if (window.__aimeterInjected) return;
  window.__aimeterInjected = true;

  const TAG = 'aimeter-inject';
  const WATCH = /rate[-_]?limit|usage|limits|conversation\/init|quota|user\/settings|credit|billing|balance|entitlement/i;
  // Analytics/telemetry endpoints that would flood the discovery log.
  const NOISE = /\/_data\/|cdn-cgi|\/rum\b|analytics|telemetry|statsig|sentry|segment|amplitude|datadog|\/log(s|ging)?\b|\/events?\b|\/t\/?$/i;
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
  const wanted = (url, status, contentType) => {
    if (status === 429) return true;
    if (!contentType.includes('json')) return false;
    if (WATCH.test(url)) return true;
    return captureAll && sameSite(url) && !NOISE.test(url) && !contentType.includes('event-stream');
  };

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
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

    const res = await origFetch.apply(this, arguments);
    try {
      if (wanted(url, res.status, res.headers.get('content-type') || '')) {
        res.clone().text()
          .then((t) => post({ kind: 'response', url, method, status: res.status, reqBody: body, body: t.slice(0, MAX_RES) }))
          .catch(() => {});
      }
    } catch {}
    return res;
  };

  const ourFetch = window.fetch;
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
          if (!wanted(info.url, this.status, this.getResponseHeader('content-type') || '')) return;
          let t = null;
          if (this.responseType === '' || this.responseType === 'text') t = this.responseText;
          else if (this.responseType === 'json') t = JSON.stringify(this.response);
          if (t != null) post({ kind: 'response', ...info, status: this.status, reqBody: body, body: t.slice(0, MAX_RES) });
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
