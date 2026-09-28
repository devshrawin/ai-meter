// Iris, a white Persian who lives on top of the meter pill. Drawn from sprite frames in
// src/assets/iris (built by scripts/build-sprites.py; sizes/anchors in AM.IRIS_FRAMES).
// She sits, blinks, grooms, walks along the pill, sometimes teeters off the edge, tumbles, sits
// dazed and leaps back up. Mood follows usage; clicking her plays a reaction.
(() => {
  const AM = globalThis.AIMeter;
  const F = () => AM.IRIS_FRAMES || {};
  // Front-facing frames are never mirrored, so her blue and amber eyes stay on the right sides.
  const FRONT = new Set(['sit', 'sit-blink', 'sit-happy', 'sit-worried', 'sit-stressed', 'mew', 'purr', 'groom', 'dazed', 'fall']);
  const WALK = ['walk-1', 'walk-2', 'walk-3', 'walk-4'];

  const BOX_W = 48;
  const BOX_H = 66;

  AM.PET_CSS = `
    /* Only her visible frame takes clicks, so she never blocks the page around her. */
    .pet { position: absolute; left: 0; bottom: calc(100% - 4px); width: ${BOX_W}px; height: ${BOX_H}px;
      pointer-events: none; will-change: transform; z-index: 1; }
    .pet img.on { pointer-events: auto; cursor: pointer; }
    .pet.air img.on { pointer-events: none; }
    .pet .face { position: absolute; inset: 0; transform-origin: 50% 100%; }
    .pet .bob { position: absolute; inset: 0; transform-origin: 50% 100%; transition: transform .12s ease-in-out;
      filter: drop-shadow(0 .5px .8px rgba(70, 70, 100, .45)) drop-shadow(0 2px 3px rgba(40, 40, 80, .14)); }
    /* Every frame stays laid out (so it's decoded up front); only opacity changes. A new frame appears
       instantly on top while the previous one fades out beneath it — no flash, no see-through gap. */
    .pet img { position: absolute; opacity: 0; z-index: 1; user-select: none; -webkit-user-drag: none;
      transition: opacity var(--fade, .12s) ease-out; }
    .pet img.on { opacity: 1; z-index: 2; transition: none; }
    .pet.walking { --fade: .09s; }
    .pet.idle .bob { animation: pet-breathe 3.6s ease-in-out infinite; }
    .pet.lying .bob { animation: pet-breathe 4.4s ease-in-out infinite; }
    @keyframes pet-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(.994, 1.014); } }
    .pet .shadow { position: absolute; left: 50%; bottom: -3px; width: 44px; height: 7px; margin-left: -22px;
      border-radius: 50%; background: radial-gradient(closest-side, rgba(40, 40, 80, .22), rgba(40, 40, 80, 0));
      transition: opacity .2s, transform .2s; pointer-events: none; }
    .pet.air .shadow { opacity: 0; transform: scale(.5); }
    .pet .z { position: absolute; display: none; font: 700 12px ui-sans-serif, system-ui, sans-serif; color: #9a9ab0; pointer-events: none; }
    .pet.lying .z { display: block; }
    .pet .z1 { right: -4px; top: 18px; animation: pet-zz 2.4s ease-in-out infinite; }
    .pet .z2 { right: -12px; top: 8px; font-size: 9px; animation: pet-zz 2.4s ease-in-out 1.2s infinite; }
    .pet .fx { position: absolute; left: 50%; top: -6px; pointer-events: none; font: 700 14px ui-sans-serif, system-ui, sans-serif;
      color: #f07fa8; white-space: nowrap; animation: pet-float 1.25s ease-out forwards; z-index: 2;
      text-shadow: 0 1px 0 #fff, 0 0 4px rgba(255,255,255,.95); }
    .pet .fx.dark { color: #6b6680; }
    .pet .fx.gold { color: #e8b93c; }
    @keyframes pet-zz { 0% { opacity: 0; transform: translate(0,4px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(8px,-10px); } }
    @keyframes pet-float { 0% { opacity: 0; transform: translate(-50%,0) scale(.6); } 20% { opacity: 1; transform: translate(-50%,-8px) scale(1.12); }
      100% { opacity: 0; transform: translate(calc(-50% + var(--dx,0px)), -40px); } }
    @media (prefers-reduced-motion: reduce) { .pet *, .pet { animation: none !important; transition: none !important; } }
  `;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  AM.createPet = (pill, hostEl) => {
    const frames = F();
    if (!frames.sit) return null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const el = document.createElement('div');
    el.className = 'pet';
    el.title = 'Iris — click to pet';
    const face = document.createElement('div');
    face.className = 'face';
    const bob = document.createElement('div');
    bob.className = 'bob';
    face.append(bob);
    const shadow = document.createElement('div');
    shadow.className = 'shadow';
    el.append(shadow, face);
    el.insertAdjacentHTML('beforeend', '<span class="z z1">z</span><span class="z z2">z</span>');

    const imgs = {};
    for (const [name, f] of Object.entries(frames)) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = chrome.runtime.getURL(`src/assets/iris/${name}.webp`);
      img.style.cssText = `width:${f.w}px;height:${f.h}px;left:${BOX_W / 2 - f.ax}px;bottom:${-f.ay}px`;
      bob.append(img);
      if (img.decode) img.decode().catch(() => {});
      imgs[name] = img;
    }
    pill.append(el);

    let cur = null;
    let dir = 1;
    let x = 0;
    let y = 0;
    let mood = 'happy';
    let alive = true;
    let busy = false;
    let reacting = false;
    let inAir = false;
    let anim = null;
    let timer = null;
    let walkTimer = null;
    let blinkTimer = null;
    let breathTimer = null;
    let clicks = [];

    // --- frames ---
    const RESTING = new Set(['sit', 'sit-blink', 'sit-worried', 'sit-stressed']);
    const show = (name) => {
      if (!imgs[name]) name = 'sit';
      if (cur === name) return applyDir();
      if (cur) imgs[cur].classList.remove('on');
      imgs[name].classList.add('on');
      cur = name;
      el.classList.toggle('idle', RESTING.has(name));
      applyDir();
    };
    const applyDir = () => {
      face.style.transform = dir < 0 && !FRONT.has(cur) ? 'scaleX(-1)' : '';
    };
    const faceTo = (d) => { if (d) { dir = d < 0 ? -1 : 1; applyDir(); } };
    const idleFrame = () => (mood === 'sleep' ? 'sleep' : mood === 'worried' ? 'sit-worried' : mood === 'stressed' ? 'sit-stressed' : 'sit');
    const idle = () => show(idleFrame());

    // Legs cycle through the 4 walk frames; the body dips on each footfall (frames 1 and 3).
    const startWalkCycle = () => {
      let i = 0;
      el.classList.add('walking');
      show(WALK[0]);
      bob.style.transform = 'translateY(0)';
      clearInterval(walkTimer);
      walkTimer = setInterval(() => {
        i = (i + 1) % WALK.length;
        show(WALK[i]);
        bob.style.transform = i % 2 ? 'translateY(-1.2px)' : 'translateY(0)';
      }, mood === 'stressed' ? 90 : 125);
    };
    const stopWalkCycle = () => {
      clearInterval(walkTimer);
      walkTimer = null;
      el.classList.remove('walking');
      bob.style.transform = '';
    };

    const scheduleBlink = () => {
      clearTimeout(blinkTimer);
      blinkTimer = setTimeout(async () => {
        if (!alive) return;
        if (cur === 'sit' && !busy && !reacting && !document.hidden) {
          show('sit-blink');
          await sleep(140);
          if (cur === 'sit-blink') show('sit');
          if (Math.random() < 0.25) { await sleep(160); if (cur === 'sit') { show('sit-blink'); await sleep(120); if (cur === 'sit-blink') show('sit'); } }
        }
        scheduleBlink();
      }, rand(2600, 6000));
    };

    const breathe = (on) => {
      clearInterval(breathTimer);
      breathTimer = null;
      if (!on) return;
      let b = false;
      breathTimer = setInterval(() => {
        if (cur === 'sleep' || cur === 'sleep-2') show((b = !b) ? 'sleep-2' : 'sleep');
      }, 1700);
    };

    // --- motion helpers ---
    const T = (tx, ty, extra = '') => `translate(${tx}px, ${ty}px) ${extra}`;
    const place = () => { el.style.transform = T(x, y); };
    const air = (on) => { inAir = on; el.classList.toggle('air', on); };
    const bounds = () => {
      const w = pill.offsetWidth;
      return { min: 4, max: Math.max(4, w - BOX_W - 4), w, h: pill.offsetHeight };
    };
    const roomFor = (side) => {
      const r = hostEl.getBoundingClientRect();
      return side < 0 ? r.left > BOX_W + 30 : innerWidth - r.right > BOX_W + 30;
    };

    const particle = (text, { dx = 0, delay = 0, tone = '' } = {}) => {
      setTimeout(() => {
        if (!alive) return;
        const p = document.createElement('span');
        p.className = 'fx' + (tone ? ' ' + tone : '');
        p.textContent = text;
        p.style.setProperty('--dx', dx + 'px');
        el.append(p);
        setTimeout(() => p.remove(), 1350);
      }, delay);
    };

    const move = async (keyframes, opts) => {
      anim = el.animate(keyframes, { fill: 'forwards', ...opts });
      try {
        await anim.finished;
      } catch {
        return false;
      }
      anim.cancel();
      anim = null;
      return true;
    };
    const faceAnim = (keyframes, opts) => face.animate(keyframes, opts).finished.catch(() => {});
    const squash = () => faceAnim(
      [{ transform: `${face.style.transform} scale(1,1)` }, { transform: `${face.style.transform} scale(1.12,.86)` }, { transform: `${face.style.transform} scale(1,1)` }],
      { duration: 280, easing: 'ease-out' });
    const wobble = (deg, times, ms) => faceAnim(
      [0, 1, 2, 3, 4].map((i) => ({ transform: `${face.style.transform} rotate(${i % 2 ? deg : i === 0 || i === 4 ? 0 : -deg}deg)` })),
      { duration: ms, iterations: times, easing: 'ease-in-out' });

    const interrupt = () => {
      if (!anim) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      x = m.m41;
      y = m.m42;
      anim.cancel();
      anim = null;
      stopWalkCycle();
      place();
    };

    // --- behaviours ---
    async function walkTo(tx) {
      const dx = tx - x;
      if (Math.abs(dx) < 2) return true;
      faceTo(dx);
      startWalkCycle();
      const speed = mood === 'stressed' ? 52 : 28;
      // Near-linear so feet don't skate, with a gentle start and stop.
      const ok = await move([{ transform: T(x, y) }, { transform: T(tx, y) }],
        { duration: (Math.abs(dx) / speed) * 1000 + 160, easing: 'cubic-bezier(.35,.08,.65,.92)' });
      stopWalkCycle();
      if (ok) {
        x = tx;
        place();
        idle();
      }
      return ok;
    }

    async function jumpUp() {
      const b = bounds();
      const land = x < 0 ? b.min : b.max;
      faceTo(land - x);
      show('crouch');
      await sleep(300);
      show('jump');
      air(true);
      await move([
        { transform: T(x, y) },
        { transform: T((x + land) / 2, -38), offset: 0.55 },
        { transform: T(land, 0) },
      ], { duration: 720, easing: 'cubic-bezier(.3,.7,.4,1)' });
      air(false);
      x = land;
      y = 0;
      place();
      show('crouch');
      await squash();
      idle();
    }

    async function fall(side) {
      const b = bounds();
      const edge = side < 0 ? -BOX_W * 0.5 : b.w - BOX_W * 0.5;
      if (!(await walkTo(edge))) return;
      faceTo(side);
      show('teeter');
      particle('!', { tone: 'dark' });
      await wobble(7, 2, 360);
      const gx = side < 0 ? -BOX_W - 10 : b.w + 10;
      const gy = b.h;
      show('fall');
      air(true);
      await move([
        { transform: T(x, 0, 'rotate(0deg)') },
        { transform: T((x + gx) / 2, gy * 0.2, `rotate(${side * 25}deg)`), offset: 0.4 },
        { transform: T(gx, gy, `rotate(${side * 8}deg)`) },
      ], { duration: 560, easing: 'cubic-bezier(.5,0,.9,.55)' });
      air(false);
      x = gx;
      y = gy;
      place();
      show('dazed');
      await squash();
      particle('✦', { dx: -10, tone: 'gold' });
      particle('✦', { dx: 12, delay: 180, tone: 'gold' });
      particle(pick(['oof', '?!', 'mrow!']), { delay: 350, tone: 'dark' });
      await sleep(rand(1300, 2000));
      if (!alive) return;
      await jumpUp();
    }

    // --- trips: hopping off the pill onto the page itself ---
    const ROOM_ABOVE = 70;  // clear space she needs above an edge to stand on it
    let explore = true;
    let dragging = false;
    let trip = null;        // { kind, el, broken }
    let pendingTrip = null; // { run, at }
    let nextIdleTrip = Date.now() + rand(60e3, 180e3);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    // The pet box's resting origin, in viewport px: its left edge and the pill-top line it stands on.
    // (The pet sits inside the pill's 1px border, 4px below its top edge.)
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

    // Wait up to `ms`, returning early (false) if `ok()` stops holding.
    const hold = async (ms, ok) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (!ok()) return false;
        await sleep(120);
      }
      return true;
    };

    // Crouch, arc-jump to (tx, ty) in pill-relative px, land.
    async function leap(tx, ty) {
      const dx = tx - x;
      faceTo(dx || dir);
      show('crouch');
      await sleep(260);
      show('jump');
      air(true);
      const dist = Math.hypot(dx, ty - y);
      const apex = Math.min(y, ty) - 30 - Math.min(70, dist * 0.12);
      const ok = await move([
        { transform: T(x, y) },
        { transform: T((x + tx) / 2, apex), offset: 0.5 },
        { transform: T(tx, ty) },
      ], { duration: Math.min(1200, 540 + dist * 0.8), easing: 'cubic-bezier(.3,.6,.4,1)' });
      air(false);
      if (!ok) return false;
      x = tx;
      y = ty;
      place();
      show('crouch');
      await squash();
      idle();
      return true;
    }

    // The perch gave way: tumble to the bottom of the window and sit there dazed.
    async function tumble() {
      stopWalkCycle();
      const floor = innerHeight - 4 - origin().line;
      const ground = Math.max(y + 12, floor);
      const d = ground - y;
      show('fall');
      particle(pick(['oof', 'eep!', '!?']), { tone: 'dark' });
      air(true);
      await move([
        { transform: T(x, y, 'rotate(0deg)') },
        { transform: T(x + dir * 8, y + d * 0.3, `rotate(${dir * 22}deg)`), offset: 0.35 },
        { transform: T(x + dir * 14, ground, `rotate(${dir * 6}deg)`) },
      ], { duration: Math.min(1000, 380 + Math.sqrt(d) * 26), easing: 'cubic-bezier(.5,0,.9,.55)' });
      air(false);
      x += dir * 14;
      y = ground;
      place();
      show('dazed');
      await squash();
      particle('✦', { dx: -10, tone: 'gold' });
      particle('✦', { dx: 12, delay: 180, tone: 'gold' });
      await sleep(rand(1100, 1700));
    }

    // Keep checking the perch every frame; if it scrolls, resizes, moves or disappears, she falls.
    function watchPerch(t) {
      const target = t.el;
      const start = lineOf(target, t.kind);
      const check = () => {
        if (trip !== t || t.broken || t.el !== target) return;
        if (!target.isConnected || !(AM.isVisible ? AM.isVisible(target) : true)) t.broken = 'gone';
        else {
          const now = lineOf(target, t.kind);
          if (Math.abs(now.y - start.y) > 2 || Math.abs(now.r.left - start.r.left) > 2 || Math.abs(now.r.width - start.r.width) > 2) t.broken = 'moved';
        }
        if (t.broken) interrupt();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }

    // Jump onto `target`, landing near where she is now, and start watching it.
    async function perchOn(t, target) {
      t.el = target;
      const { r, y: line } = lineOf(target, t.kind);
      const o = origin();
      const here = o.left + x + BOX_W / 2;
      const cx = clamp(here + rand(-70, 70), r.left + BOX_W / 2 + 8, r.right - BOX_W / 2 - 8);
      if (!(await leap(cx - BOX_W / 2 - o.left, line - o.line))) return false;
      if (t.broken) return false;
      watchPerch(t);
      return true;
    }

    // Horizontal range she can walk on the current perch, in pill-relative px.
    const perchRange = (t) => {
      const { r } = lineOf(t.el, t.kind);
      const o = origin();
      return [r.left + 6 - o.left, r.right - BOX_W - 6 - o.left];
    };

    async function runTrip(kind, target, stay) {
      busy = true;
      breathe(false);
      el.classList.remove('lying');
      const t = { kind, el: target, broken: null };
      trip = t;
      try {
        if (!(await perchOn(t, target))) return;
        await stay(t);
        if (t.broken && t.broken !== 'recall') await tumble();
      } finally {
        trip = null;
        if (t.broken === 'recall') {
          const b = bounds();
          x = clamp(x, b.min, b.max);
          y = 0;
          place();
          idle();
        } else if (alive) {
          const b = bounds();
          await leap(clamp(x, b.min, b.max), 0);
        }
        busy = false;
        next(rand(2500, 5000));
      }
    }

    // Run a trip now, or as soon as she's free (dropped if it's gone stale).
    function requestTrip(run) {
      if (!canTrip() || trip) return;
      if (busy || reacting || inAir) pendingTrip = { run, at: Date.now() };
      else run();
    }
    function runPending() {
      const p = pendingTrip;
      pendingTrip = null;
      if (p && Date.now() - p.at < 12000 && canTrip() && !trip) setTimeout(p.run, 60);
    }

    const stayIdle = async (t) => {
      const [lo, hi] = perchRange(t);
      await walkTo(clamp(x + rand(-90, 90), lo, hi));
      const end = Date.now() + rand(5000, 20000);
      while (!t.broken && Date.now() < end) {
        const r = Math.random();
        if (r < 0.3) { show('groom'); await hold(rand(1500, 2500), () => !t.broken); idle(); }
        else if (r < 0.5) await walkTo(clamp(x + rand(-60, 60), lo, hi));
        else if (r < 0.62) { show('mew'); particle(pick(['mew', 'nya'])); await hold(900, () => !t.broken); idle(); }
        else { idle(); await hold(rand(1500, 3000), () => !t.broken); }
      }
    };

    // Sit on the composer watching the reply; when it's done, greet the new message, then go home.
    const stayReply = async (t) => {
      show(mood === 'happy' ? 'sit-happy' : 'sit-worried');
      await hold(1400, () => !t.broken);
      if (mood === 'happy') idle();
      const t0 = Date.now();
      let started = false;
      while (!t.broken && Date.now() - t0 < 180e3) {
        const replying = AM.isReplying ? AM.isReplying(AM.siteId) : false;
        if (replying) started = true;
        if (!replying && (started || Date.now() - t0 > 8000)) {
          await hold(1200, () => !t.broken);
          if (!(AM.isReplying && AM.isReplying(AM.siteId))) break;
        }
        await sleep(300);
      }
      if (t.broken) return;
      const msg = find('lastMessage');
      if (msg && msg !== t.el && perchable(msg, 'lastMessage')) {
        t.kind = 'lastMessage';
        if (!(await perchOn(t, msg))) return;
        show('mew');
        particle(pick(['mew!', 'nya~', 'ooh']));
        await hold(1300, () => !t.broken);
        idle();
        await hold(900, () => !t.broken);
      } else {
        show('sit-happy');
        particle('♥');
        await hold(900, () => !t.broken);
      }
    };

    const stayAlarm = async (t) => {
      show('sit-stressed');
      particle('!', { tone: 'dark' });
      await hold(700, () => !t.broken);
      particle('!!', { tone: 'dark' });
      await hold(rand(2200, 3200), () => !t.broken);
    };

    const tripTo = (kind, stay, targetKinds) => () => {
      if (!canTrip() || trip || busy || reacting) return;
      for (const k of targetKinds) {
        const target = find(k);
        if (perchable(target, k)) return runTrip(k === 'composer' ? 'composer' : k, target, stay);
      }
    };
    const replyTrip = tripTo('reply', stayReply, ['composer']);
    const alarmTrip = tripTo('alarm', stayAlarm, ['limitBanner', 'composer']);

    const onSend = () => requestTrip(replyTrip);
    const onLimit = () => requestTrip(alarmTrip);
    if (AM.bus) {
      AM.bus.addEventListener('send', onSend);
      AM.bus.addEventListener('limit', onLimit);
    }

    async function tick() {
      if (!alive) return;
      if (document.hidden || busy || reacting) return next(2000);
      if (pendingTrip) return runPending();
      // Idle explorer: at most one trip every 1-3 minutes, only from the pill, never mid-typing.
      if (canTrip() && y === 0 && Date.now() > nextIdleTrip && !(AM.recentlyTyped && AM.recentlyTyped(6000))) {
        nextIdleTrip = Date.now() + rand(60e3, 180e3);
        const kinds = Math.random() < 0.35 ? ['header', 'composer'] : ['composer', 'header'];
        for (const k of kinds) {
          const target = find(k);
          if (perchable(target, k)) return runTrip(k, target, stayIdle);
        }
      }
      busy = true;
      try {
        if (mood === 'sleep') {
          if (y > 0) await jumpUp();
          el.classList.add('lying');
          show('sleep');
          breathe(true);
          return;
        }
        breathe(false);
        el.classList.remove('lying');
        const b = bounds();
        if (reduce) {
          x = b.max;
          y = 0;
          place();
          idle();
          return;
        }
        if (y > 0) return await jumpUp();
        if (x > b.max) return await walkTo(b.max);
        const r = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;
        if (r < 0.14 && roomFor(side)) await fall(side);
        else if (r < 0.58) await walkTo(rand(b.min, b.max));
        else if (r < 0.76) { show('groom'); await sleep(rand(1600, 2600)); idle(); }
        else if (r < 0.84) { faceTo(pick([-1, 1])); show('stretch'); await sleep(1300); idle(); }
        else idle();
      } finally {
        busy = false;
        if (pendingTrip) runPending();
        else next(mood === 'sleep' ? 6000 : rand(2200, 5600));
      }
    }

    function next(ms) {
      clearTimeout(timer);
      if (alive) timer = setTimeout(tick, ms);
    }

    async function react() {
      const now = Date.now();
      clicks = clicks.filter((t) => now - t < 4000).concat(now);
      if (inAir) return particle('♥');
      const burst = clicks.length >= 8 && mood !== 'sleep';
      if (reacting && !burst) return;
      interrupt();
      reacting = true;
      try {
        if (mood === 'sleep') {
          breathe(false);
          show('stretch');
          particle(pick(['5 more min…', 'mrrp?', '…!']), { tone: 'dark' });
          await sleep(1500);
          show('sleep');
          breathe(true);
        } else if (burst) {
          clicks = [];
          show('jump');
          ['♥', '♥', '♥'].forEach((h, i) => particle(h, { dx: (i - 1) * 20, delay: i * 120 }));
          particle('nya~!', { delay: 300 });
          air(true);
          await move([
            { transform: T(x, y, 'rotate(0deg)') },
            { transform: T(x, y - 40, 'rotate(-180deg)'), offset: 0.5 },
            { transform: T(x, y, 'rotate(-360deg)') },
          ], { duration: 820, easing: 'ease-in-out' });
          air(false);
          place();
          show('sit-happy');
          await squash();
          await sleep(700);
          idle();
        } else {
          const kind = pick(['hop', 'purr', 'mew', 'hop']);
          if (kind === 'hop') {
            show('sit-happy');
            particle('♥');
            air(true);
            await move([{ transform: T(x, y) }, { transform: T(x, y - 18), offset: 0.45 }, { transform: T(x, y) }], { duration: 520, easing: 'ease-out' });
            air(false);
            place();
            await squash();
            await sleep(500);
          } else if (kind === 'purr') {
            show('purr');
            particle('prrr');
            await wobble(2.5, 5, 150);
            await sleep(400);
          } else {
            show('mew');
            particle(pick(['mew!', 'nya', 'mrrp']));
            await sleep(1100);
          }
          idle();
        }
      } finally {
        reacting = false;
        if (pendingTrip && !trip) runPending();
        else next(1600);
      }
    }

    place();
    idle();
    scheduleBlink();
    next(900);

    return {
      el,
      react,
      setMood(m) {
        if (m === mood) return;
        const prev = mood;
        mood = m;
        // Crossing into 90%+: raise the alarm once.
        if (m === 'stressed' && prev !== 'stressed' && prev !== 'sleep') setTimeout(() => requestTrip(alarmTrip), 400);
        if (m !== 'sleep') {
          el.classList.remove('lying');
          breathe(false);
        }
        if (!busy && !reacting && !inAir && !walkTimer) idle();
        if (!busy && !reacting) next(200);
      },
      // Called after the pill's width changes, so she isn't left floating past the end.
      nudge() {
        if (!busy && !reacting && !inAir && y === 0 && x > bounds().max) next(100);
      },
      setExplore(on) { explore = !!on; },
      // The pill is being dragged: no new trips, and an ongoing one snaps her back onto it.
      setDragging(on) {
        dragging = !!on;
        if (on && trip) {
          trip.broken = 'recall';
          interrupt();
          const b = bounds();
          x = clamp(x, b.min, b.max);
          y = 0;
          place();
          idle();
        }
      },
      get tripping() { return !!trip; },
      destroy() {
        alive = false;
        if (AM.bus) {
          AM.bus.removeEventListener('send', onSend);
          AM.bus.removeEventListener('limit', onLimit);
        }
        clearTimeout(timer);
        clearTimeout(blinkTimer);
        stopWalkCycle();
        breathe(false);
        if (anim) anim.cancel();
        el.remove();
      },
    };
  };
})();
