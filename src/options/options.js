const AM = globalThis.AIMeter;
const $ = (id) => document.getElementById(id);
const EDITABLE = ['chatgpt', 'gemini', 'grok', 'perplexity'];
let settings;

const el = (tag, attrs = {}, text) => {
  const e = document.createElement(tag);
  const { dataset, ...rest } = attrs;
  Object.assign(e, rest);
  if (dataset) Object.assign(e.dataset, dataset);
  if (text != null) e.textContent = text;
  return e;
};

function ruleRow(rule) {
  const tr = el('tr');
  const cell = (input, cls) => {
    const td = el('td', cls ? { className: cls } : {});
    td.append(input);
    tr.append(td);
    return input;
  };
  cell(el('input', { type: 'text', value: rule.label, dataset: { f: 'label' } }));
  cell(el('input', { type: 'text', value: rule.pattern, dataset: { f: 'pattern' } }));
  cell(el('input', { type: 'number', min: 0, value: rule.limit, dataset: { f: 'limit' } }), 'num');
  cell(el('input', { type: 'number', min: 0.1, step: 0.5, value: rule.windowHours, dataset: { f: 'windowHours' } }), 'num');
  const del = el('button', { className: 'x', title: 'Remove rule' }, '×');
  del.addEventListener('click', () => tr.remove());
  cell(del);
  tr.dataset.id = rule.id;
  return tr;
}

function renderQuotas() {
  const box = $('quotas');
  box.textContent = '';
  for (const pid of EDITABLE) {
    const p = AM.PROVIDERS.find((x) => x.id === pid);
    box.append(el('h3', {}, p.name));
    const wrap = el('div', { className: 'table' });
    const table = el('table', { dataset: { provider: pid } });
    const head = el('tr');
    ['Label', 'Model pattern (regex)', 'Limit', 'Window (h)', ''].forEach((h) => head.append(el('th', {}, h)));
    table.append(head);
    (settings.quotas[pid] || []).forEach((r) => table.append(ruleRow(r)));
    wrap.append(table);
    const add = el('button', {}, '+ Add rule');
    add.addEventListener('click', () => {
      const last = table.querySelector('tr:last-child');
      const row = ruleRow({ id: 'rule-' + Date.now(), label: 'New rule', pattern: '', limit: 0, windowHours: 24 });
      if (last && last !== head) table.insertBefore(row, last);
      else table.append(row);
    });
    box.append(wrap, add);
  }
}

function readQuotas() {
  const quotas = {};
  for (const table of document.querySelectorAll('#quotas table')) {
    const rules = [];
    for (const tr of table.querySelectorAll('tr[data-id]')) {
      const get = (f) => tr.querySelector(`[data-f="${f}"]`).value;
      const pattern = get('pattern') || '.*';
      try { new RegExp(pattern); } catch { throw new Error(`Invalid pattern "${pattern}"`); }
      rules.push({
        id: tr.dataset.id,
        label: get('label') || 'Rule',
        pattern,
        limit: Math.max(0, Number(get('limit')) || 0),
        windowHours: Math.max(0.1, Number(get('windowHours')) || 24),
      });
    }
    quotas[table.dataset.provider] = rules;
  }
  return quotas;
}

function renderGeneral() {
  $('widget').checked = settings.widget;
  $('notify').checked = settings.notify;
  $('debug').checked = settings.debug;
  $('thresholds').value = settings.thresholds.join(', ');
}

async function renderLog() {
  const { 'debug.log': log = [] } = await chrome.storage.local.get('debug.log');
  $('log').textContent = log.length
    ? log.map((e) => `${new Date(e.t).toLocaleTimeString()}  ${e.provider}  ${e.kind}  ${e.method || ''} ${e.status || ''}  ${e.url}${e.body ? '\n    ' + e.body : ''}`).join('\n')
    : 'Nothing logged yet.';
}

function flash(msg) {
  $('status').textContent = msg;
  setTimeout(() => ($('status').textContent = ''), 2500);
}

async function save() {
  try {
    const thresholds = $('thresholds').value.split(',').map((s) => Number(s.trim())).filter((n) => n > 0 && n <= 100);
    settings = {
      ...settings,
      widget: $('widget').checked,
      notify: $('notify').checked,
      debug: $('debug').checked,
      thresholds: thresholds.length ? thresholds : AM.DEFAULT_SETTINGS.thresholds,
      quotas: { ...settings.quotas, ...readQuotas() },
    };
    await chrome.storage.local.set({ settings });
    renderGeneral();
    flash('Saved.');
  } catch (e) {
    flash(e.message);
  }
}

$('save').addEventListener('click', save);
$('debug').addEventListener('change', save);
$('defaults').addEventListener('click', async () => {
  settings = AM.mergeSettings(null);
  await chrome.storage.local.set({ settings });
  renderGeneral();
  renderQuotas();
  flash('Defaults restored.');
});
$('copyLog').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('log').textContent);
  flash('Log copied.');
});
$('clearLog').addEventListener('click', async () => {
  await chrome.storage.local.remove('debug.log');
  renderLog();
});
$('clearData').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => /^(usage|events)\./.test(k) || k === 'notified');
  await chrome.storage.local.remove(keys);
  flash('Usage data cleared.');
});
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && c['debug.log']) renderLog();
});

(async () => {
  const { settings: s } = await chrome.storage.local.get('settings');
  settings = AM.mergeSettings(s);
  renderGeneral();
  renderQuotas();
  renderLog();
})();
