// Renders the gauge icon to icons/icon{16,32,48,128}.png with no dependencies.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (size, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));
const GREEN = [22, 163, 74], AMBER = [217, 119, 6], RED = [220, 38, 38];
const BG = [28, 25, 23], TRACK = [68, 64, 60], WHITE = [250, 250, 249];

// Returns [r,g,b,a] for a point in unit space (0..1).
function shade(x, y) {
  const r = 0.22;
  const qx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
  const qy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  if (Math.hypot(qx, qy) > r) return null;

  const cx = 0.5, cy = 0.62;
  const dx = x - cx, dy = cy - y;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx); // 0 = right, PI = left
  const value = 0.68;

  const inArc = dist > 0.25 && dist < 0.37 && dy > -0.02;
  if (inArc) {
    const t = 1 - Math.min(Math.max(ang / Math.PI, 0), 1);
    if (t > value) return [...TRACK, 255];
    const c = t < 0.5 ? mix(GREEN, AMBER, t / 0.5) : mix(AMBER, RED, (t - 0.5) / 0.5);
    return [...c, 255];
  }

  const na = Math.PI * (1 - value);
  const nx = Math.cos(na), ny = Math.sin(na);
  const along = dx * nx + dy * ny;
  const perp = Math.abs(dx * ny - dy * nx);
  if ((along > 0 && along < 0.3 && perp < 0.035) || dist < 0.065) return [...WHITE, 255];

  return [...BG, 255];
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const ss = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (py * size + px) * 4;
      if (a) {
        buf[i] = r / a; buf[i + 1] = g / a; buf[i + 2] = b / a;
        buf[i + 3] = Math.round((a / (ss * ss)) * 255);
      }
    }
  }
  writeFileSync(new URL(`../icons/icon${size}.png`, import.meta.url), png(size, buf));
  console.log('wrote icon' + size + '.png');
}
