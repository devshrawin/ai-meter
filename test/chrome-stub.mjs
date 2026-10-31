// Shared test helper (not a test): a stubbed `chrome.*` plus a loader for background.js, the MV3 service worker.
// Pass the same `storage` to a second load to simulate the worker restarting with its stored state intact.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const clone = (v) => JSON.parse(JSON.stringify(v));

export function makeStorage(initial = {}) {
  const data = clone(initial);
  return {
    data,
    async get(keys) {
      if (keys == null) return clone(data);
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in data) out[k] = clone(data[k]);
      return out;
    },
    async set(obj) { for (const [k, v] of Object.entries(obj)) data[k] = clone(v); },
  };
}

export function loadBackground({ storage = makeStorage(), contains = async () => true, registered = [] } = {}) {
  const notifications = [];
  const alarms = [];
  const badges = [];
  const registeredScripts = [];
  const tabsCreated = [];
  const listeners = { message: [], alarm: [], installed: [], startup: [], activated: [] };
  const event = (name) => ({ addListener: (fn) => listeners[name].push(fn) });
  const chrome = {
    runtime: { getURL: (p) => 'chrome-extension://x/' + p, onMessage: event('message'), onInstalled: event('installed'), onStartup: event('startup') },
    storage: { local: storage },
    notifications: { create: (id, opts) => { notifications.push({ id, ...opts }); } },
    alarms: { create: (name, info) => { alarms.push({ name, ...info }); }, onAlarm: event('alarm') },
    action: {
      setBadgeText: async (o) => { badges.push({ text: o.text }); },
      setBadgeBackgroundColor: async (o) => { badges.push({ color: o.color }); },
    },
    tabs: { onActivated: event('activated'), get: async () => ({ url: 'https://claude.ai/chat' }), create: async (o) => { tabsCreated.push(o); } },
    scripting: {
      getRegisteredContentScripts: async () => registered,
      registerContentScripts: async (s) => { registeredScripts.push(...s); },
      executeScript: async () => {},
    },
    permissions: { contains },
  };
  const sandbox = { console: { ...console, warn() {} }, chrome, setTimeout, clearTimeout, URL, Date };
  const ctx = vm.createContext(sandbox);
  sandbox.importScripts = (...files) => files.forEach((f) => vm.runInContext(read('src/' + f), ctx, { filename: f }));
  vm.runInContext(read('src/background.js'), ctx, { filename: 'background.js' });

  const settle = () => new Promise((r) => setTimeout(r, 10));
  return {
    AM: ctx.AIMeter, notifications, alarms, badges, registeredScripts, tabsCreated, listeners, storage, settle,
    // what content.js sends after each refresh
    async usage(provider, name, meters, problem = null, sender = { tab: { id: 1 } }) {
      listeners.message.forEach((fn) => fn({ type: 'aimeter:usage', provider, name, meters, problem }, sender, () => {}));
      await settle();
    },
    // two senders at the same moment, without waiting in between
    async usageTogether(provider, name, meters) {
      listeners.message.forEach((fn) => {
        fn({ type: 'aimeter:usage', provider, name, meters }, { tab: { id: 1 } }, () => {});
        fn({ type: 'aimeter:usage', provider, name, meters }, { tab: { id: 2 } }, () => {});
      });
      await settle();
    },
    async fireAlarm(name) { for (const fn of listeners.alarm) await fn({ name }); await settle(); },
  };
}
