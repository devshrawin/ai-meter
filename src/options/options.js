const AM = globalThis.AIMeter;
const $ = (id) => document.getElementById(id);
let settings;

const editable = () => [
  ...AM.PROVIDERS.filter((p) => p.id !== 'claude').map((p) => ({ id: p.id, name: `${p.name} — ${p.source}` })),
  ...settings.customSites.map((s) => ({ id: 'site:' + s.host, name: `${s.host} — estimate` })),
];

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
  for (const { id: pid, name } of editable()) {
    box.append(el('h3', {}, name));
    const wrap = el('div', { className: 'table' });
    const table = el('table', { dataset: { provider: pid } });
    const head = el('tr');
    ['Label', 'Model pattern (regex)', 'Limit', 'Window (h)', ''].forEach((h) => head.append(el('th', {}, h)));
    table.append(head);
    (settings.quotas[pid] || AM.defaultQuotasFor(pid, settings)).forEach((r) => table.append(ruleRow(r)));
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
  $('chatStats').checked = settings.chatStats;
  $('explore').checked = settings.explore;
  $('irisEnergy').value = settings.irisEnergy === 'lively' ? 'lively' : 'calm';
  $('irisStatus').textContent = settings.pet ? 'Iris is on the meter.' : 'Iris is at home.';
  $('irisHome').textContent = settings.pet ? 'Send Iris home' : 'Bring Iris back';
  $('irisOpts').classList.toggle('off', !settings.pet);
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
      chatStats: $('chatStats').checked,
      explore: $('explore').checked,
      irisEnergy: $('irisEnergy').value,
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
function renderSites() {
  const ul = $('sites');
  ul.textContent = '';
  if (!settings.customSites.length) ul.append(el('li', {}, 'No extra sites yet.'));
  for (const s of settings.customSites) {
    const li = el('li');
    li.append(el('b', {}, s.host), el('span', {}, s.limit ? `${s.limit} per ${s.windowHours}h` : `counting, ${s.windowHours}h window`));
    const del = el('button', { className: 'x', title: 'Remove site' }, '×');
    del.addEventListener('click', () => removeSite(s.host));
    li.append(del);
    ul.append(li);
  }
}

const scriptIds = (host) => ['aimeter-main-' + host, 'aimeter-iso-' + host];

async function addSite() {
  const host = $('siteHost').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return flash('Enter a hostname like chat.example.com');
  if (AM.providerForHost(host, settings)) return flash(`${host} is already tracked.`);
  const origins = [`https://${host}/*`];
  // Must be the first await so Chrome still sees the click as a user gesture.
  const granted = await chrome.permissions.request({ origins });
  if (!granted) return flash('Chrome access to that site was not granted.');
  try {
    await chrome.scripting.unregisterContentScripts({ ids: scriptIds(host) }).catch(() => {});
    await chrome.scripting.registerContentScripts(AM.siteScripts(host));
  } catch (e) {
    return flash('Could not register: ' + e.message);
  }
  settings = {
    ...settings,
    customSites: [...settings.customSites, {
      host,
      limit: Math.max(0, Number($('siteLimit').value) || 0),
      windowHours: Math.max(0.1, Number($('siteWindow').value) || 24),
    }],
  };
  await chrome.storage.local.set({ settings });
  $('siteHost').value = $('siteLimit').value = $('siteWindow').value = '';
  renderSites();
  renderQuotas();
  flash(`Added ${host}. Reload its tab to start tracking.`);
}

async function removeSite(host) {
  await chrome.scripting.unregisterContentScripts({ ids: scriptIds(host) }).catch(() => {});
  await chrome.permissions.remove({ origins: [`https://${host}/*`] }).catch(() => {});
  const quotas = { ...settings.quotas };
  delete quotas['site:' + host];
  settings = { ...settings, quotas, customSites: settings.customSites.filter((s) => s.host !== host) };
  await chrome.storage.local.set({ settings });
  await chrome.storage.local.remove(['usage.site:' + host, 'events.site:' + host]);
  renderSites();
  renderQuotas();
  flash(`Removed ${host}.`);
}

$('addSite').addEventListener('click', addSite);
// Iris settings take effect straight away, no Save needed.
$('irisHome').addEventListener('click', async () => {
  settings = { ...settings, pet: !settings.pet };
  await chrome.storage.local.set({ settings });
  renderGeneral();
  flash(settings.pet ? 'Iris is back on the meter.' : 'Iris went home. Bring her back any time.');
});
$('irisEnergy').addEventListener('change', save);
$('explore').addEventListener('change', save);
$('defaults').addEventListener('click', async () => {
  settings = { ...AM.mergeSettings(null), customSites: settings.customSites };
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
  renderSites();
  renderQuotas();
  renderLog();
})();
