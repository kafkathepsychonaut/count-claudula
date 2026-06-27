'use strict';
// Tray icon: the pixel-art sprite of Count Claudula (assets/claudula.png),
// resized. Fallback = coral spark drawn by hand (in case the PNG fails).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, paint) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size); // +1 filter byte per scanline
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y);
      const o = y * (stride + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Neutral fallback (only used if the sprite fails to load): a coral rounded
// square, with no brand element.
function makeFallbackIcon() {
  const S = 32, coral = [217, 119, 87], r = 7, half = 13;
  const png = makePng(S, (x, y) => {
    const dx = Math.abs(x + 0.5 - 16) - (half - r);
    const dy = Math.abs(y + 0.5 - 16) - (half - r);
    const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
    const a = Math.max(0, Math.min(1, 0.5 - d)) * 255;
    return a > 0 ? [coral[0], coral[1], coral[2], a] : [0, 0, 0, 0];
  });
  return nativeImage.createFromBuffer(png);
}

function makeTrayIcon() {
  try {
    const buf = fs.readFileSync(path.join(__dirname, 'renderer', 'assets', 'claudula.png'));
    const img = nativeImage.createFromBuffer(buf);
    if (!img.isEmpty()) return img.resize({ width: 32, height: 32, quality: 'best' });
  } catch (_) { /* falls through to the fallback */ }
  return makeFallbackIcon();
}

module.exports = { makeTrayIcon };
