// Builds tools/a11y-preview/{widget,options}.html: the real on-page pill and the real options page, each with a chrome.*
// stub and sample data, so they can be screenshotted and checked (axe, keyboard) in any browser.
// Serve the repo root (python -m http.server 8801), then open
//   /tools/a11y-preview/widget.html?state=ok|hot|problem|estimate&open=1
//   /tools/a11y-preview/options.html
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const out = (f, s) => writeFileSync(new URL('tools/a11y-preview/' + f, root), s);

const script = (p) => `<script src="${p}"></script>`;
out('widget.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Meter pill preview</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;font:15px system-ui;background:#fff;color:#202124}
@media (prefers-color-scheme: dark){body{background:#212121;color:#ececec}}
.page{max-width:620px;margin:40px auto;padding:0 16px}.chat{display:flex;flex-direction:column;gap:14px;margin-top:30px}.msg{max-width:78%;padding:12px 16px;border-radius:18px;line-height:1.45}.msg.me{align-self:flex-end;background:#ece9f7;color:#1f1d2b}.msg.ai{align-self:flex-start;background:#f4f4f5;color:#202124}@media (prefers-color-scheme: dark){.msg.me{background:#3b3563;color:#fff}.msg.ai{background:#2f2f2f;color:#ececec}}</style></head>
<body><div class="page"><h1>A chat page</h1><p>The meter sits bottom-right of the page, exactly as the extension mounts it.</p></div>
${script('/tools/a11y-preview/widget-stub.js')}
${['quotas', 'common', 'parsers', 'store', 'widget'].map((n) => script('/src/core/' + n + '.js')).join('\n')}
${['iris-frames', 'walk8-frames', 'pet'].map((n) => script('/src/core/' + n + '.js')).join('\n')}
${script('/tools/a11y-preview/widget-run.js')}
</body></html>`);

let html = readFileSync(new URL('src/options/options.html', root), 'utf8');
html = html.replace('href="options.css"', 'href="/src/options/options.css"').replaceAll('src="../core/', 'src="/src/core/').replace('src="options.js"', 'src="/src/options/options.js"')
  .replace('<script src="/src/core/quotas.js">', '<script src="/tools/a11y-preview/options-stub.js"></script>\n  <script src="/src/core/quotas.js">');
out('options.html', html);
console.log('wrote widget.html, options.html');
