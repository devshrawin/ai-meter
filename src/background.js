importScripts('core/quotas.js', 'core/common.js');

const AM = globalThis.AIMeter;
const COLORS = { low: '#16a34a', mid: '#d97706', high: '#dc2626', none: '#78716c' };
const ICON = chrome.runtime.getURL('icons/icon128.png');

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return AM.mergeSettings(settings);
}

function setBadge(tabId, meters) {
  const top = AM.primaryMeter(meters);
  const pct = top ? AM.pctOf(top) : null;
  const text = pct != null ? String(Math.round(pct)) : top ? '•' : '';
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: COLORS[AM.level(pct)] }).catch(() => {});
}

async function checkThresholds(entry, settings) {
  const { notified = {} } = await chrome.storage.local.get('notified');
  const thresholds = [...settings.thresholds].sort((a, b) => a - b);
  let changed = false;

  for (const m of entry.meters) {
    const pct = AM.pctOf(m);
    if (pct == null) continue;
    const key = `${entry.provider}|${m.id}`;
    const prev = notified[key] || 0;
    const reached = thresholds.filter((t) => pct >= t).pop() || 0;
    if (reached < prev) {
      notified[key] = reached;
      changed = true;
    } else if (reached > prev) {
      notified[key] = reached;
      changed = true;
      const reset = AM.resetText(m);
      chrome.notifications.create(`aimeter|${key}|${reached}|${Date.now()}`, {
        type: 'basic',
        iconUrl: ICON,
        title: `${entry.name}: ${m.label} at ${Math.round(pct)}%`,
        message: reset ? reset[0].toUpperCase() + reset.slice(1) : 'Usage limit getting close.',
        priority: reached >= 100 ? 2 : 1,
      });
    }
    if (pct >= 90 && m.resetAt && m.resetAt > Date.now() + 30e3) {
      chrome.alarms.create(`reset|${entry.provider}|${m.id}|${entry.name}|${m.label}`, { when: m.resetAt });
    }
  }
  if (changed) await chrome.storage.local.set({ notified });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'aimeter:usage') return;
  (async () => {
    const entry = { provider: msg.provider, name: msg.name, meters: msg.meters || [], updatedAt: Date.now() };
    await chrome.storage.local.set({ ['usage.' + msg.provider]: entry });
    if (sender.tab && sender.tab.id != null) setBadge(sender.tab.id, entry.meters);
    const settings = await getSettings();
    if (settings.notify) await checkThresholds(entry, settings);
  })().catch((e) => console.warn('[AI Meter]', e));
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('reset|')) return;
  const [, provider, id, name, label] = alarm.name.split('|');
  const settings = await getSettings();
  const { notified = {} } = await chrome.storage.local.get('notified');
  delete notified[`${provider}|${id}`];
  await chrome.storage.local.set({ notified });
  if (!settings.notify) return;
  chrome.notifications.create(`aimeter|reset|${provider}|${id}|${Date.now()}`, {
    type: 'basic',
    iconUrl: ICON,
    title: `${name}: ${label} has reset`,
    message: 'You should be good to go again.',
  });
});

// Keep dynamic content scripts for user-added sites in step with settings (they can be dropped on update).
async function syncSites() {
  const settings = await getSettings();
  const registered = new Set((await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id));
  for (const site of settings.customSites) {
    const origins = [`https://${site.host}/*`];
    if (!(await chrome.permissions.contains({ origins }))) continue;
    const missing = AM.siteScripts(site.host).filter((s) => !registered.has(s.id));
    if (missing.length) await chrome.scripting.registerContentScripts(missing).catch((e) => console.warn('[AI Meter]', e));
  }
}
chrome.runtime.onInstalled.addListener(() => syncSites().catch(() => {}));
chrome.runtime.onStartup.addListener(() => syncSites().catch(() => {}));

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const provider = tab.url && AM.providerForHost(new URL(tab.url).hostname, await getSettings());
    if (!provider) return;
    const key = 'usage.' + provider.id;
    const got = await chrome.storage.local.get(key);
    if (got[key]) setBadge(tabId, got[key].meters);
  } catch {}
});
