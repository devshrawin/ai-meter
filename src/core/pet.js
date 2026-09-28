// Iris, a fluffy white longhair cat who lives on top of the meter pill: sits like a proper cat,
// walks along it, sometimes falls off the edge and jumps back up. Mood follows usage; clicking her
// plays a reaction. Mounted inside the widget's shadow root, positioned relative to the pill.
(() => {
  const AM = globalThis.AIMeter;
  const W = 76;
  const H = 57;

  AM.PET_CSS = `
    .pet { position: absolute; left: 0; bottom: calc(100% - 3px); width: ${W}px; height: ${H}px; cursor: pointer; will-change: transform; }
    .pet .face { width: 100%; height: 100%; }
    .pet svg { width: ${W}px; height: ${H}px; overflow: visible; display: block; transform-origin: 50% 100%;
      shape-rendering: geometricPrecision; }
    .pet .fluff { filter: url(#iris-fluff); }
    .pet .wisp { fill: none; stroke: #dfe3ea; stroke-width: .4; stroke-linecap: round; opacity: .7; }
    .pet .leg { transform-box: fill-box; transform-origin: 50% 4%; }
    .pet .tail { animation: pet-sway 2.8s ease-in-out infinite alternate; }
    .pet .tail-w { transform-origin: 22px 38px; }
    .pet .tail-s { transform-origin: 47px 57px; animation-name: pet-sway-s; }
    .pet .head { transform-origin: 58px 33px; transition: transform .35s; }
    .pet .head-s { transform-origin: 40px 33px; transition: transform .35s; }
    .pet .body-g { transition: transform .35s; }
    .pet .ear { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .4s; }
    .pet .eye-open { transform-box: fill-box; transform-origin: center; animation: pet-blink 5.5s infinite; }
    .pet .eye-shut, .pet .eye-joy, .pet .sweat, .pet .z { display: none; }
    .pet .blush { opacity: .35; transition: opacity .3s; }
    .pet .shadow { transition: opacity .2s; }
    .pet.air .shadow { opacity: 0; }

    /* Sitting is the resting pose; any movement switches to the side-view walking pose. */
    .pet .pose-walk { display: none; }
    .pet.walking .pose-walk, .pet.air .pose-walk, .pet.falling .pose-walk, .pet.teeter .pose-walk, .pet.lying .pose-walk { display: inline; }
    .pet.walking .pose-sit, .pet.air .pose-sit, .pet.falling .pose-sit, .pet.teeter .pose-sit, .pet.lying .pose-sit { display: none; }

    .pet.walking .leg-a { animation: pet-step .4s ease-in-out infinite alternate; }
    .pet.walking .leg-b { animation: pet-step .4s ease-in-out -.4s infinite alternate; }
    .pet.walking .body-g, .pet.walking .head { animation: pet-bob .2s ease-in-out infinite alternate; }
    .pet.walking .tail-w { animation-duration: 1.3s; }
    .pet[data-mood="stressed"].walking .leg-a, .pet[data-mood="stressed"].walking .leg-b { animation-duration: .24s; }

    .pet[data-mood="worried"] .blush, .pet[data-mood="stressed"] .blush { opacity: 0; }
    .pet[data-mood="worried"] .ear-l { transform: rotate(-14deg); }
    .pet[data-mood="worried"] .ear-r { transform: rotate(14deg); }
    .pet[data-mood="stressed"] .ear-l { transform: rotate(-26deg); }
    .pet[data-mood="stressed"] .ear-r { transform: rotate(26deg); }
    .pet[data-mood="stressed"] .sweat { display: inline; animation: pet-drip 1.5s ease-in infinite; }
    .pet[data-mood="stressed"] .tail { animation-duration: .8s; }
    .pet[data-mood="sleep"] .eye-open { display: none; }
    .pet[data-mood="sleep"] .eye-shut { display: inline; }
    .pet.lying .legs { display: none; }
    .pet.lying .body-g { transform: translateY(10px); }
    .pet.lying .head { transform: translate(-3px, 12px) rotate(6deg); }
    .pet.lying .tail-w { animation: none; transform: translate(6px, 16px) rotate(-78deg); }
    .pet.lying .z { display: block; }
    .pet.awake .eye-open { display: inline; } .pet.awake .eye-shut { display: none; } .pet.awake .z { display: none; }
    .pet.joy .eye-open, .pet.joy .eye-shut { display: none; }
    .pet.joy .eye-joy { display: inline; }
    .pet.joy .blush { opacity: .85; }
    .pet.groom .head-s { transform: rotate(14deg) translateY(1px); }
    .pet.teeter svg { animation: pet-teeter .5s ease-in-out; }
    .pet.purr svg { animation: pet-purr .08s linear 9; }
    .pet.flick .tail-s { animation: pet-flick-s .45s ease-in-out 2; }
    .pet.flick .tail-w { animation: pet-flick .5s ease-in-out 2; }
    .pet.falling .eye-open { transform: scale(1.18); }

    .pet .z { position: absolute; font: 700 12px ui-sans-serif, system-ui, sans-serif; color: #a8a29e; pointer-events: none; }
    .pet .z1 { right: 8px; top: 10px; animation: pet-zz 2.4s ease-in-out infinite; }
    .pet .z2 { right: 0; top: 2px; font-size: 9px; animation: pet-zz 2.4s ease-in-out 1.2s infinite; }
    .pet .fx { position: absolute; left: 55%; top: -6px; pointer-events: none; font: 700 14px ui-sans-serif, system-ui, sans-serif;
      color: #f07fa8; white-space: nowrap; animation: pet-float 1.2s ease-out forwards;
      text-shadow: 0 1px 0 #fff, 0 0 3px rgba(255,255,255,.9); }
    .pet .fx.dark { color: #6b625c; }

    @keyframes pet-step { from { transform: rotate(18deg); } to { transform: rotate(-18deg); } }
    @keyframes pet-bob { from { transform: translateY(0); } to { transform: translateY(-1px); } }
    @keyframes pet-sway { from { transform: rotate(-9deg); } to { transform: rotate(10deg); } }
    @keyframes pet-sway-s { from { transform: rotate(-3deg); } to { transform: rotate(2deg); } }
    @keyframes pet-blink { 0%,94%,100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
    @keyframes pet-drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(5px); opacity: 0; } }
    @keyframes pet-teeter { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-7deg); } 75% { transform: rotate(7deg); } }
    @keyframes pet-purr { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-2.5deg); } 75% { transform: rotate(2.5deg); } }
    @keyframes pet-flick { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-28deg); } }
    @keyframes pet-flick-s { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-9deg); } }
    @keyframes pet-zz { 0% { opacity: 0; transform: translate(0,4px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(7px,-9px); } }
    @keyframes pet-float { 0% { opacity: 0; transform: translate(-50%,0) scale(.6); } 20% { opacity: 1; transform: translate(-50%,-8px) scale(1.1); }
      100% { opacity: 0; transform: translate(calc(-50% + var(--dx,0px)), -38px); } }
    @media (prefers-reduced-motion: reduce) {
      .pet *, .pet svg { animation: none !important; transition: none !important; }
    }
  `;

  // One eye: pale-blue iris with a darker rim, slit-ish pupil, two catchlights.
  const eye = (cx, cy) => `
    <ellipse cx="${cx}" cy="${cy}" rx="3.1" ry="3.4" fill="url(#iris-eye)" stroke="#3d4f68" stroke-width=".45"/>
    <ellipse cx="${cx + 0.25}" cy="${cy + 0.25}" rx="1.1" ry="2.4" fill="#1a1f2b"/>
    <circle cx="${cx + 1.05}" cy="${cy - 1.3}" r="1" fill="#fff"/>
    <circle cx="${cx - 0.9}" cy="${cy + 1.5}" r=".45" fill="#fff" opacity=".8"/>`;
  const eyeShut = (cx, cy) => `M${cx - 2.8} ${cy + 0.4} q2.8 2.2 5.6 0`;
  const eyeJoy = (cx, cy) => `M${cx - 2.8} ${cy + 1.2} q2.8 -3.2 5.6 0`;
  const muzzle = (cx, cy) => `
    <ellipse cx="${cx - 2.1}" cy="${cy + 2.4}" rx="2.6" ry="1.9" fill="#ffffff"/>
    <ellipse cx="${cx + 2.1}" cy="${cy + 2.4}" rx="2.6" ry="1.9" fill="#ffffff"/>
    <path d="M${cx - 1.5} ${cy} h3 q-.3 1.5 -1.5 2 q-1.2 -.5 -1.5 -2 z" fill="url(#iris-nose)"/>
    <path d="M${cx} ${cy + 2} v.8 M${cx} ${cy + 2.8} q-1.2 1.3 -2.4 .4 M${cx} ${cy + 2.8} q1.2 1.3 2.4 .4"
      fill="none" stroke="#c09aa0" stroke-width=".55" stroke-linecap="round"/>
    <path d="M${cx - 3.6} ${cy + 1.6} l-9.5 -2 M${cx - 3.6} ${cy + 2.6} l-9.2 .2 M${cx - 3.4} ${cy + 3.5} l-8.2 2.4
             M${cx + 3.6} ${cy + 1.6} l9.5 -2 M${cx + 3.6} ${cy + 2.6} l9.2 .2 M${cx + 3.4} ${cy + 3.5} l8.2 2.4"
      fill="none" stroke="#dde2ea" stroke-width=".4" stroke-linecap="round"/>`;

  const SVG = `
    <svg viewBox="0 0 80 60" aria-hidden="true">
      <defs>
        <!-- Fur: jitter the edges into tufts, then lay a soft cool-grey rim behind so white reads on white. -->
        <filter id="iris-fluff" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1" xChannelSelector="R" yChannelSelector="G" result="d"/>
          <feMorphology in="d" operator="dilate" radius=".55" result="thick"/>
          <feGaussianBlur in="thick" stdDeviation=".35" result="soft"/>
          <feFlood flood-color="#aeb6c4" result="c"/>
          <feComposite in="c" in2="soft" operator="in" result="rim"/>
          <feMerge><feMergeNode in="rim"/><feMergeNode in="d"/></feMerge>
        </filter>
        <linearGradient id="iris-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f5f6f8"/><stop offset="1" stop-color="#d2d8e2"/>
        </linearGradient>
        <linearGradient id="iris-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#eceef2"/><stop offset="1" stop-color="#cfd4dd"/>
        </linearGradient>
        <radialGradient id="iris-sheen" cx=".4" cy=".25" r=".6">
          <stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="iris-eye" cx=".42" cy=".38" r=".62">
          <stop offset="0" stop-color="#e2f1ff"/><stop offset=".45" stop-color="#97c6f2"/><stop offset=".82" stop-color="#5a92d4"/><stop offset="1" stop-color="#34649f"/>
        </radialGradient>
        <linearGradient id="iris-ear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffe2d4"/><stop offset="1" stop-color="#f4a78e"/>
        </linearGradient>
        <linearGradient id="iris-nose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f7a0b5"/><stop offset="1" stop-color="#e5718d"/>
        </linearGradient>
      </defs>

      <ellipse class="shadow" cx="40" cy="59" rx="27" ry="2" fill="rgba(70,80,100,.16)"/>

      <!-- sitting, facing the viewer -->
      <g class="pose-sit">
        <g class="tail tail-s fluff">
          <path fill="url(#iris-fur)" d="M46 55.5 C55 57 65 56.8 72 53.8 C76.5 52 78.4 55.2 75.4 57.4 C69 60.6 56 60.4 46 58.8 Z"/>
          <path class="wisp" d="M52 57.2 q6 .8 13 -.4 M58 58.6 q7 .2 12 -1.8"/>
        </g>
        <g class="body-s fluff">
          <path fill="url(#iris-fur)" d="M27.5 58 C24.5 50 25 41 29.6 35.8 C33 32 47 32 50.4 35.8 C55 41 55.5 50 52.5 58 Z"/>
          <ellipse cx="50" cy="51.5" rx="6.4" ry="7" fill="url(#iris-fur)"/>
          <ellipse cx="36" cy="40" rx="9" ry="6" fill="url(#iris-sheen)" opacity=".8"/>
        </g>
        <g class="fluff">
          <path fill="#ffffff" d="M30.2 32.5 C31.5 41 34.5 47.5 40 49 C45.5 47.5 48.5 41 49.8 32.5 C46 35 34 35 30.2 32.5 Z"/>
          <path class="wisp" d="M34 38 q1 4 2.6 7 M38 39 q.4 4 1 7.4 M42 39 q-.4 4 -1 7.4 M46 38 q-1 4 -2.6 7"/>
          <rect x="33" y="44" width="5.6" height="13.4" rx="2.8" fill="url(#iris-fur)"/>
          <rect x="41.4" y="44" width="5.6" height="13.4" rx="2.8" fill="url(#iris-fur)"/>
          <ellipse cx="35.8" cy="57.6" rx="4" ry="2.1" fill="#ffffff"/>
          <ellipse cx="44.2" cy="57.6" rx="4" ry="2.1" fill="#ffffff"/>
        </g>
        <g class="head-s">
          <g class="fluff">
            <path class="ear ear-l" fill="url(#iris-fur)" d="M29.4 17.2 L30.4 5.4 Q31 3.8 32.4 4.9 L38.2 11.6 Z"/>
            <path class="ear ear-r" fill="url(#iris-fur)" d="M41.8 11.6 L47.6 4.9 Q49 3.8 49.6 5.4 L50.6 17.2 Z"/>
          </g>
          <path fill="url(#iris-ear)" d="M31.3 14.2 L31.8 7.6 L36 11.6 Z"/>
          <path fill="url(#iris-ear)" d="M44 11.6 L48.2 7.6 L48.7 14.2 Z"/>
          <path class="wisp" d="M32.4 12.6 l1.6 -1.6 M47.6 12.6 l-1.6 -1.6" stroke="#ffffff" stroke-width=".6"/>
          <path class="fluff" fill="url(#iris-fur)"
            d="M27.4 21.5 C27.4 13.4 33 9.4 40 9.4 C47 9.4 52.6 13.4 52.6 21.5 C52.6 25 51.6 27.6 50.1 29.3 C51.6 30.7 50.8 32.8 49.1 33.2 C47.1 35.8 43.8 36.8 40 36.8 C36.2 36.8 32.9 35.8 30.9 33.2 C29.2 32.8 28.4 30.7 29.9 29.3 C28.4 27.6 27.4 25 27.4 21.5 Z"/>
          <ellipse cx="38" cy="15" rx="7" ry="3.6" fill="url(#iris-sheen)" opacity=".9"/>
          <path class="wisp" d="M29 27 l-2.2 1.2 M29.6 29.6 l-2 1.6 M51 27 l2.2 1.2 M50.4 29.6 l2 1.6 M40 10.2 v2.4 M37.8 10.6 l.5 2 M42.2 10.6 l-.5 2"/>
          <g class="eye-open">${eye(35, 21.2)}${eye(45, 21.2)}</g>
          <path class="eye-shut" d="${eyeShut(35, 21.2)} ${eyeShut(45, 21.2)}" fill="none" stroke="#5b504c" stroke-width="1" stroke-linecap="round"/>
          <path class="eye-joy" d="${eyeJoy(35, 21.2)} ${eyeJoy(45, 21.2)}" fill="none" stroke="#5b504c" stroke-width="1" stroke-linecap="round"/>
          <ellipse class="blush" cx="32.6" cy="27" rx="2.4" ry="1.3" fill="#f9b3c8"/>
          <ellipse class="blush" cx="47.4" cy="27" rx="2.4" ry="1.3" fill="#f9b3c8"/>
          ${muzzle(40, 25.8)}
          <path class="sweat" d="M28.6 9.6 q2.2 3.2 0 4.6 q-2.2 -1.4 0 -4.6z" fill="#9ccfff"/>
        </g>
      </g>

      <!-- walking, side view facing right -->
      <g class="pose-walk">
        <g class="tail tail-w">
          <path class="fluff" d="M22 38 C12 39 6 33 6.5 24 C7 17 10.5 13 14 12" fill="none" stroke="url(#iris-fur)" stroke-width="10" stroke-linecap="round"/>
          <path class="wisp" d="M11 30 q-3 -5 -2 -11 M14 34 q-5 -3 -6 -9" stroke="#ffffff" stroke-width=".8"/>
        </g>
        <g class="legs fluff">
          <g class="leg leg-b"><rect x="26" y="42" width="6" height="16" rx="3" fill="url(#iris-far)"/></g>
          <g class="leg leg-a"><rect x="49" y="42" width="5.6" height="16" rx="2.8" fill="url(#iris-far)"/></g>
        </g>
        <g class="body-g">
          <g class="fluff">
            <path fill="url(#iris-fur)" d="M20 38 C20 29 28 25.5 38 25.5 C46 25.5 52 27 55 31 C58 35 57.5 44 49 46 L27 46.5 C22 46.5 20 43 20 38 Z"/>
            <ellipse cx="27" cy="41" rx="8" ry="7.5" fill="url(#iris-fur)"/>
            <path fill="url(#iris-fur)" d="M26 45.5 q2 3.2 4 0 q2 3.2 4 0 q2 3.2 4 0 q2 3.2 4 0 q2 3.2 4 0 v-2 h-20 z"/>
            <path fill="#ffffff" d="M50 30 C56 30 60.5 34 59.5 40 C59 44.5 55.5 47 51 46.5 C53 42 52.4 36 50 30 Z"/>
          </g>
          <ellipse cx="36" cy="30" rx="11" ry="3.6" fill="url(#iris-sheen)" opacity=".9"/>
          <path class="wisp" d="M30 40 q2 3 1.4 5.6 M36 41 q1.6 2.6 1.2 5 M54 36 q2 3 1.6 7"/>
        </g>
        <g class="legs fluff">
          <g class="leg leg-a"><rect x="28.5" y="44" width="6.6" height="14" rx="3.2" fill="url(#iris-fur)"/><ellipse cx="32" cy="57.8" rx="4.4" ry="2" fill="#fff"/></g>
          <g class="leg leg-b"><rect x="46" y="44" width="6.2" height="14" rx="3" fill="url(#iris-fur)"/><ellipse cx="49.3" cy="57.8" rx="4.2" ry="2" fill="#fff"/></g>
        </g>
        <g class="head">
          <g class="fluff">
            <path class="ear ear-l" fill="url(#iris-fur)" d="M53 17 L53.5 6 Q54 4.5 55.3 5.4 L61.5 12 Z"/>
            <path class="ear ear-r" fill="url(#iris-fur)" d="M64 12 L70.5 5.2 Q71.8 4.4 72 6 L72.8 17.5 Z"/>
          </g>
          <path fill="url(#iris-ear)" d="M54.8 14 L55.2 8 L59.3 12 Z"/>
          <path fill="url(#iris-ear)" d="M66 12.2 L70.4 8 L70.9 14.5 Z"/>
          <path class="fluff" fill="url(#iris-fur)"
            d="M50 24 C50 15.5 55.5 11 62.5 11 C69.5 11 75 15.5 75 24 C75 27.5 73.8 30 72 31.8 C73.5 33 73 35 71.5 35.4 C70 37.5 66.5 38.5 62.5 38.5 C58.5 38.5 55 37.5 53.5 35.4 C52 35 51.5 33 53 31.8 C51.2 30 50 27.5 50 24 Z"/>
          <ellipse cx="61" cy="16.5" rx="7" ry="3.4" fill="url(#iris-sheen)" opacity=".9"/>
          <path class="wisp" d="M51.4 29.4 l-2.2 1.2 M52 32 l-2 1.6 M73.6 29.4 l2.2 1.2 M73 32 l2 1.6"/>
          <g class="eye-open">${eye(57.6, 23.6)}${eye(67.4, 23.6)}</g>
          <path class="eye-shut" d="${eyeShut(57.6, 23.6)} ${eyeShut(67.4, 23.6)}" fill="none" stroke="#5b504c" stroke-width="1" stroke-linecap="round"/>
          <path class="eye-joy" d="${eyeJoy(57.6, 23.6)} ${eyeJoy(67.4, 23.6)}" fill="none" stroke="#5b504c" stroke-width="1" stroke-linecap="round"/>
          <ellipse class="blush" cx="55.4" cy="29.4" rx="2.3" ry="1.25" fill="#f9b3c8"/>
          <ellipse class="blush" cx="69.6" cy="29.4" rx="2.3" ry="1.25" fill="#f9b3c8"/>
          ${muzzle(62.5, 28.2)}
          <path class="sweat" d="M51.4 11.4 q2.2 3.2 0 4.6 q-2.2 -1.4 0 -4.6z" fill="#9ccfff"/>
        </g>
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
      return { min: 2, max: Math.max(2, w - W - 2), w, h: pill.offsetHeight };
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
      [{ transform: 'scale(1,1)' }, { transform: 'scale(1.1,.86)' }, { transform: 'scale(1,1)' }],
      { duration: 300, easing: 'ease-out' }).finished.catch(() => {});

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
      const speed = mood === 'stressed' ? 50 : 26;
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
        { transform: T((x + land) / 2, -32), offset: 0.55 },
        { transform: T(land, 0) },
      ], { duration: 700, easing: 'cubic-bezier(.3,.7,.4,1)' });
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
        { transform: T((x + gx) / 2, gy * 0.25, `rotate(${side * 18}deg)`), offset: 0.4 },
        { transform: T(gx, gy, 'rotate(0deg)') },
      ], { duration: 560, easing: 'cubic-bezier(.5,0,.9,.55)' });
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
        if (r < 0.14 && roomFor(side)) await fall(side);
        else if (r < 0.62) await walkTo(rand(b.min, b.max));
        else if (r < 0.8) await flash('groom', 1600);
        else await flash('flick', 1000);
      } finally {
        busy = false;
        next(mood === 'sleep' ? 5000 : rand(1800, 5200));
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
          ['♥', '♥', '♥'].forEach((h, i) => particle(h, { dx: (i - 1) * 18, delay: i * 120 }));
          particle('nya~!', { delay: 300 });
          air(true);
          await move([
            { transform: T(x, y, 'rotate(0deg)') },
            { transform: T(x, y - 34, 'rotate(-180deg)'), offset: 0.5 },
            { transform: T(x, y, 'rotate(-360deg)') },
          ], { duration: 800, easing: 'ease-in-out' });
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
            await move([{ transform: T(x, y) }, { transform: T(x, y - 18), offset: 0.45 }, { transform: T(x, y) }], { duration: 520, easing: 'ease-out' });
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
