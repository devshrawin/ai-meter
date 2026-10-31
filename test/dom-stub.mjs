// Shared test helper (not a test): a very small fake DOM, just enough for widget.js (shadow root, children, text,
// classes, style, listeners). Not a browser: layout, CSS and events other than the ones fired by hand do not exist.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

export class FakeEl {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.style = { cssText: '' };
    this.listeners = {};
    this.className = '';
    this.title = '';
    this.offsetWidth = 200;
    this.offsetHeight = 30;
    this._text = '';
    this.classList = {
      add: (...c) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(c))].join(' '); },
      remove: (...c) => { this.className = this.className.split(/\s+/).filter((x) => x && !c.includes(x)).join(' '); },
      contains: (c) => this.className.split(/\s+/).includes(c),
    };
  }
  get textContent() { return this._text + this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
  set textContent(v) { this.children.forEach((c) => { if (c && c.parent) c.parent = null; }); this.children = []; this._text = String(v); }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === this.ownerDocument.body || n === this.ownerDocument.body.root; }
  append(...kids) { for (const k of kids) { if (typeof k !== 'string') { if (k.parent) k.remove(); k.parent = this; } this.children.push(k); } }
  appendChild(k) { this.append(k); return k; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  attachShadow() { this.shadow = new FakeEl('#shadow', this.ownerDocument); this.shadow.parent = this; return this.shadow; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  fire(type, ev = {}) { (this.listeners[type] || []).forEach((fn) => fn({ target: this, clientX: 0, clientY: 0, pointerId: 1, ...ev })); }
  getBoundingClientRect() { return { right: 1000, bottom: 700, left: 900, top: 650, width: 100, height: 50 }; }
  closest() { return null; }
  contains(n) { return n === this || this.children.some((c) => typeof c !== 'string' && c.contains(n)); }
  animate() { const a = {}; setTimeout(() => a.onfinish && a.onfinish(), 0); return a; }
  decode() { return Promise.resolve(); }
  setPointerCapture() {}
  // test helpers
  all(pred, out = []) {
    if (pred(this)) out.push(this);
    for (const c of this.children) if (typeof c !== 'string') c.all(pred, out);
    if (this.shadow) this.shadow.all(pred, out);
    return out;
  }
  byClass(cls) { return this.all((e) => e.classList.contains(cls)); }
  byTag(tag) { return this.all((e) => e.tagName === tag.toUpperCase()); }
}

export function makeDocument() {
  const doc = { listeners: {} };
  doc.body = new FakeEl('body', doc);
  doc.createElement = (tag) => new FakeEl(tag, doc);
  doc.addEventListener = (t, fn) => { (doc.listeners[t] = doc.listeners[t] || []).push(fn); };
  doc.elementsFromPoint = () => [];
  doc.visibilityState = 'visible';
  doc.hidden = false;
  return doc;
}

// Loads quotas, common and widget into one sandbox with the fake DOM. Timers are recorded, not run.
export function loadWidget({ settings = {}, pet = false } = {}) {
  const document = makeDocument();
  const timers = [];
  const store = {};
  const sandbox = {
    console, document, Date, URL, JSON,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    innerWidth: 1280, innerHeight: 800,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    chrome: { runtime: { getURL: (p) => 'chrome-extension://x/' + p, getManifest: () => ({ version: '1.0.0' }) } },
    navigator: {},
  };
  const ctx = vm.createContext(sandbox);
  for (const f of ['src/core/quotas.js', 'src/core/common.js', 'src/core/parsers.js', 'src/core/widget.js']) vm.runInContext(read(f), ctx, { filename: f });
  const AM = ctx.AIMeter;
  const pets = [];
  if (pet) {
    AM.loadPet = () => Promise.resolve();
    AM.createPet = () => {
      const p = { el: document.createElement('div'), moods: [], nudges: 0, setMood(m) { this.moods.push(m); }, nudge() { this.nudges++; }, setExplore() {}, setEnergy() {}, destroy() { this.destroyed = true; } };
      pets.push(p);
      return p;
    };
  }
  const base = { widget: true, pet: false, ...settings };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    AM, document, store, timers, pets, sandbox, tick,
    update(name, meters, over = {}, chat = null, problem = null) { AM.widget.update(name, meters, { ...base, ...over }, chat, problem); },
    get host() { return document.body.children.find((c) => c.attrs && 'data-aimeter' in c.attrs) || null; },
    get root() { return this.host && this.host.shadow; },
    pill() { return this.root.byClass('pill')[0]; },
    pillText() { return this.pill().byClass('info')[0].textContent; },
    dotClass() { return this.pill().byClass('dot')[0].className; },
    click() { const p = this.pill(); p.fire('pointerdown'); p.fire('pointerup'); },
    panelText() { const p = this.root.byClass('panel')[0]; return p ? p.textContent : null; },
  };
}
