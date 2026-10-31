// Builds the Chrome Web Store images (screenshots 1280x800, promo tile 440x280, marquee 1400x560) as HTML pages that
// frame the real extension UI (the preview harnesses) on the lavender ground, then renders them with headless Chrome
// over the DevTools protocol (real clock, so Iris has time to walk home and fall asleep).
//   1. python -m http.server 8801   (from the repo root)
//   2. node tools/a11y-preview/build.mjs && node tools/popup-preview/build.mjs
//   3. node tools/store-shots/build.mjs        -> dist/store/shots/*.png
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8801';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = new URL('../../', import.meta.url);
const srcDir = new URL('dist/store/src/', root);
const outDir = new URL('dist/store/shots/', root);
mkdirSync(srcDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const iconB64 = readFileSync(new URL('icons/icon128.png', root)).toString('base64');

const css = `*{box-sizing:border-box}html,body{margin:0}body{font:16px system-ui,"Segoe UI",sans-serif;background:#ece9f7;color:#1f1d2b;overflow:hidden}
.stage{position:relative;width:100%;height:100%;padding:40px 56px}
h1{margin:0 0 6px;font-size:44px;line-height:1.1;letter-spacing:-.02em}.sub{margin:0 0 22px;font-size:20px;color:#5b5675}
.card{background:#fff;border-radius:22px;box-shadow:0 24px 60px -20px rgba(60,40,120,.45),0 2px 6px rgba(0,0,0,.06);overflow:hidden;position:relative}
iframe{border:0;display:block;background:#fff}.lab{font-size:15px;color:#5b5675;text-align:center;margin-top:10px}`;
const page = (w, h, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body style="width:${w}px;height:${h}px"><div class="stage">${body}</div></body></html>`;
const frame = (url, w, h, style = '') => `<div class="card" style="width:${w}px;height:${h}px;${style}"><iframe src="${BASE}${url}" width="${w}" height="${h}"></iframe></div>`;
const moods = [['ok', 'Plenty left'], ['warn', 'Getting close'], ['hot', 'Nearly out'], ['full', 'Out of messages']];

const shots = {
  '1-hero': [1280, 800, page(1280, 800, `<h1>See your AI limit before you hit it</h1><p class="sub">A small meter on the chat page, with the percentage used and when it resets.</p>${frame('/tools/a11y-preview/widget.html?state=ok&scene=chat', 1168, 590)}`)],
  '2-panel': [1280, 800, page(1280, 800, `<h1>Real numbers, straight from the provider</h1><p class="sub">Session and weekly usage, reset times and this chat's length, one click away.</p>${frame('/tools/a11y-preview/widget.html?state=ok&scene=chat&open=1', 1168, 590)}`)],
  '3-moods': [1280, 800, page(1280, 800, `<h1>Iris gets stressed so you don't have to</h1><p class="sub">Calm, worried, stressed, asleep: the cat follows your usage.</p>
    <div style="display:grid;grid-template-columns:repeat(2,560px);gap:18px 48px">${moods.map(([s, l]) => `<div>${frame(`/tools/a11y-preview/widget.html?state=${s}&bare=1`, 560, 220)}<div class="lab">${l}</div></div>`).join('')}</div>`)],
  '4-popup': [1280, 800, page(1280, 800, `<div style="display:flex;gap:56px;align-items:flex-start"><div style="width:600px;padding-top:60px"><h1>Every provider in one popup</h1><p class="sub">Claude, ChatGPT, Gemini, Grok, Perplexity and more. Click a line for the full bars and reset times.</p></div>${frame('/tools/popup-preview/index.html?state=many', 380, 480)}</div>`)],
  '5-settings': [1280, 800, page(1280, 800, `<h1>Add any AI site, set your own limits</h1><p class="sub">Chrome asks for access to that one site only, never all sites.</p>${frame('/tools/a11y-preview/options.html#other-sites', 1168, 590)}`)],
  '6-problem': [1280, 800, page(1280, 800, `<h1>Tells you when it can't read a number</h1><p class="sub">No made-up figures: a clear message and a one-click debug copy.</p>${frame('/tools/a11y-preview/widget.html?state=problem&scene=chat&open=1', 1168, 590)}`)],
  'promo-tile-440x280': [440, 280, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="width:440px;height:280px"><div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24px"><img src="data:image/png;base64,${iconB64}" width="72" height="72" alt=""><div style="font-size:38px;font-weight:700;margin-top:10px;letter-spacing:-.02em">AI Meter</div><div style="font-size:16px;color:#5b5675;margin-top:6px">Know your limit before the cat does.</div></div></body></html>`],
  'marquee-1400x560': [1400, 560, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="width:1400px;height:560px"><div style="height:100%;display:flex;align-items:center;gap:56px;padding:0 90px"><img src="data:image/png;base64,${iconB64}" width="150" height="150" alt=""><div><div style="font-size:72px;font-weight:700;letter-spacing:-.03em">AI Meter</div><div style="font-size:30px;color:#5b5675;margin-top:8px">Know your limit before the cat does.</div><div style="font-size:20px;color:#5b5675;margin-top:18px">Claude · ChatGPT · Gemini · Grok · Perplexity · Kimi · and any site you add</div></div></div></body></html>`],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9333;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'aimeter-shots-profile')}`, 'about:blank'], { stdio: 'ignore' });
try {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(200); }
  }
  for (const [name, [w, h, html]] of Object.entries(shots)) {
    writeFileSync(new URL(name + '.html', srcDir), html);
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${BASE}/dist/store/src/${name}.html`, { method: 'PUT' })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => { ws.onopen = r; });
    let id = 0;
    const call = (method, params = {}) => new Promise((resolve) => {
      const my = ++id;
      const on = (m) => { const d = JSON.parse(m.data); if (d.id === my) { ws.removeEventListener('message', on); resolve(d.result); } };
      ws.addEventListener('message', on);
      ws.send(JSON.stringify({ id: my, method, params }));
    });
    await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(name === '3-moods' ? 16000 : 4500);
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(new URL(name + '.png', outDir), Buffer.from(data, 'base64'));
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
    console.log('shot', name);
  }
} finally {
  chrome.kill();
}
