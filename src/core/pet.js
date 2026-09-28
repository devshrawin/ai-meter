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
    .pet { position: absolute; left: 0; bottom: calc(100% - 4px); width: ${BOX_W}px; height: ${BOX_H}px;
      cursor: pointer; will-change: transform; z-index: 1; }
    .pet .face { position: absolute; inset: 0; transform-origin: 50% 100%; }
    .pet img { position: absolute; display: none; pointer-events: none; user-select: none; -webkit-user-drag: none;
      filter: drop-shadow(0 .5px .8px rgba(70, 70, 100, .45)) drop-shadow(0 2px 3px rgba(40, 40, 80, .14)); }
    .pet img.on { display: block; }
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
      face.append(img);
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
    const show = (name) => {
      if (!imgs[name]) name = 'sit';
      if (cur === name) return applyDir();
      if (cur) imgs[cur].classList.remove('on');
      imgs[name].classList.add('on');
      cur = name;
      applyDir();
    };
    const applyDir = () => {
      face.style.transform = dir < 0 && !FRONT.has(cur) ? 'scaleX(-1)' : '';
    };
    const faceTo = (d) => { if (d) { dir = d < 0 ? -1 : 1; applyDir(); } };
    const idleFrame = () => (mood === 'sleep' ? 'sleep' : mood === 'worried' ? 'sit-worried' : mood === 'stressed' ? 'sit-stressed' : 'sit');
    const idle = () => show(idleFrame());

    const startWalkCycle = () => {
      let i = 0;
      show(WALK[0]);
      clearInterval(walkTimer);
      walkTimer = setInterval(() => show(WALK[++i % WALK.length]), mood === 'stressed' ? 85 : 135);
    };
    const stopWalkCycle = () => { clearInterval(walkTimer); walkTimer = null; };

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
      const ok = await move([{ transform: T(x, y) }, { transform: T(tx, y) }], { duration: (Math.abs(dx) / speed) * 1000, easing: 'linear' });
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

    async function tick() {
      if (!alive) return;
      if (document.hidden || busy || reacting) return next(2000);
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
        next(mood === 'sleep' ? 6000 : rand(2200, 5600));
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
        next(1600);
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
        mood = m;
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
      destroy() {
        alive = false;
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
