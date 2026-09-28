// Writes Iris's artwork from src/core/pet.js to standalone SVG files in art/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ AIMeter: { adapters: [] } });
vm.runInContext(readFileSync(new URL('../src/core/pet.js', import.meta.url), 'utf8'), ctx);
const svg = ctx.AIMeter.PET_SVG;

// The extension styles these classes from outside the SVG; inline the static look here.
const style = (hide) => `
  <style>
    .${hide} { display: none; }
    .eye-shut, .eye-joy, .sweat { display: none; }
    .fluff { filter: url(#iris-fluff); }
    .wisp { fill: none; stroke: #dfe3ea; stroke-width: .4; stroke-linecap: round; opacity: .7; }
    .blush { opacity: .35; }
  </style>`;

const standalone = (hide) => svg
  .replace('<svg viewBox="0 0 80 60" aria-hidden="true">', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60" width="480" height="360">${style(hide)}`)
  .replace(/\n\s*\n/g, '\n')
  .trim() + '\n';

mkdirSync(new URL('../art/', import.meta.url), { recursive: true });
writeFileSync(new URL('../art/iris-sit.svg', import.meta.url), standalone('pose-walk'));
writeFileSync(new URL('../art/iris-walk.svg', import.meta.url), standalone('pose-sit'));
console.log('wrote art/iris-sit.svg, art/iris-walk.svg');
