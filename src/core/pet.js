// Iris — smooth engine (from the Claude Design handoff), plus trips onto the page.
// API: AM.PET_CSS, AM.createPet(pill, hostEl) → { el, react, play, setMood, nudge, setExplore, setDragging, destroy }.
// The smoothness comes from ONE requestAnimationFrame clock driving everything:
//  • walk frames advance by distance travelled (no foot-skate) and adjacent frames blend sub-frame
//  • spring squash/stretch + tilt on every pose change, take-off and landing (hides pose pops)
//  • ballistic arcs for jump / fall / hop with velocity-based stretch and lean
//  • turns animate the mirror (scaleX through 0) instead of snapping; front frames never mirror
//  • continuous breathing, sleep frames cross-breathe, stressed tremble, dizzy sway
//  • all timing on a virtual clock (AM.irisTimeScale for slow-mo), cancellable behaviours
(() => {
  const AM = globalThis.AIMeter;
  const FRONT = new Set(['sit', 'sit-blink', 'sit-happy', 'sit-worried', 'sit-stressed', 'mew', 'purr', 'groom', 'dazed', 'fall']);
  const REST = new Set(['sit', 'sit-blink', 'sit-happy', 'sit-worried', 'sit-stressed', 'mew', 'purr', 'groom']);
  const WALK = ['walk-1', 'walk-2', 'walk-3', 'walk-4'];
  const WALK8 = ['walk8-1', 'walk8-2', 'walk8-3', 'walk8-4', 'walk8-5', 'walk8-6', 'walk8-7', 'walk8-8'];
  const BOX_W = 48;
  const BOX_H = 66;
  const CANCEL = Symbol('cancel');

  const CSS = `
    /* Only her visible frame takes clicks (set per frame in render), so she never blocks the page. */
    .pet { position: absolute; left: 0; top: auto; bottom: calc(100% - 4px); width: ${BOX_W}px; height: ${BOX_H}px;
      pointer-events: none; z-index: 1; will-change: transform; -webkit-tap-highlight-color: transparent; }
    .pet .rig { position: absolute; inset: 0; transform-origin: 50% 100%; will-change: transform;
      filter: drop-shadow(0 .5px .8px rgba(70, 70, 100, .45)) drop-shadow(0 2px 3px rgba(40, 40, 80, .14)); }
    .pet img { position: absolute; opacity: 0; pointer-events: none; cursor: pointer; user-select: none; -webkit-user-drag: none; }
    .pet .shadow { position: absolute; left: 50%; bottom: -3px; width: 44px; height: 7px; margin-left: -22px; border-radius: 50%;
      background: radial-gradient(closest-side, rgba(40, 40, 80, .22), rgba(40, 40, 80, 0)); pointer-events: none; will-change: transform, opacity; }
    .pet .fx { position: absolute; left: 50%; top: -6px; pointer-events: none; font: 700 14px ui-sans-serif, system-ui, sans-serif;
      color: #f07fa8; white-space: nowrap; z-index: 3; opacity: 0; text-shadow: 0 1px 0 #fff, 0 0 4px rgba(255,255,255,.95); }
    .pet .fx.dark { color: #6b6680; }
    .pet .fx.gold { color: #e8b93c; }
    .pet .fx.z { color: #9a9ab0; font-size: 11px; }
  `;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = (t) => t * t * (3 - 2 * t);
  const spring = (k, c, x) => ({ x, v: 0, t: x, k, c });
  const stepSpring = (s, h) => { s.v += (-s.k * (s.x - s.t) - s.c * s.v) * h; s.x += s.v * h; };

  AM.PET_SMOOTH_CSS = CSS;
  AM.createPetSmooth = (pill, hostEl) => {
    const frames = AM.IRIS_FRAMES || {};
    if (!frames.sit) return null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TS = () => AM.irisTimeScale || 1;

    const el = document.createElement('div');
    el.className = 'pet';
    el.title = 'Iris — click to pet';
    const shadow = document.createElement('div');
    shadow.className = 'shadow';
    const rig = document.createElement('div');
    rig.className = 'rig';
    el.append(shadow, rig);

    const imgs = {};
    for (const [name, f] of Object.entries(frames)) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = chrome.runtime.getURL(`src/assets/iris/${f.file || name + '.webp'}`);
      img.style.cssText = `width:${f.w}px;height:${f.h}px;left:${BOX_W / 2 - f.ax}px;bottom:${-f.ay}px;transform-origin:${f.ax}px 100%`;
      img._o = 0; img._z = 0; img._f = 1; img._p = 'none';
      rig.append(img);
      if (img.decode) img.decode().catch(() => {});
      imgs[name] = img;
    }
    pill.append(el);

    // ---- state ----
    let alive = true, gen = 0, now = 0, last = performance.now(), raf = 0;
    let x = 0, y = 0, dir = 1, vel = 0, phase = 0;
    let mood = 'happy', busy = false, reacting = false, inAir = false, walking = false, sleeping = false;
    let base = 'sit', over = null, overT = 0, overA = 0, fadeMs = 120;
    let walkOn = false, sleepOn = false, sleepT0 = 0, nextZ = 0;
    let piv = 0, pivT = 0, bob = 0, breathAmp = 0, shadowA = 1, brainWake = 900, clicks = [];
    // Turn-swap: front<->side changes happen while she's squeezed thin (a turn), never as a crossfade.
    let sqz = 1, sqzStart = -1, sqzPose = null, hopS = 1, gaitAmp = 0;
    const SQZ_MS = 190;
    const gait = () => { const g = AM.irisGait || 'walk8'; return g === 'walk8' && !frames['walk8-1'] ? 'hop' : g; };
    const HOP = frames['walk8-1'] ? 'walk8-1' : 'walk-2';
    const cycle = () => (gait() === 'walk8' ? WALK8 : WALK);
    const sq = spring(420, 13, 1);   // squash/stretch (y scale), bouncy
    const rot = spring(180, 17, 0);  // tilt, degrees
    const fl = spring(900, 54, 1);   // mirror, -1..1 (animates through 0 on a turn)
    const kick = (v) => { sq.v += v; };

    // ---- virtual-clock tasks (cancelled when gen changes, unless persistent) ----
    const tasks = new Set();
    const task = (dur, fn, persist) => new Promise((res, rej) => tasks.add({ start: now, dur, fn, res, rej, g: persist ? null : gen }));
    const W = (ms) => task(ms);
    const tween = (ms, fn) => task(ms, fn);
    const run = (fn, persist) => task(Infinity, fn, persist);

    // ---- poses ----
    const shown = () => (over && overA >= 0.5 ? over : base);
    const pose = (n, ms = 130) => {
      if (!imgs[n]) n = 'sit';
      walkOn = false;
      sleepOn = false;
      if (sqzPose) { sqzPose = n; return; }
      base = shown();
      if (ms > 0 && !reduce && base !== n && FRONT.has(base) !== FRONT.has(n)) {
        over = null; overT = 0; overA = 0;
        sqzPose = n; sqzStart = now;
        return;
      }
      over = null; overT = 0; overA = 0;
      if (base === n) return;
      if (ms <= 0) { base = n; return; }
      over = n; fadeMs = ms;
    };
    const idleFrame = () => (mood === 'sleep' ? 'sleep' : mood === 'worried' ? 'sit-worried' : mood === 'stressed' ? 'sit-stressed' : 'sit');
    const faceTo = (d) => { if (d) { dir = d < 0 ? -1 : 1; fl.t = dir; } };
    const setAir = (on) => { inAir = on; pivT = on ? 26 : 0; };
    const bounds = () => { const w = pill.offsetWidth; return { min: 4, max: Math.max(4, w - BOX_W - 4), w, h: pill.offsetHeight }; };
    const roomFor = (side) => { const r = hostEl.getBoundingClientRect(); return side < 0 ? r.left > BOX_W + 30 : innerWidth - r.right > BOX_W + 30; };

    const particle = (text, { dx = 0, delay = 0, tone = '', x0 = 0, y0 = -6, rise = 40, dur = 1250 } = {}) => {
      setTimeout(() => {
        if (!alive) return;
        const p = document.createElement('span');
        p.className = 'fx' + (tone ? ' ' + tone : '');
        p.textContent = text;
        p.style.left = `calc(50% + ${x0}px)`;
        p.style.top = y0 + 'px';
        el.append(p);
        const a = p.animate([
          { opacity: 0, transform: 'translate(-50%, 0) scale(.5)' },
          { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.3}px), -10px) scale(1.15)`, offset: 0.2, easing: 'cubic-bezier(.2,.8,.3,1)' },
          { opacity: 0, transform: `translate(calc(-50% + ${dx}px), -${rise}px) scale(.9)` },
        ], { duration: dur / TS(), easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' });
        a.onfinish = () => p.remove();
      }, delay / TS());
    };

    // ---- the clock ----
    const update = (ms) => {
      const s = ms / 1000;
      for (const t of [...tasks]) {
        if (t.g !== null && t.g !== gen) { tasks.delete(t); t.rej(CANCEL); continue; }
        let done;
        if (t.dur === Infinity) done = !!(t.fn && t.fn(s));
        else { const p = Math.min(1, (now - t.start) / t.dur); if (t.fn) t.fn(p, s); done = p >= 1; }
        if (done) { tasks.delete(t); t.res(); }
      }
      for (let h = s; h > 0; h -= 1 / 120) { const d = Math.min(h, 1 / 120); stepSpring(sq, d); stepSpring(rot, d); stepSpring(fl, d); }
      piv += (pivT - piv) * Math.min(1, s * 14);

      if (sqzStart >= 0) {
        const t = (now - sqzStart) / SQZ_MS;
        if (t >= 0.5 && sqzPose) { base = sqzPose; sqzPose = null; over = null; overA = 0; kick(0.7); }
        if (t >= 1) { sqzStart = -1; sqz = 1; } else sqz = 1 - 0.88 * Math.sin(Math.PI * t);
      }
      hopS = 1;
      if (walkOn && gait() === 'hop') {
        base = HOP; over = null; overA = 0;
        const a = Math.abs(Math.sin(Math.PI * phase));
        bob = -2.6 * gaitAmp * a;
        hopS = 1 - 0.045 * gaitAmp * Math.pow(1 - a, 5);          // squash on each paw contact
        rot.t = -dir * 1.6 * gaitAmp * Math.cos(Math.PI * (phase % 1)); // nose up rising, down landing
      } else if (walkOn) {
        const C = cycle(), n = C.length, p = ((phase % n) + n) % n, i = Math.floor(p);
        base = C[i]; over = C[(i + 1) % n];
        overA = smooth(n === 8 ? 0.6 : 0.45, 1, p - i); // short blend into the next pose at the end of each frame
        // 8-frame art already carries its own body bob; the old 4 frames need it added
        bob = -(n === 8 ? 0.5 : 1.3) * gaitAmp * (0.5 - 0.5 * Math.cos((Math.PI * phase * 4) / n));
        rot.t = 0;
      } else {
        bob *= Math.max(0, 1 - s * 12);
        if (sleepOn) { base = 'sleep'; over = 'sleep-2'; overA = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now - sleepT0)) / 3400); }
        else if (over) {
          overT += ms / fadeMs;
          overA = ease(Math.min(1, overT));
          if (overT >= 1) { base = over; over = null; overA = 0; overT = 0; }
        }
      }
      const cur = shown();
      const breathe = !reduce && !inAir && !walkOn && (REST.has(cur) || sleepOn) ? (sleepOn ? 1.3 : 1) : 0;
      breathAmp += (breathe - breathAmp) * Math.min(1, s * 4);
      shadowA += ((inAir ? 0 : 1) - shadowA) * Math.min(1, s * 14);
      if (sleepOn && now > nextZ) {
        particle('z', { tone: 'z', x0: 16, y0: 14, dx: 10, rise: 26, dur: 2200 });
        nextZ = now + 1500;
      }
      if (trip && trip.watch && !trip.broken) checkPerch(trip);
    };

    const render = () => {
      const period = sleepOn ? 4400 : mood === 'stressed' ? 1800 : 3600;
      const br = breathAmp * Math.sin((2 * Math.PI * now) / period);
      const sy = (sq.x + br * 0.012) * hopS * (1 + 0.05 * (1 - sqz));
      const sx = (1 + (1 - sq.x) * 0.9 - br * 0.005 + (1 - hopS) * 0.8) * sqz;
      const jx = mood === 'stressed' && breathAmp > 0.5 ? 0.35 * Math.sin(now * 0.09) : 0;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      rig.style.transform = `translate3d(${jx.toFixed(2)}px, ${bob.toFixed(2)}px, 0) translateY(${-piv}px) rotate(${rot.x.toFixed(2)}deg) translateY(${piv}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      shadow.style.opacity = shadowA.toFixed(3);
      shadow.style.transform = `scale(${(0.5 + 0.5 * shadowA) * sx}, 1)`;
      const f = fl.x;
      for (const n in imgs) {
        const img = imgs[n];
        const o = n === base ? 1 : n === over ? overA : 0;
        if (img._o !== o) { img.style.opacity = o; img._o = o; }
        const z = n === over ? 2 : 1;
        if (img._z !== z) { img.style.zIndex = z; img._z = z; }
        const pe = n === base && !inAir ? 'auto' : 'none';
        if (img._p !== pe) { img.style.pointerEvents = pe; img._p = pe; }
        if (o > 0 && !FRONT.has(n) && Math.abs(img._f - f) > 0.001) { img.style.transform = `scaleX(${f.toFixed(3)})`; img._f = f; }
      }
    };

    const loop = (t) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const ms = Math.min(50, t - last) * TS();
      last = t;
      now += ms;
      update(ms);
      render();
    };

    // ---- behaviours ----
    async function startWalk(d) {
      kick(-0.9);                      // anticipation: dip before standing up
      await W(90);
      faceTo(d);
      pose(gait() === 'hop' ? HOP : cycle()[0], 150);
      kick(1.1);
      await W(SQZ_MS);
      walkOn = true; walking = true; phase = 0; gaitAmp = 0;
    }

    async function walkTo(tx, sitAfter = true) {
      if (Math.abs(tx - x) < 2) return;
      const d = Math.sign(tx - x);
      if (!walking) await startWalk(d);
      else if (d !== dir) { faceTo(d); kick(-0.5); }
      const vmax = mood === 'stressed' ? 52 : 28;
      const acc = vmax / 0.3;
      const hopping = gait() === 'hop';
      const eight = gait() === 'walk8';
      // px per hop / per walk frame (8-frame cycle ≈ 12 fps calm, ≈ 16 fps stressed)
      const stride = hopping ? (mood === 'stressed' ? 11 : 9) : eight ? (mood === 'stressed' ? 3.2 : 2.35) : mood === 'stressed' ? 4.4 : 3.5;
      await run((s) => {
        const rem = (tx - x) * d;
        if (rem <= 0.2) return true;
        vel = Math.max(3, Math.min(vel + acc * s, vmax, Math.sqrt(2 * acc * rem) + 1));
        const step = Math.min(rem, vel * s);
        x += step * d;
        phase += step / stride;
        gaitAmp = clamp(vel / vmax, 0, 1);
        return false;
      });
      x = tx; vel = 0; gaitAmp = 0;
      if (hopping) rot.t = 0;
      if (sitAfter) await sitDown();
    }

    async function sitDown() {
      walking = false;
      pose(idleFrame(), 190);
      kick(-1.1);
      await W(280);
    }

    async function jumpUp() {
      const b = bounds();
      const land = x < 0 ? b.min : b.max;
      faceTo(land - x || 1);
      rot.t = 0;
      pose('crouch', 140);
      kick(-1.8);
      await W(320);
      pose('jump', 80);
      kick(2.2);
      setAir(true);
      const x0 = x, y0 = y, cx = (x0 + land) / 2, cy = -58;
      await tween(640, (p) => {
        const q = 1 - p;
        x = q * q * x0 + 2 * q * p * cx + p * p * land;
        y = q * q * y0 + 2 * q * p * cy;
        const vx = 2 * q * (cx - x0) + 2 * p * (land - cx);
        const vy = 2 * q * (cy - y0) + 2 * p * (0 - cy);
        rot.t = clamp(Math.atan2(vy, Math.abs(vx) + 1) * 57.3 * 0.25, -16, 16) * dir;
        sq.t = 1 + clamp(Math.abs(vy) / 1800, 0, 0.1);
        if (p > 0.8 && over !== 'crouch' && base !== 'crouch') pose('crouch', 110);
      });
      x = land; y = 0;
      setAir(false);
      rot.t = 0; sq.t = 1;
      kick(-2.8);
      await W(170);
      pose(idleFrame(), 210);
      kick(-0.6);
      await W(260);
    }

    async function fall(side) {
      const b = bounds();
      const edge = side < 0 ? -BOX_W * 0.5 : b.w - BOX_W * 0.5;
      await walkTo(edge, false);
      walking = false;
      faceTo(side);
      pose('teeter', 110);
      kick(-1.0);
      particle('!', { tone: 'dark' });
      await tween(820, (p) => { rot.t = side * 6 * Math.sin(p * Math.PI * 4) * (0.6 + 0.4 * p); });
      rot.t = side * 14;
      await W(120);
      pose('fall', 90);
      setAir(true);
      const gx = side < 0 ? -BOX_W - 10 : b.w + 10, gy = b.h;
      let vx = side * 125, vy = -120;
      await run((s) => {
        vy += 1500 * s;
        x += vx * s; y += vy * s;
        if ((gx - x) * side < 0) { x = gx; vx = 0; }
        rot.t = side * (10 + Math.min(18, Math.max(0, y) * 0.7));
        sq.t = 1 + Math.min(0.1, Math.max(0, vy) / 3000);
        if (y >= gy) { y = gy; return true; }
        return false;
      });
      x = gx;
      setAir(false);
      rot.t = 0; sq.t = 1;
      pose('dazed', 70);
      kick(-3.2);
      particle('✦', { dx: -10, tone: 'gold' });
      particle('✦', { dx: 12, delay: 180, tone: 'gold' });
      particle(pick(['oof', '?!', 'mrow!']), { delay: 350, tone: 'dark' });
      await tween(rand(1400, 2000), (p) => { rot.t = 3.2 * Math.sin(p * Math.PI * 5) * (1 - p * 0.6); });
      rot.t = 0;
      await jumpUp();
    }

    async function groom() {
      pose('groom', 180);
      kick(-0.5);
      await tween(rand(1800, 2600), (p) => { rot.t = 1.3 * Math.sin((now / 1000) * Math.PI * 2 * 1.8) * Math.sin(p * Math.PI); });
      rot.t = 0;
      pose(idleFrame(), 220);
      await W(220);
    }

    async function stretch() {
      faceTo(pick([-1, 1]));
      pose('stretch', 240);
      sq.t = 0.97;
      await W(1300);
      sq.t = 1;
      pose(idleFrame(), 260);
      kick(0.8);
      await W(260);
    }

    async function lieDown() {
      pose('sleep', 480);
      kick(-1.4);
      await W(480);
      sleepOn = true; sleepT0 = now; sleeping = true; nextZ = now + 600;
    }

    async function getUp() {
      pose('stretch', 280);
      sleeping = false;
      kick(0.8);
      await W(900);
      pose(idleFrame(), 280);
      await W(300);
    }

    async function hop() {
      pose('sit-happy', 100);
      particle('♥');
      kick(-1.2);
      await W(110);
      setAir(true);
      kick(1.6);
      const y0 = y;
      await tween(440, (p) => { y = y0 - 72 * p * (1 - p); });
      y = y0;
      setAir(false);
      kick(-2.2);
      await W(520);
      pose(idleFrame(), 200);
    }

    async function purr() {
      pose('purr', 160);
      particle('prrr');
      await tween(1600, (p) => { rot.t = 2.5 * Math.sin(p * Math.PI * 4.4) * Math.sin(p * Math.PI); });
      rot.t = 0;
      await W(250);
      pose(idleFrame(), 220);
    }

    async function mew() {
      pose('mew', 90);
      kick(1.4);
      particle(pick(['mew!', 'nya', 'mrrp']));
      await W(1000);
      pose(idleFrame(), 180);
    }

    async function flip() {
      clicks = [];
      pose('crouch', 100);
      kick(-2);
      await W(160);
      pose('jump', 60);
      setAir(true);
      ['♥', '♥', '♥'].forEach((h, i) => particle(h, { dx: (i - 1) * 20, delay: i * 120 }));
      particle('nya~!', { delay: 300 });
      const y0 = y;
      await tween(780, (p) => {
        y = y0 - 168 * p * (1 - p);
        rot.x = rot.t = -dir * 360 * ease(p);
        rot.v = 0;
      });
      rot.x = rot.t = 0;
      y = y0;
      setAir(false);
      pose('sit-happy', 80);
      kick(-3);
      await W(800);
      pose(idleFrame(), 220);
    }

    async function peek() {
      sleepOn = false;
      pose('stretch', 260);
      particle(pick(['5 more min…', 'mrrp?', '…!']), { tone: 'dark' });
      await W(1500);
      pose('sleep', 380);
      await W(380);
      sleepOn = true; sleepT0 = now;
    }

    // ---- trips: hopping off the pill onto the page itself ----
    const ROOM_ABOVE = 70; // clear space she needs above an edge to stand on it
    let explore = true;
    let dragging = false;
    let trip = null;        // { kind, el, broken, watch, start }
    let pendingTrip = null; // { kind, at }
    let nextIdleTrip = Date.now() + rand(60e3, 180e3);

    // The pet box's resting origin in viewport px (it sits inside the pill's 1px border, 4px below its top).
    const origin = () => { const r = pill.getBoundingClientRect(); return { left: r.left + 1, line: r.top + 5 }; };
    // Where she stands on an element: its top edge, or the bottom edge for a header bar.
    const lineOf = (target, kind) => { const r = target.getBoundingClientRect(); return { r, y: kind === 'header' ? r.bottom : r.top }; };
    const perchable = (target, kind) => {
      if (!target) return false;
      const { r, y: line } = lineOf(target, kind);
      return r.width >= BOX_W + 16 && line >= ROOM_ABOVE && line <= innerHeight - 8 && r.left >= -1 && r.right <= innerWidth + 1;
    };
    const canTrip = () => explore && !reduce && alive && !document.hidden && !dragging && mood !== 'sleep';
    const find = (kind) => AM.findPerch && AM.findPerch(kind, AM.siteId, BOX_W + 16);

    // Break the current trip: cancel whatever she's doing (waits, walks, grooms) so she reacts at once.
    const breakTrip = (reason) => {
      if (!trip || trip.broken) return;
      trip.broken = reason;
      gen++;
    };
    // Runs every frame while perched: if the spot scrolls, resizes, moves or disappears, she falls.
    function checkPerch(t) {
      const target = t.el;
      if (!target.isConnected || (AM.isVisible && !AM.isVisible(target))) return breakTrip('gone');
      const cur = lineOf(target, t.kind);
      const s = t.start;
      if (Math.abs(cur.y - s.y) > 2 || Math.abs(cur.r.left - s.r.left) > 2 || Math.abs(cur.r.width - s.r.width) > 2) breakTrip('moved');
    }

    // Crouch and arc-jump to (tx, ty) in pill-relative px.
    async function leap(tx, ty) {
      walkOn = false; walking = false;
      faceTo(tx - x || dir);
      rot.t = 0;
      pose('crouch', 140);
      kick(-1.8);
      await W(300);
      pose('jump', 80);
      kick(2.2);
      setAir(true);
      const x0 = x, y0 = y;
      const dist = Math.hypot(tx - x0, ty - y0);
      const cx = (x0 + tx) / 2, cy = Math.min(y0, ty) - 40 - Math.min(80, dist * 0.15);
      await tween(Math.min(1100, 520 + dist * 0.7), (p) => {
        const q = 1 - p;
        x = q * q * x0 + 2 * q * p * cx + p * p * tx;
        y = q * q * y0 + 2 * q * p * cy + p * p * ty;
        const vx = 2 * q * (cx - x0) + 2 * p * (tx - cx);
        const vy = 2 * q * (cy - y0) + 2 * p * (ty - cy);
        rot.t = clamp(Math.atan2(vy, Math.abs(vx) + 1) * 57.3 * 0.25, -16, 16) * dir;
        sq.t = 1 + clamp(Math.abs(vy) / 1800, 0, 0.1);
        if (p > 0.8 && over !== 'crouch' && base !== 'crouch') pose('crouch', 110);
      });
      x = tx; y = ty;
      setAir(false);
      rot.t = 0; sq.t = 1;
      kick(-2.8);
      await W(170);
      pose(idleFrame(), 210);
      await W(200);
    }

    // The perch gave way: tumble to the bottom of the window and sit there dazed.
    async function tumble() {
      walkOn = false; walking = false;
      pose('fall', 90);
      setAir(true);
      particle(pick(['oof', 'eep!', '!?']), { tone: 'dark' });
      const gy = Math.max(y + 12, innerHeight - 4 - origin().line);
      let vx = dir * 60, vy = -60;
      const y0 = y;
      await run((s) => {
        vy += 1500 * s;
        x += vx * s; y += vy * s;
        rot.t = dir * (10 + Math.min(18, Math.max(0, y - y0) * 0.1));
        sq.t = 1 + Math.min(0.1, Math.max(0, vy) / 3000);
        if (y >= gy) { y = gy; return true; }
        return false;
      });
      setAir(false);
      rot.t = 0; sq.t = 1;
      pose('dazed', 70);
      kick(-3.2);
      particle('✦', { dx: -10, tone: 'gold' });
      particle('✦', { dx: 12, delay: 180, tone: 'gold' });
      await tween(rand(1200, 1800), (p) => { rot.t = 3.2 * Math.sin(p * Math.PI * 5) * (1 - p * 0.6); });
      rot.t = 0;
    }

    // Jump onto t.el near where she is now, then start watching it.
    async function perchOn(t) {
      t.watch = false;
      const { r, y: line } = lineOf(t.el, t.kind);
      const o = origin();
      const here = o.left + x + BOX_W / 2;
      const cx = clamp(here + rand(-70, 70), r.left + BOX_W / 2 + 8, r.right - BOX_W / 2 - 8);
      await leap(cx - BOX_W / 2 - o.left, line - o.line);
      t.start = lineOf(t.el, t.kind);
      t.watch = true;
    }

    // Horizontal range she can walk on the current perch, in pill-relative px.
    const perchRange = (t) => {
      const { r } = lineOf(t.el, t.kind);
      const o = origin();
      return [r.left + 6 - o.left, r.right - BOX_W - 6 - o.left];
    };

    const stayIdle = async (t) => {
      const [lo, hi] = perchRange(t);
      await walkTo(clamp(x + rand(-90, 90), lo, hi));
      const end = now + rand(5000, 20000);
      while (now < end) {
        const r = Math.random();
        if (r < 0.3) await groom();
        else if (r < 0.5) await walkTo(clamp(x + rand(-60, 60), lo, hi));
        else if (r < 0.62) await mew();
        else await W(rand(1500, 3000));
      }
    };

    // Watch the reply from the composer; when it's done, greet the new message.
    const stayReply = async (t) => {
      pose(mood === 'happy' ? 'sit-happy' : 'sit-worried', 180);
      await W(1400);
      if (mood === 'happy') pose(idleFrame(), 220);
      const t0 = now;
      let started = false;
      while (now - t0 < 180e3) {
        const replying = AM.isReplying ? AM.isReplying(AM.siteId) : false;
        if (replying) started = true;
        if (!replying && (started || now - t0 > 8000)) {
          await W(1200);
          if (!(AM.isReplying && AM.isReplying(AM.siteId))) break;
        }
        await W(300);
      }
      const msg = find('lastMessage');
      if (msg && msg !== t.el && perchable(msg, 'lastMessage')) {
        t.kind = 'lastMessage';
        t.el = msg;
        await perchOn(t);
        await mew();
        await W(900);
      } else {
        pose('sit-happy', 120);
        particle('♥');
        kick(1.2);
        await W(900);
        pose(idleFrame(), 200);
        await W(200);
      }
    };

    const stayAlarm = async () => {
      pose('sit-stressed', 150);
      kick(1);
      particle('!', { tone: 'dark' });
      await W(700);
      particle('!!', { tone: 'dark' });
      await W(rand(2200, 3200));
    };

    const TRIPS = {
      reply: { targets: () => ['composer'], stay: stayReply },
      alarm: { targets: () => ['limitBanner', 'composer'], stay: stayAlarm },
      idle: { targets: () => (Math.random() < 0.35 ? ['header', 'composer'] : ['composer', 'header']), stay: stayIdle },
    };

    async function tripFor(kind) {
      const spec = TRIPS[kind];
      let target = null, tk = null;
      for (const k of spec.targets()) {
        const el = find(k);
        if (perchable(el, k)) { target = el; tk = k; break; }
      }
      if (!target) return false;
      const t = { kind: tk, el: target, broken: null, watch: false, start: null };
      trip = t;
      try {
        await perchOn(t);
        await spec.stay(t);
      } catch (e) {
        if (e !== CANCEL) console.error(e);
      }
      trip = null;
      if (t.broken === 'recall') return true;  // setDragging already put her back on the pill
      if (t.broken) await tumble();
      const b = bounds();
      await leap(clamp(x, b.min, b.max), 0);
      return true;
    }

    // Ask for a trip; the brain starts it as soon as she's free (stale requests are dropped).
    const requestTrip = (kind) => {
      if (!canTrip() || trip) return;
      pendingTrip = { kind, at: Date.now() };
      poke(0);
    };
    const onSend = () => requestTrip('reply');
    const onLimit = () => requestTrip('alarm');
    if (AM.bus) {
      AM.bus.addEventListener('send', onSend);
      AM.bus.addEventListener('limit', onLimit);
    }

    async function behave() {
      if (mood === 'sleep') {
        if (y > 0) await jumpUp();
        if (!sleeping) await lieDown();
        return 6000;
      }
      if (sleeping) await getUp();
      const b = bounds();
      if (reduce) { x = b.max; y = 0; pose(idleFrame(), 0); return 4000; }
      if (y > 0) { await jumpUp(); return rand(1600, 3000); }
      if (y < 0) { await leap(clamp(x, b.min, b.max), 0); return rand(1600, 3000); } // left stranded above the pill
      if (pendingTrip) {
        const p = pendingTrip;
        pendingTrip = null;
        if (Date.now() - p.at < 12000 && canTrip() && (await tripFor(p.kind))) return rand(2500, 5000);
      }
      // Idle explorer: at most one trip every 1-3 minutes, never mid-typing.
      if (canTrip() && Date.now() > nextIdleTrip && !(AM.recentlyTyped && AM.recentlyTyped(6000))) {
        nextIdleTrip = Date.now() + rand(60e3, 180e3);
        if (await tripFor('idle')) return rand(2500, 5000);
      }
      if (x > b.max) { await walkTo(b.max); return 1500; }
      const r = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      if (r < 0.14 && roomFor(side)) await fall(side);
      else if (r < 0.58) await walkTo(rand(b.min, b.max));
      else if (r < 0.76) await groom();
      else if (r < 0.84) await stretch();
      return rand(2200, 5600);
    }

    const cleanup = () => {
      walkOn = false; walking = false; vel = 0; gaitAmp = 0;
      rot.t = 0; sq.t = 1;
      if (!inAir) pivT = 0;
    };

    async function brain() {
      while (alive) {
        await run(() => now >= brainWake, true);
        if (!alive) return;
        if (reacting || busy) { brainWake = now + 1500; continue; }
        busy = true;
        try { brainWake = now + (await behave()); } catch (e) {
          if (e !== CANCEL) console.error(e);
          brainWake = now + 1600;
        } finally { busy = false; }
      }
    }
    const poke = (ms) => { brainWake = Math.min(brainWake, now + ms); };

    async function blinker() {
      while (alive) {
        await task(rand(2600, 6000), null, true);
        if (busy || reacting || shown() !== 'sit' || over || walkOn) continue;
        pose('sit-blink', 50);
        await task(100, null, true);
        if (shown() === 'sit-blink') pose('sit', 80);
        if (Math.random() < 0.25) {
          await task(220, null, true);
          if (shown() !== 'sit' || busy || reacting) continue;
          pose('sit-blink', 45);
          await task(90, null, true);
          if (shown() === 'sit-blink') pose('sit', 80);
        }
      }
    }

    // Runs `fn` as the foreground action, cancelling whatever she was doing.
    async function act(fn) {
      const g = ++gen;
      cleanup();
      reacting = true;
      try { await fn(); } catch (e) { if (e !== CANCEL) console.error(e); } finally {
        if (g === gen) { reacting = false; poke(1600); }
      }
    }

    async function react() {
      const t = Date.now();
      clicks = clicks.filter((c) => t - c < 4000).concat(t);
      if (inAir) return particle('♥');
      // On a trip, a click is a quick bounce and a heart, not something that ends the trip.
      if (trip) { particle('♥'); kick(1.4); return; }
      const burst = clicks.length >= 8 && mood !== 'sleep';
      if (reacting && !burst) return;
      await act(burst ? flip : sleeping ? peek : pick([hop, purr, mew, hop]));
    }

    pose(idleFrame(), 0);
    render();
    raf = requestAnimationFrame(loop);
    brain();
    blinker();

    const ACTIONS = { walk: () => { const b = bounds(); return walkTo(x > (b.min + b.max) / 2 ? b.min : b.max); },
      fall: () => fall(roomFor(1) ? 1 : -1), groom, stretch, hop, purr, mew, flip };

    return {
      el,
      react,
      play(name) { if (!inAir && ACTIONS[name] && mood !== 'sleep') act(ACTIONS[name]); },
      setMood(m) {
        if (m === mood) return;
        const prev = mood;
        mood = m;
        // Crossing into 90%+ raises the alarm once.
        if (m === 'stressed' && prev !== 'stressed' && prev !== 'sleep') requestTrip('alarm');
        if (m !== 'sleep' && !busy && !reacting && !inAir && !walking && !sleeping) pose(idleFrame(), 300);
        if (m !== 'sleep' && sleeping && !busy && !reacting) { gen++; }
        poke(200);
      },
      nudge() { if (!busy && !reacting && !inAir && y === 0 && x > bounds().max) poke(100); },
      setExplore(on) { explore = !!on; },
      // The pill is being dragged: no new trips, and an ongoing one snaps her straight back onto it.
      setDragging(on) {
        dragging = !!on;
        if (on && trip) {
          breakTrip('recall');
          const b = bounds();
          x = clamp(x, b.min, b.max);
          y = 0;
          setAir(false);
          walkOn = false; walking = false; vel = 0;
          rot.t = 0; sq.t = 1;
          pose(idleFrame(), 0);
        }
      },
      get tripping() { return !!trip; },
      destroy() {
        alive = false;
        if (AM.bus) {
          AM.bus.removeEventListener('send', onSend);
          AM.bus.removeEventListener('limit', onLimit);
        }
        cancelAnimationFrame(raf);
        tasks.clear();
        el.remove();
      },
    };
  };

  AM.createPet = AM.createPetSmooth;
  AM.PET_CSS = CSS;
})();
