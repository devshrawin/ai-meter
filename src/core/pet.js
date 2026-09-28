// Iris, a white cat who lives on top of the meter pill: walks along it, sometimes falls off the
// edge and jumps back up. Mood follows usage; clicking her plays a reaction. Mounted inside the
// widget's shadow root, positioned relative to the pill.
(() => {
  const AM = globalThis.AIMeter;
  const W = 60;
  const H = 43;

  AM.PET_CSS = `
    .pet { position: absolute; left: 0; bottom: calc(100% - 2px); width: ${W}px; height: ${H}px; cursor: pointer;
      --outline: #cdc4b9; will-change: transform; }
    .pet .face { width: 100%; height: 100%; }
    .pet svg { width: ${W}px; height: ${H}px; overflow: visible; display: block; transform-origin: 50% 100%;
      shape-rendering: geometricPrecision; }
    .pet .o { stroke: var(--outline); stroke-width: .8; stroke-linejoin: round; }
    .pet .leg { transform-box: fill-box; transform-origin: 50% 4%; }
    .pet .tail { transform-origin: 15px 27px; animation: pet-sway 2.8s ease-in-out infinite alternate; }
    .pet .head { transform-origin: 46px 25px; transition: transform .35s; }
    .pet .body-g { transition: transform .35s; }
    .pet .ear { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .4s; }
    .pet .eye-open { transform-box: fill-box; transform-origin: center; animation: pet-blink 5.5s infinite; }
    .pet .eye-shut, .pet .eye-joy, .pet .sweat, .pet .z { display: none; }
    .pet .blush { opacity: .45; transition: opacity .3s; }
    .pet .shadow { transition: opacity .2s; }
    .pet.air .shadow { opacity: 0; }

    .pet.walking .leg-a { animation: pet-step .38s ease-in-out infinite alternate; }
    .pet.walking .leg-b { animation: pet-step .38s ease-in-out -.38s infinite alternate; }
    .pet.walking .body-g, .pet.walking .head { animation: pet-bob .19s ease-in-out infinite alternate; }
    .pet.walking .tail { animation-duration: 1.2s; }
    .pet[data-mood="stressed"].walking .leg-a, .pet[data-mood="stressed"].walking .leg-b { animation-duration: .22s; }

    .pet[data-mood="worried"] .blush, .pet[data-mood="stressed"] .blush { opacity: 0; }
    .pet[data-mood="worried"] .ear-far { transform: rotate(-14deg); }
    .pet[data-mood="worried"] .ear-near { transform: rotate(14deg); }
    .pet[data-mood="stressed"] .ear-far { transform: rotate(-28deg); }
    .pet[data-mood="stressed"] .ear-near { transform: rotate(28deg); }
    .pet[data-mood="stressed"] .sweat { display: inline; animation: pet-drip 1.5s ease-in infinite; }
    .pet[data-mood="stressed"] .tail { animation-duration: .8s; }
    .pet[data-mood="sleep"] .eye-open { display: none; }
    .pet[data-mood="sleep"] .eye-shut { display: inline; }
    .pet.lying .legs { display: none; }
    .pet.lying .body-g { transform: translateY(9px); }
    .pet.lying .head { transform: translate(-2px, 10px) rotate(8deg); }
    .pet.lying .tail { animation: none; transform: translate(4px, 11px) rotate(-85deg); }
    .pet.lying .shadow { transform: scaleX(1.05); }
    .pet.lying .z { display: block; }
    .pet.awake .eye-open { display: inline; } .pet.awake .eye-shut { display: none; } .pet.awake .z { display: none; }
    .pet.joy .eye-open, .pet.joy .eye-shut { display: none; }
    .pet.joy .eye-joy { display: inline; }
    .pet.joy .blush { opacity: .9; }
    .pet.groom .head { transform: rotate(18deg) translateY(1px); }
    .pet.teeter svg { animation: pet-teeter .5s ease-in-out; }
    .pet.purr svg { animation: pet-purr .08s linear 9; }
    .pet.flick .tail { animation: pet-flick .5s ease-in-out 2; }
    .pet.falling .eye-open { transform: scale(1.2); }

    .pet .z { position: absolute; font: 700 11px ui-sans-serif, system-ui, sans-serif; color: #a8a29e; pointer-events: none; }
    .pet .z1 { right: 6px; top: 6px; animation: pet-zz 2.4s ease-in-out infinite; }
    .pet .z2 { right: -2px; top: -2px; font-size: 8px; animation: pet-zz 2.4s ease-in-out 1.2s infinite; }
    .pet .fx { position: absolute; left: 70%; top: -4px; pointer-events: none; font: 700 13px ui-sans-serif, system-ui, sans-serif;
      color: #f07fa8; white-space: nowrap; animation: pet-float 1.2s ease-out forwards;
      text-shadow: 0 1px 0 #fff, 0 0 3px rgba(255,255,255,.9); }
    .pet .fx.dark { color: #6b625c; }

    @keyframes pet-step { from { transform: rotate(20deg); } to { transform: rotate(-20deg); } }
    @keyframes pet-bob { from { transform: translateY(0); } to { transform: translateY(-.9px); } }
    @keyframes pet-sway { from { transform: rotate(-10deg); } to { transform: rotate(12deg); } }
    @keyframes pet-blink { 0%,94%,100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
    @keyframes pet-drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(5px); opacity: 0; } }
    @keyframes pet-teeter { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
    @keyframes pet-purr { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
    @keyframes pet-flick { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-30deg); } }
    @keyframes pet-zz { 0% { opacity: 0; transform: translate(0,4px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(6px,-8px); } }
    @keyframes pet-float { 0% { opacity: 0; transform: translate(-50%,0) scale(.6); } 20% { opacity: 1; transform: translate(-50%,-8px) scale(1.1); }
      100% { opacity: 0; transform: translate(calc(-50% + var(--dx,0px)), -34px); } }
    @media (prefers-reduced-motion: reduce) {
      .pet *, .pet svg { animation: none !important; transition: none !important; }
    }
  `;

  // Side view walking right, head turned three-quarters toward the viewer. Ground is y=45.
  const SVG = `
    <svg viewBox="0 0 64 46" aria-hidden="true">
      <defs>
        <linearGradient id="iris-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f8f5f1"/><stop offset="1" stop-color="#e9e3dc"/>
        </linearGradient>
        <linearGradient id="iris-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#eeeae4"/><stop offset="1" stop-color="#d9d1c8"/>
        </linearGradient>
        <linearGradient id="iris-tail" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#e9e3dc"/><stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
        <radialGradient id="iris-eye" cx=".38" cy=".32" r=".75">
          <stop offset="0" stop-color="#cfe7ff"/><stop offset=".5" stop-color="#6aa8ec"/><stop offset="1" stop-color="#2d65b8"/>
        </radialGradient>
        <linearGradient id="iris-ear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fbd0de"/><stop offset="1" stop-color="#f29ab9"/>
        </linearGradient>
      </defs>

      <ellipse class="shadow" cx="31" cy="45.2" rx="21" ry="1.7" fill="rgba(60,40,30,.16)"/>

      <g class="tail">
        <path d="M16 27 C8 26.5 3.5 21 4.8 13.8 C5.8 8.6 9 6 11.4 6.8" fill="none" stroke="#cdc4b9" stroke-width="6" stroke-linecap="round"/>
        <path d="M16 27 C8 26.5 3.5 21 4.8 13.8 C5.8 8.6 9 6 11.4 6.8" fill="none" stroke="url(#iris-tail)" stroke-width="4.6" stroke-linecap="round"/>
      </g>

      <g class="legs">
        <g class="leg leg-b"><rect class="o" x="19.6" y="30" width="4.8" height="14.6" rx="2.4" fill="url(#iris-far)"/></g>
        <g class="leg leg-a"><rect class="o" x="40.2" y="30" width="4.6" height="14.6" rx="2.3" fill="url(#iris-far)"/></g>
      </g>

      <g class="body-g">
        <path class="o" fill="url(#iris-fur)"
          d="M15.5 27 C15.5 19.6 22.4 16.6 31 16.6 C38.6 16.6 43.6 18.2 45.6 22.2 C47.6 26.4 46.6 33.6 39.2 34.6 L21.6 34.6 C17.6 34.6 15.5 31.6 15.5 27 Z"/>
        <ellipse class="o" cx="21.6" cy="28.6" rx="6.4" ry="6" fill="url(#iris-fur)"/>
        <path d="M22 20.5 q4 -1.6 8.5 -1.4" fill="none" stroke="#efe9e2" stroke-width="1" stroke-linecap="round"/>
      </g>

      <g class="legs">
        <g class="leg leg-a">
          <rect class="o" x="22.2" y="31" width="5" height="13.6" rx="2.5" fill="url(#iris-fur)"/>
          <ellipse class="o" cx="25.2" cy="44.1" rx="3.3" ry="1.55" fill="#ffffff"/>
        </g>
        <g class="leg leg-b">
          <rect class="o" x="36.6" y="31" width="4.8" height="13.6" rx="2.4" fill="url(#iris-fur)"/>
          <ellipse class="o" cx="39.5" cy="44.1" rx="3.2" ry="1.55" fill="#ffffff"/>
        </g>
      </g>

      <g class="head">
        <path class="o ear ear-far" fill="url(#iris-fur)" d="M42.8 12.6 L43.4 3.2 Q43.7 1.9 44.8 2.6 L50.6 8.2 Z"/>
        <path class="ear-in" fill="url(#iris-ear)" d="M44.6 9.6 L44.9 4.9 L48.6 8.3 Z"/>
        <path class="o ear ear-near" fill="url(#iris-fur)" d="M52.6 8.2 L58.4 2.6 Q59.4 1.9 59.6 3.2 L60.4 12.8 Z"/>
        <path class="ear-in" fill="url(#iris-ear)" d="M54.4 8.4 L58.1 4.9 L58.6 10.6 Z"/>
        <path class="o" fill="url(#iris-fur)"
          d="M40.2 17.6 C40.2 10.6 45.2 7 51.4 7 C57.6 7 62.6 10.6 62.6 17.6 C62.6 20.8 61.4 23.2 59.6 24.8 C58.4 26.6 55.4 27.8 51.4 27.8 C47.4 27.8 44.4 26.6 43.2 24.8 C41.4 23.2 40.2 20.8 40.2 17.6 Z"/>
        <path d="M39.6 23.6 q-.6 2.2 1 3.4 q.2 -1.4 1.2 -2" fill="#fff" class="o"/>
        <path d="M63 23.6 q.6 2.2 -1 3.4 q-.2 -1.4 -1.2 -2" fill="#fff" class="o"/>

        <g class="eye-open">
          <ellipse cx="46.6" cy="17.4" rx="2.6" ry="3.1" fill="url(#iris-eye)"/>
          <ellipse cx="46.9" cy="17.7" rx="1.25" ry="2.1" fill="#1d2230"/>
          <circle cx="47.7" cy="16.1" r=".95" fill="#fff"/><circle cx="45.9" cy="19" r=".45" fill="#fff" opacity=".85"/>
          <ellipse cx="56.2" cy="17.4" rx="2.6" ry="3.1" fill="url(#iris-eye)"/>
          <ellipse cx="56.5" cy="17.7" rx="1.25" ry="2.1" fill="#1d2230"/>
          <circle cx="57.3" cy="16.1" r=".95" fill="#fff"/><circle cx="55.5" cy="19" r=".45" fill="#fff" opacity=".85"/>
        </g>
        <path class="eye-shut" d="M44.1 18 q2.5 2.1 5 0 M53.7 18 q2.5 2.1 5 0" fill="none" stroke="#4a3f3a" stroke-width="1.05" stroke-linecap="round"/>
        <path class="eye-joy" d="M44.1 18.9 q2.5 -3 5 0 M53.7 18.9 q2.5 -3 5 0" fill="none" stroke="#4a3f3a" stroke-width="1.05" stroke-linecap="round"/>

        <ellipse class="blush" cx="44" cy="22.4" rx="2.1" ry="1.15" fill="#f7a3c1"/>
        <ellipse class="blush" cx="58.8" cy="22.4" rx="2.1" ry="1.15" fill="#f7a3c1"/>
        <path d="M50.1 21.1 h2.6 q-.2 1.3 -1.3 1.7 q-1.1 -.4 -1.3 -1.7 z" fill="#f28db2"/>
        <path d="M51.4 22.8 v.6 M51.4 23.4 q-1 1.2 -2.1 .3 M51.4 23.4 q1 1.2 2.1 .3" fill="none" stroke="#7a6862" stroke-width=".6" stroke-linecap="round"/>
        <path d="M43.4 21.3 l-5.6 -1 M43.4 22.4 l-5.4 .5 M59.4 21.3 l5.6 -1 M59.4 22.4 l5.4 .5" fill="none" stroke="#cbc2b8" stroke-width=".45" stroke-linecap="round"/>
        <path class="sweat" d="M41.4 6.6 q2.1 3.1 0 4.4 q-2.1 -1.3 0 -4.4z" fill="#8fcaff"/>
        <path d="M41.6 25.4 C44 28.6 48.6 29.6 53.4 27.6" fill="none" stroke="#9a80e0" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="47.4" cy="29.4" r="1.7" fill="#f6c84a" stroke="#d8a324" stroke-width=".5"/>
        <path d="M46.3 29.6 h2.2" stroke="#b9861a" stroke-width=".4"/>
      </g>
    </svg>`;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  AM.createPet = (pill, hostEl) => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('div');
    el.className = 'pet';
    el.title = 'Iris — click to pet';
    el.dataset.mood = 'happy';
    el.innerHTML = `<div class="face">${SVG}</div><span class="z z1">z</span><span class="z z2">z</span>`;
    const face = el.querySelector('.face');
    const svg = el.querySelector('svg');
    pill.append(el);

    let x = 0;
    let y = 0;
    let mood = 'happy';
    let alive = true;
    let busy = false;
    let reacting = false;
    let inAir = false;
    let anim = null;
    let timer = null;
    let clicks = [];

    const T = (tx, ty, extra = '') => `translate(${tx}px, ${ty}px) ${extra}`;
    const place = () => { el.style.transform = T(x, y); };
    const faceDir = (d) => { face.style.transform = d < 0 ? 'scaleX(-1)' : ''; };
    const air = (on) => { inAir = on; el.classList.toggle('air', on); };
    const bounds = () => {
      const w = pill.offsetWidth;
      return { min: 6, max: Math.max(6, w - W - 6), w, h: pill.offsetHeight };
    };
    // Room beside the pill (inside the viewport) for a fall on that side.
    const roomFor = (side) => {
      const r = hostEl.getBoundingClientRect();
      return side < 0 ? r.left > W + 8 : innerWidth - r.right > W + 8;
    };

    const particle = (text, { dx = 0, delay = 0, dark = false } = {}) => {
      setTimeout(() => {
        if (!alive) return;
        const p = document.createElement('span');
        p.className = 'fx' + (dark ? ' dark' : '');
        p.textContent = text;
        p.style.setProperty('--dx', dx + 'px');
        el.append(p);
        setTimeout(() => p.remove(), 1300);
      }, delay);
    };

    const flash = (cls, ms) => {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      return sleep(ms).then(() => el.classList.remove(cls));
    };

    // Runs a transform animation on the cat; resolves false if it was interrupted.
    const move = async (frames, opts) => {
      anim = el.animate(frames, { fill: 'forwards', ...opts });
      try {
        await anim.finished;
      } catch {
        return false;
      }
      anim.cancel();
      anim = null;
      return true;
    };

    const squash = () => svg.animate(
      [{ transform: 'scale(1,1)' }, { transform: 'scale(1.14,.82)' }, { transform: 'scale(1,1)' }],
      { duration: 280, easing: 'ease-out' }).finished.catch(() => {});

    const interrupt = () => {
      if (!anim) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      x = m.m41;
      y = m.m42;
      anim.cancel();
      anim = null;
      el.classList.remove('walking');
      place();
    };

    async function walkTo(tx) {
      const dx = tx - x;
      if (Math.abs(dx) < 2) return true;
      faceDir(dx);
      el.classList.add('walking');
      const speed = mood === 'stressed' ? 48 : 24;
      const ok = await move([{ transform: T(x, y) }, { transform: T(tx, y) }], { duration: (Math.abs(dx) / speed) * 1000, easing: 'linear' });
      el.classList.remove('walking');
      if (ok) {
        x = tx;
        place();
      }
      return ok;
    }

    async function jumpUp() {
      const b = bounds();
      const land = x < 0 ? b.min : b.max;
      faceDir(land - x);
      await squash();
      air(true);
      await move([
        { transform: T(x, y) },
        { transform: T((x + land) / 2, -26), offset: 0.55 },
        { transform: T(land, 0) },
      ], { duration: 660, easing: 'cubic-bezier(.3,.7,.4,1)' });
      air(false);
      x = land;
      y = 0;
      place();
      await squash();
    }

    async function fall(side) {
      const b = bounds();
      const edge = side < 0 ? -W * 0.45 : b.w - W * 0.55;
      if (!(await walkTo(edge))) return;
      particle('!', { dark: true });
      await flash('teeter', 520);
      const gx = side < 0 ? -W - 6 : b.w + 6;
      const gy = b.h;
      air(true);
      el.classList.add('falling');
      await move([
        { transform: T(x, 0, 'rotate(0deg)') },
        { transform: T((x + gx) / 2, gy * 0.25, `rotate(${side * 20}deg)`), offset: 0.4 },
        { transform: T(gx, gy, 'rotate(0deg)') },
      ], { duration: 540, easing: 'cubic-bezier(.5,0,.9,.55)' });
      el.classList.remove('falling');
      air(false);
      x = gx;
      y = gy;
      place();
      await squash();
      particle(pick(['✦', '?!', 'oof', 'mrow!']), { dark: true });
      await sleep(rand(900, 1600));
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
          return;
        }
        el.classList.remove('lying');
        const b = bounds();
        if (reduce) {
          x = b.max;
          y = 0;
          place();
          return;
        }
        if (y > 0) return await jumpUp();
        if (x > b.max) return await walkTo(b.max);
        const r = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;
        if (r < 0.16 && roomFor(side)) await fall(side);
        else if (r < 0.72) await walkTo(rand(b.min, b.max));
        else if (r < 0.86) await flash('groom', 1500);
        else await flash('flick', 1000);
      } finally {
        busy = false;
        next(mood === 'sleep' ? 5000 : rand(1400, 4200));
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
      el.classList.remove('groom', 'flick', 'teeter');
      try {
        if (mood === 'sleep') {
          el.classList.add('awake');
          particle(pick(['!', '5 more min…', 'mrrp?']), { dark: true });
          await sleep(1400);
          el.classList.remove('awake');
        } else if (burst) {
          clicks = [];
          el.classList.add('joy');
          ['♥', '♥', '♥'].forEach((h, i) => particle(h, { dx: (i - 1) * 16, delay: i * 120 }));
          particle('nya~!', { delay: 300 });
          air(true);
          await move([
            { transform: T(x, y, 'rotate(0deg)') },
            { transform: T(x, y - 30, 'rotate(-180deg)'), offset: 0.5 },
            { transform: T(x, y, 'rotate(-360deg)') },
          ], { duration: 780, easing: 'ease-in-out' });
          air(false);
          place();
          await squash();
          el.classList.remove('joy');
        } else {
          el.classList.add('joy');
          const kind = pick(['hop', 'purr', 'mew', 'hop']);
          if (kind === 'hop') {
            particle('♥');
            air(true);
            await move([{ transform: T(x, y) }, { transform: T(x, y - 16), offset: 0.45 }, { transform: T(x, y) }], { duration: 500, easing: 'ease-out' });
            air(false);
            place();
            await squash();
          } else if (kind === 'purr') {
            particle('prrr');
            await flash('purr', 760);
          } else {
            particle('mew');
            await flash('flick', 1000);
          }
          el.classList.remove('joy');
        }
      } finally {
        reacting = false;
        next(1500);
      }
    }

    place();
    next(600);

    return {
      el,
      react,
      setMood(m) {
        if (m === mood) return;
        mood = m;
        el.dataset.mood = m;
        if (m !== 'sleep') el.classList.remove('lying');
        if (!busy && !reacting) next(200);
      },
      // Called after the pill's width changes, so the cat isn't left floating past the end.
      nudge() {
        if (!busy && !reacting && !inAir && y === 0 && x > bounds().max) next(100);
      },
      destroy() {
        alive = false;
        clearTimeout(timer);
        if (anim) anim.cancel();
        el.remove();
      },
    };
  };
})();
