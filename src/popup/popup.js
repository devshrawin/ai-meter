const AM = globalThis.AIMeter;
const list = document.getElementById('list');
const summary = document.getElementById('summary');
const CHIPS_SHOWN = 4;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
};

function chip(m, now, mixed) {
  const c = el('div', 'chip');
  const n = el('div', 'n', m.label);
  if (mixed && m.source === 'estimate') n.append(' ', el('i', 'tag estimate', 'est'));
  c.append(n, el('div', 'v', AM.meterValue(m)));
  const reset = AM.resetText(m, now);
  if (reset) c.title = reset;
  return c;
}

function barRow(m, now, mixed) {
  const pct = AM.pctOf(m);
  const value = AM.meterValue(m);
  const row = el('div', 'row');
  const top = el('div', 'top');
  const val = el('span', 'val');
  const b = el('b', null, Math.round(pct) + '%');
  val.append(b);
  if (!/%$/.test(value)) val.append(' · ' + value);
  top.append(el('span', 'name', m.label), val);
  const bar = el('div', 'bar');
  const fill = el('div', 'fill ' + AM.level(pct));
  fill.style.width = Math.min(100, pct) + '%';
  bar.append(fill);
  const sub = el('div', 'sub');
  const reset = AM.resetText(m, now);
  if (reset) sub.append(el('span', null, reset));
  if (mixed && m.source === 'estimate') sub.append(el('i', 'tag estimate', 'est'));
  row.append(top, bar);
  if (sub.childNodes.length) row.append(sub);
  return row;
}

function problemBox(entry, prob, all) {
  const d = AM.describeProblem(prob);
  const box = el('div', 'problem');
  box.append(el('b', null, d.title), el('div', 'why', d.detail));
  const btn = el('button', null, 'Copy debug log');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const text = AM.buildDiagnostics({ version: chrome.runtime.getManifest().version, provider: entry.provider, host: '', problem: prob, meters: entry.meters, log: all['debug.log'] || [] });
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied ✓'; } catch { btn.textContent = 'Copy failed'; }
    setTimeout(() => { btn.textContent = 'Copy debug log'; }, 2000);
  });
  box.append(btn);
  return box;
}

function card(entry, all, now) {
  const stale = AM.isStale(entry, now);
  const c = el('section', 'card' + (stale ? ' stale' : ''));
  const prob = AM.problemToShow(entry.problem, entry.meters);
  const primary = AM.primaryMeter(entry.meters);
  const head = el('div', 'card-head');
  head.append(el('span', 'led ' + (prob || stale ? 'none' : AM.level(primary ? AM.pctOf(primary) : null))), el('h2', null, entry.name));
  const src = AM.cardSource(entry.meters);
  if (src === 'real' || src === 'estimate') head.append(el('i', 'tag ' + src, src === 'real' ? 'real' : 'est'));
  head.append(el('small', stale ? 'old' : null, (stale ? 'stale · ' : '') + ago(entry.updatedAt)));
  c.append(head);

  if (prob) c.append(problemBox(entry, prob, all));
  else if (!entry.meters.length) c.append(el('div', 'none', 'No data yet — send a message.'));

  const { bars, counters } = AM.splitMeters(entry.meters);
  const mixed = src === 'mixed';
  if (bars.length) {
    const wrap = el('div', 'bars');
    for (const m of bars) wrap.append(barRow(m, now, mixed));
    c.append(wrap);
  }
  if (counters.length) {
    const grid = el('div', 'chips');
    for (const m of counters.slice(0, CHIPS_SHOWN)) grid.append(chip(m, now, mixed));
    c.append(grid);
    if (counters.length > CHIPS_SHOWN) {
      const more = el('details', 'more');
      more.append(el('summary', null, `Show all ${counters.length} limits`));
      const rest = el('div', 'chips');
      for (const m of counters.slice(CHIPS_SHOWN)) rest.append(chip(m, now, mixed));
      more.append(rest);
      c.append(more);
    }
  }
  return c;
}

async function render() {
  const all = await chrome.storage.local.get(null);
  const order = (id) => {
    const i = AM.PROVIDERS.findIndex((p) => p.id === id);
    return i < 0 ? AM.PROVIDERS.length : i;
  };
  const now = Date.now();
  const entries = AM.sortEntries(Object.keys(all).filter((k) => k.startsWith('usage.')).map((k) => all[k]), order, now);
  list.textContent = '';
  if (!entries.length) {
    summary.textContent = 'Nothing tracked yet';
    const empty = el('div', 'empty');
    empty.append(el('b', null, 'Open an AI site'), 'Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek… and AI Meter starts tracking. Add other sites in Settings.');
    list.append(empty);
    return;
  }
  const fresh = entries.filter((e) => !AM.isStale(e, now)).length;
  summary.textContent = `${entries.length} ${entries.length === 1 ? 'service' : 'services'} · ${fresh} up to date`;
  for (const entry of entries) list.append(card(entry, all, now));
}

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('add').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
document.getElementById('refresh').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'aimeter:refresh' }); } catch {}
  }
  setTimeout(render, 800);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && Object.keys(changes).some((k) => k.startsWith('usage.'))) render();
});
render();
setInterval(render, 30000);
