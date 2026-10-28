// Builds tools/popup-preview/index.html: the real popup.html with a chrome.* stub and sample data in front of it,
// so the popup can be looked at (and screenshotted) in any browser without installing the extension.
// Serve the repo root (python -m http.server 8801) and open /tools/popup-preview/index.html?state=default|many|empty|problem
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
let html = readFileSync(new URL('src/popup/popup.html', root), 'utf8');
html = html
  .replace('href="popup.css"', 'href="/src/popup/popup.css"')
  .replaceAll('src="../core/', 'src="/src/core/')
  .replace('src="popup.js"', 'src="/src/popup/popup.js"')
  .replaceAll('src="../../', 'src="/').replaceAll('src="../assets/', 'src="/src/assets/')
  .replace('<script src="/src/core/quotas.js">', '<script src="/tools/popup-preview/stub.js"></script>\n  <script src="/src/core/quotas.js">');
writeFileSync(new URL('tools/popup-preview/index.html', root), html);
console.log('wrote tools/popup-preview/index.html');
