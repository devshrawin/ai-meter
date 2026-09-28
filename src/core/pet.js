// Iris, a white cat who lives on top of the meter pill: walks along it, sometimes falls off the edge and
// jumps back up. Mood follows usage; clicking it plays a reaction. Mounted inside the widget's
// shadow root, positioned relative to the pill.
(() => {
  const AM = globalThis.AIMeter;
  const W = 32;
  const H = 23;

  AM.PET_CSS = `
    .pet { position: absolute; left: 0; bottom: calc(100% - 1px); width: ${W}px; height: ${H}px; cursor: pointer;
      --fur: #fdfcfa; --fur-dark: #ebe6df; --outline: #c4bbb0; --ink: #3a3330; --pink: #f6a5c0; --iris: #6fa8e8;
      will-change: transform; }
    .pet .face { width: 100%; height: 100%; }
    .pet svg { width: ${W}px; height: ${H}px; overflow: visible; display: block; transform-origin: 50% 100%; }
    .pet .fur { fill: var(--fur); stroke: var(--outline); stroke-width: .6; }
    .pet .fur-d { fill: var(--fur-dark); stroke: var(--outline); stroke-width: .6; }
    .pet .fur-line { stroke: var(--fur); fill: none; stroke-width: 2.4; stroke-linecap: round; }
    .pet .fur-outline { stroke: var(--outline); fill: none; stroke-width: 3.6; stroke-linecap: round; }
    .pet .iris { fill: var(--iris); }
    .pet .ink { fill: var(--ink); } .pet .ink-line { stroke: var(--ink); fill: none; stroke-width: .9; stroke-linecap: round; }
    .pet .pink { fill: var(--pink); }
    .pet .stripe { stroke: var(--fur-dark); stroke-width: 1; stroke-linecap: round; fill: none; }
    .pet .leg { transform-box: fill-box; transform-origin: 50% 8%; }
    .pet .tail { transform-origin: 7px 13px; animation: pet-sway 2.6s ease-in-out infinite alternate; }
    .pet .eye-open { transform-box: fill-box; transform-origin: center; animation: pet-blink 5s infinite; }
    .pet .eye-shut, .pet .eye-joy, .pet .sweat, .pet .z { display: none; }
    .pet .blush { opacity: .55; }
    .pet .ear-f, .pet .ear-b { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .4s; }
    .pet .head, .pet .c-body, .pet .legs { transform-box: view-box; transition: transform .35s; }
    .pet .head { transform-origin: 24px 12px; }

    .pet.walking .leg-a { animation: pet-step .34s ease-in-out infinite alternate; }
    .pet.walking .leg-b { animation: pet-step .34s ease-in-out -.34s infinite alternate; }
    .pet.walking .c-body { animation: pet-bob .17s ease-in-out infinite alternate; }
    .pet.walking .tail { animation-duration: 1.1s; }
    .pet[data-mood="stressed"].walking .leg-a, .pet[data-mood="stressed"].walking .leg-b { animation-duration: .2s; }

    .pet[data-mood="worried"] .blush, .pet[data-mood="stressed"] .blush { opacity: 0; }
    .pet[data-mood="worried"] .ear-f, .pet[data-mood="worried"] .ear-b { transform: rotate(-18deg); }
    .pet[data-mood="stressed"] .ear-f, .pet[data-mood="stressed"] .ear-b { transform: rotate(-32deg); }
    .pet[data-mood="stressed"] .sweat { display: inline; animation: pet-drip 1.5s ease-in infinite; }
    .pet[data-mood="stressed"] .tail { animation-duration: .8s; }
    .pet[data-mood="sleep"] .eye-open { display: none; }
    .pet[data-mood="sleep"] .eye-shut { display: inline; }
    .pet.lying .legs { display: none; }
    .pet.lying .c-body { transform: translateY(4px); }
    .pet.lying .head { transform: translateY(5px) rotate(8deg); }
    .pet.lying .tail { animation: none; transform: translate(1px, 5px) rotate(-70deg); }
    .pet.lying .z { display: block; }
    .pet.awake .eye-open { display: inline; } .pet.awake .eye-shut { display: none; } .pet.awake .z { display: none; }
    .pet.joy .eye-open, .pet.joy .eye-shut { display: none; }
    .pet.joy .eye-joy { display: inline; }
    .pet.joy .blush { opacity: .95; }
    .pet.groom .head { transform: rotate(22deg); }
    .pet.teeter svg { animation: pet-teeter .5s ease-in-out; }
    .pet.purr svg { animation: pet-purr .08s linear 9; }
    .pet.flick .tail { animation: pet-flick .5s ease-in-out 2; }
    .pet.falling .eye-open { transform: scale(1.35); }

    .pet .z { position: absolute; font: 700 8px ui-sans-serif, system-ui, sans-serif; color: #a8a29e; pointer-events: none; }
    .pet .z1 { right: 2px; top: -2px; animation: pet-zz 2.4s ease-in-out infinite; }
    .pet .z2 { right: -4px; top: -8px; font-size: 6px; animation: pet-zz 2.4s ease-in-out 1.2s infinite; }
    .pet .fx { position: absolute; left: 50%; top: -2px; pointer-events: none; font: 700 11px ui-sans-serif, system-ui, sans-serif;
      color: #f58fb1; white-space: nowrap; animation: pet-float 1.1s ease-out forwards; text-shadow: 0 1px 0 rgba(255,255,255,.6); }
    .pet .fx.dark { color: #78716c; }

    @keyframes pet-step { from { transform: rotate(24deg); } to { transform: rotate(-24deg); } }
    @keyframes pet-bob { from { transform: translateY(0); } to { transform: translateY(-.7px); } }
    @keyframes pet-sway { from { transform: rotate(-12deg); } to { transform: rotate(14deg); } }
    @keyframes pet-blink { 0%,93%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes pet-drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(4px); opacity: 0; } }
    @keyframes pet-teeter { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
    @keyframes pet-purr { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
    @keyframes pet-flick { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-35deg); } }
    @keyframes pet-zz { 0% { opacity: 0; transform: translate(0,3px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(4px,-6px); } }
    @keyframes pet-float { 0% { opacity: 0; transform: translate(-50%,0) scale(.6); } 20% { opacity: 1; transform: translate(-50%,-6px) scale(1.1); }
      100% { opacity: 0; transform: translate(calc(-50% + var(--dx,0px)), -26px); } }
    @media (prefers-reduced-motion: reduce) {
      .pet *, .pet svg { animation: none !important; transition: none !important; }
    }
  `;

  // Side view, facing right; ground is y=23.
  const SVG = `
    <svg viewBox="0 0 34 24" aria-hidden="true">
      <g class="tail"><path class="fur-outline" d="M7.5 13 C2.5 12.5 1.2 6.5 3.8 3.6"/><path class="fur-line" d="M7.5 13 C2.5 12.5 1.2 6.5 3.8 3.6"/></g>
      <g class="legs">
        <rect class="leg leg-b fur-d" x="10.6" y="15" width="2.6" height="8.4" rx="1.3"/>
        <rect class="leg leg-a fur-d" x="22.6" y="15" width="2.6" height="8.4" rx="1.3"/>
      </g>
      <g class="c-body">
        <ellipse class="fur" cx="15.5" cy="13.6" rx="9.6" ry="5.3"/>
      </g>
      <g class="legs">
        <rect class="leg leg-a fur" x="7.8" y="15.2" width="2.7" height="8.2" rx="1.35"/>
        <rect class="leg leg-b fur" x="19.8" y="15.2" width="2.7" height="8.2" rx="1.35"/>
      </g>
      <g class="head">
        <path class="fur ear-b" d="M22.9 6.4 L23.6 .9 L27.1 4.1 Z"/>
        <path class="fur ear-f" d="M26.7 4.4 L29.6 .7 L31 6.4 Z"/>
        <path class="pink" d="M27.9 4.6 L29.4 2.4 L30.1 5.6 Z"/>
        <circle class="fur" cx="26.8" cy="9.6" r="5.7"/>
        <g class="eye-open"><ellipse class="iris" cx="28.9" cy="9" rx="1.2" ry="1.55"/><ellipse class="ink" cx="29.05" cy="9.1" rx=".5" ry="1"/><circle cx="29.35" cy="8.4" r=".38" fill="#fff"/></g>
        <path class="eye-shut ink-line" d="M27.9 9.3 q1 .9 2 0"/>
        <path class="eye-joy ink-line" d="M27.9 9.7 q1 -1.6 2 0"/>
        <ellipse class="pink blush" cx="28.2" cy="12" rx="1.15" ry=".7"/>
        <path class="pink" d="M31.9 10 l1 .5 l-1 .55z"/>
        <path class="ink-line" d="M31.1 12.3 q.7 .55 1.4 0" stroke-width=".6"/>
        <path d="M30.4 11.1 h3.2 M30.4 12.1 l3 .8" fill="none" stroke="#b9b0a6" stroke-width=".4" stroke-linecap="round"/>
        <path class="sweat" fill="#7cc4ff" d="M24.2 2.8 q1.4 2.2 0 3 q-1.4 -.8 0 -3z"/>
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
    const face2 = (d) => { face.style.transform = d < 0 ? 'scaleX(-1)' : ''; };
    const bounds = () => {
      const w = pill.offsetWidth;
      return { min: 8, max: Math.max(8, w - W - 8), w, h: pill.offsetHeight };
    };
    // Room beside the pill (inside the viewport) for a fall on that side.
    const roomFor = (side) => {
      const r = hostEl.getBoundingClientRect();
      return side < 0 ? r.left > W + 6 : innerWidth - r.right > W + 6;
    };

    const particle = (text, { dx = 0, delay = 0, dark = false } = {}) => {
      setTimeout(() => {
        if (!alive) return;
        const p = document.createElement('span');
        p.className = 'fx' + (dark ? ' dark' : '');
        p.textContent = text;
        p.style.setProperty('--dx', dx + 'px');
        el.append(p);
        setTimeout(() => p.remove(), 1200);
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
      [{ transform: 'scale(1,1)' }, { transform: 'scale(1.18,.78)' }, { transform: 'scale(1,1)' }],
      { duration: 260, easing: 'ease-out' }).finished.catch(() => {});

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
      face2(dx);
      el.classList.add('walking');
      const speed = mood === 'stressed' ? 42 : 20;
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
      face2(land - x);
      await squash();
      inAir = true;
      await move([
        { transform: T(x, y) },
        { transform: T((x + land) / 2, -18), offset: 0.55 },
        { transform: T(land, 0) },
      ], { duration: 620, easing: 'cubic-bezier(.3,.7,.4,1)' });
      inAir = false;
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
      const gx = side < 0 ? -W - 4 : b.w + 4;
      const gy = b.h;
      inAir = true;
      el.classList.add('falling');
      await move([
        { transform: T(x, 0, 'rotate(0deg)') },
        { transform: T((x + gx) / 2, gy * 0.25, `rotate(${side * 22}deg)`), offset: 0.4 },
        { transform: T(gx, gy, 'rotate(0deg)') },
      ], { duration: 520, easing: 'cubic-bezier(.5,0,.9,.55)' });
      el.classList.remove('falling');
      inAir = false;
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
          ['♥', '♥', '♥'].forEach((h, i) => particle(h, { dx: (i - 1) * 12, delay: i * 120 }));
          particle('nya~!', { delay: 300 });
          await move([
            { transform: T(x, y, 'rotate(0deg)') },
            { transform: T(x, y - 20, `rotate(-180deg)`), offset: 0.5 },
            { transform: T(x, y, 'rotate(-360deg)') },
          ], { duration: 750, easing: 'ease-in-out' });
          place();
          await squash();
          el.classList.remove('joy');
        } else {
          el.classList.add('joy');
          const kind = pick(['hop', 'purr', 'mew', 'hop']);
          if (kind === 'hop') {
            particle('♥');
            await move([{ transform: T(x, y) }, { transform: T(x, y - 12), offset: 0.45 }, { transform: T(x, y) }], { duration: 480, easing: 'ease-out' });
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
