// Builds the Chrome Web Store upload zip: manifest.json, src/ and icons/ only, forward-slash paths, no dev files.
//   npm run store-zip            -> release/<YYYY-MM-DD>/ai-meter-<version>.zip (older dated folders are removed)
// Fails (non-zero exit) if the package is not ready: versions disagree, a file the manifest points at is missing,
// or something that should not ship (tests, docs, maps, dotfiles) would be included.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/%20/g, ' ');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const problems = [];
if (manifest.version !== pkg.version) problems.push(`manifest.json says ${manifest.version} but package.json says ${pkg.version}`);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(root, p).split(sep).join('/'));
  }
};
files.push('manifest.json');
walk(join(root, 'src'));
walk(join(root, 'icons'));
files.sort();

for (const f of files) {
  if (/(^|\/)\.|\.(map|test\.m?js|md|py|ts)$|(^|\/)(test|tests|docs|tools)\//i.test(f)) problems.push('should not ship: ' + f);
}
const need = new Set();
const add = (v) => { if (typeof v === 'string' && !v.includes('*')) need.add(v); };
for (const cs of manifest.content_scripts || []) (cs.js || []).forEach(add);
add(manifest.background && manifest.background.service_worker);
add(manifest.options_page);
add(manifest.action && manifest.action.default_popup);
Object.values(manifest.icons || {}).forEach(add);
Object.values((manifest.action && manifest.action.default_icon) || {}).forEach(add);
// files the extension loads by path at run time
for (const f of ['src/welcome/welcome.html']) add(f);
for (const f of need) if (!existsSync(join(root, f))) problems.push('manifest/runtime points at a missing file: ' + f);

if (problems.length) {
  console.error('NOT READY:\n - ' + problems.join('\n - '));
  process.exit(1);
}

// minimal zip writer (stored paths are UTF-8, deflate)
const chunks = [];
const central = [];
let offset = 0;
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const fixed = { time: 0x6000, date: ((2026 - 1980) << 9) | (10 << 5) | 31 }; // 2026-10-31, deterministic builds
for (const f of files) {
  const data = readFileSync(join(root, f));
  const comp = deflateRawSync(data, { level: 9 });
  const name = Buffer.from(f, 'utf8');
  const crc = crc32(data);
  const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(fixed.time), u16(fixed.date), u32(crc), u32(comp.length), u32(data.length), u16(name.length), u16(0), name, comp]);
  central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(fixed.time), u16(fixed.date), u32(crc), u32(comp.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
  chunks.push(local);
  offset += local.length;
}
const cd = Buffer.concat(central);
const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)]);
const day = new Date().toISOString().slice(0, 10);
const releaseDir = join(root, 'release');
mkdirSync(releaseDir, { recursive: true });
for (const d of readdirSync(releaseDir)) if (d !== day) rmSync(join(releaseDir, d), { recursive: true, force: true });
mkdirSync(join(releaseDir, day), { recursive: true });
const out = join(releaseDir, day, `ai-meter-${manifest.version}.zip`);
writeFileSync(out, Buffer.concat([...chunks, cd, end]));
console.log(`${out}\n${files.length} files, ${(statSync(out).size / 1024).toFixed(0)} KB, version ${manifest.version}`);
console.log('permissions:', manifest.permissions.join(', '), '| host_permissions:', (manifest.host_permissions || []).length, '| optional:', (manifest.optional_host_permissions || []).join(', '));
