// Shared test helper (not a test): Iris's engine on a fake page, driven by a manual animation frame and a fake clock.
// Observed through the public API plus the pose shown (the sprite whose opacity is 1) and where she stands (translate).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { makeDocument } from './dom-stub.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

export function loadPet({ reduce = false, calm = false } = {}) {
  const document = makeDocument();
  let clock = 1_000_000;
  let rafCb = null;
  let seed = 12345;
  const random = calm ? () => 0.99 : () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const FakeDate = class extends Date { static now() { return clock; } };
  const sandbox = {
    console, document, JSON, Promise, URL, EventTarget, Set, Map,
    Math: Object.assign(Object.create(Math), { random }),
    Date: FakeDate,
    performance: { now: () => clock },
    setTimeout: (fn, ms) => { return setTimeout(fn, 0); },
    clearTimeout, setInterval: () => 1, clearInterval() {},
    requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
    cancelAnimationFrame: () => { rafCb = null; },
    matchMedia: () => ({ matches: reduce }),
    innerWidth: 1280, innerHeight: 800,
    chrome: { runtime: { getURL: (p) => p } },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext('globalThis.AIMeter = {}', ctx);
  for (const f of ['src/core/iris-frames.js', 'src/core/walk8-frames.js', 'src/core/pet.js']) vm.runInContext(read(f), ctx, { filename: f });
  const AM = ctx.AIMeter;
  AM.bus = new EventTarget();
  AM.siteId = 'claude';

  const host = document.createElement('div');
  const pill = document.createElement('div');
  host.append(pill);
  document.body.append(host);
  pill.getBoundingClientRect = () => ({ left: 1000, top: 700, right: 1200, bottom: 730, width: 200, height: 30 });
  host.getBoundingClientRect = () => ({ left: 1000, top: 700, right: 1200, bottom: 730, width: 200, height: 30 });

  // a perch (the chat box) she can jump to; tests can detach or move it
  const composer = document.createElement('div');
  composer.isConnected; // (getter) attached below
  document.body.append(composer);
  const rect = { left: 400, top: 600, right: 900, bottom: 660, width: 500, height: 60 };
  composer.getBoundingClientRect = () => ({ ...rect });
  const asked = [];
  AM.findPerch = (kind) => { asked.push(kind); return kind === 'composer' || kind === 'header' ? composer : null; };

  const pet = AM.createPet(pill, host);
  assert.ok(pet, 'createPet needs IRIS_FRAMES.sit');

  // Advance the fake clock in 16 ms frames.
  // Async: her behaviours are promise chains, so let them run between frames.
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const step = async (ms) => {
    for (let t = 0; t < ms; t += 16) {
      clock += 16;
      const cb = rafCb;
      if (!cb) break;
      cb(clock);
      await flush();
    }
  };
  const rig = () => pet.el.children.find((c) => c.className === 'rig');
  const pose = () => {
    const shown = rig().children.filter((i) => i.tagName === 'IMG' && Number(i.style.opacity) >= 0.5);
    return shown.length ? shown[0].src.match(/iris\/(.+)\.webp/)[1] : null;
  };
  const pos = () => {
    const m = String(pet.el.style.transform).match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  };
  return { AM, pet, document, composer, rect, asked, step, pose, pos, host, pill, raf: () => rafCb, setClock: (v) => { clock = v; } };
}
