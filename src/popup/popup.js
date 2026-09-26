const AM = globalThis.AIMeter;
const list = document.getElementById('list');

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

async function render() {
  const all = await chrome.storage.local.get(null);
  const order = (id) => {
    const i = AM.PROVIDERS.findIndex((p) => p.id === id);
    return i < 0 ? AM.PROVIDERS.length : i;
  };
  const entries = Object.keys(all)
    .filter((k) => k.startsWith('usage.'))
    .map((k) => all[k])
    .sort((a, b) => order(a.provider) - order(b.provider) || a.name.localeCompare(b.name));
  list.textContent = '';
  if (!entries.length) {
    list.append(el('div', 'empty', 'Open any supported AI site (Claude, ChatGPT, Gemini, Grok, Perplexity, Kimi, DeepSeek…) and AI Meter will start tracking. Add other sites in Settings.'));
    return;
  }
  const now = Date.now();
  for (const entry of entries) {
    const card = el('section', 'card');
    const h = el('h3', null, entry.name);
    h.append(el('small', null, 'updated ' + ago(entry.updatedAt)));
    card.append(h);
    if (!entry.meters.length) card.append(el('div', 'none', 'No data yet — send a message.'));
    for (const m of entry.meters) {
      const pct = AM.pctOf(m);
      const row = el('div', 'row');
      const top = el('div', 'top');
      top.append(el('span', null, m.label), el('span', 'val', AM.meterValue(m) + (pct != null && !/%$/.test(AM.meterValue(m)) ? ` · ${Math.round(pct)}%` : '')));
      const bar = el('div', 'bar');
      const fill = el('div', 'fill ' + AM.level(pct));
      fill.style.width = (pct ?? 0) + '%';
      bar.append(fill);
      const sub = el('div', 'sub');
      sub.append(el('span', null, AM.resetText(m, now)), el('span', 'tag ' + m.source, m.source));
      row.append(top, bar, sub);
      card.append(row);
    }
    list.append(card);
  }
}

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
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
