// news-image-20261124 — "The World": a newspaper front page summing up
// Tuesday 24 November 2026, drawn programmatically and written to
// /output/entry.png.
//
// Node 22, standard library only (node:fs, node:path, node:zlib). No
// network, no bundled image assets, no clock, no randomness: two runs
// write byte-identical PNGs.
//
// Design: one broadsheet front page. A masthead names the day, the lead
// story is Ukraine sinking the Russian corvette Merkury off Libya, and
// five more panels cover COP31's collapse, the Indonesia factory fire,
// the Kyiv strikes, India-China border talks and the chess championship,
// with a footer ticker for the rest of the day. Flat-colour poster art,
// drawn with a hand-rolled rasterizer and a 5x7 bitmap font authored
// in this file, so the page stays legible when the judge views it small.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 227]; // newsprint cream
const INK = [26, 26, 26]; // near-black ink
const GREY = [110, 104, 90]; // muted grey-brown
const RED = [178, 34, 34]; // headline red / stamp
const BLUE = [38, 84, 124]; // sea / sky blue
const DEEPBLUE = [24, 52, 82]; // deep sea
const SKY = [168, 205, 226]; // pale sky
const ORANGE = [224, 122, 26]; // flame orange
const YELLOW = [240, 196, 64]; // flame yellow / sand
const GREEN = [74, 124, 64]; // land green
const WHITE = [250, 250, 248];

// ---------------------------------------------------------------- framebuffer
const fb = new Uint8Array(W * H * 3);
function fill(c) {
  for (let i = 0; i < W * H; i++) {
    fb[i * 3] = c[0];
    fb[i * 3 + 1] = c[1];
    fb[i * 3 + 2] = c[2];
  }
}
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function rect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x, y, w, c) {
  rect(x, y, w, 1, c);
}
function vline(x, y, h, c) {
  rect(x, y, 1, h, c);
}
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function circle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -w; x <= w; x++) px(cx + x, cy + y, c);
  }
}
function ring(cx, cy, r, t, c) {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
    }
  }
}
// Filled polygon (scanline). pts: [[x,y],...]
function poly(pts, c) {
  let minY = H;
  let maxY = 0;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) px(x, y, c);
    }
  }
}
function triangle(x0, y0, x1, y1, x2, y2, c) {
  poly(
    [
      [x0, y0],
      [x1, y1],
      [x2, y2],
    ],
    c
  );
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows; each row is a 5-bit number, bit 4 = leftmost pixel.
// Authored here from scratch for this entry (A-Z, 0-9 and punctuation).
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '-': [0, 0, 0, 0x0e, 0, 0, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '·': [0, 0, 0, 0x0c, 0x0c, 0, 0],
};

function glyph(ch) {
  const g = FONT[ch.toUpperCase()];
  return g ?? FONT['?'];
}
function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}
function drawText(x, y, s, scale, c) {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (1 << (4 - col))) {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(cx, y, s, scale, c) {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Greedy word wrap into lines no wider than maxW px.
function wrap(s, scale, maxW) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x, y, s, scale, maxW, c, lineGap) {
  const lines = wrap(s, scale, maxW);
  lines.forEach((ln, i) => drawText(x, y + i * (7 * scale + (lineGap ?? 4)), ln, scale, c));
  return lines.length;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- illustrations
// All art is flat-colour poster style: big shapes, strong silhouettes,
// readable at 300 px across. Each panel draws inside its own clip box.

function skySea(x, y, w, h, horizon) {
  rect(x, y, w, horizon, SKY);
  rect(x, y + horizon, w, h - horizon, BLUE);
  // sun
  circle(x + w - 70, y + 42, 26, YELLOW);
  // sea bands
  for (let i = 0; i < 4; i++) {
    hline(x, y + horizon + 14 + i * 16, w, DEEPBLUE);
  }
}

// Lead art: the corvette Merkury sinking in Benghazi harbour — hull
// listing to starboard, smoke and flame, two sea drones closing in.
function drawLeadArt(x, y, w, h) {
  const horizon = Math.floor(h * 0.42);
  skySea(x, y, w, h, horizon);
  // distant headland
  poly(
    [
      [x, y + horizon],
      [x + 90, y + horizon - 26],
      [x + 190, y + horizon],
    ],
    GREEN
  );
  // smoke columns
  circle(x + 250, y + horizon - 78, 34, [120, 116, 108]);
  circle(x + 282, y + horizon - 108, 26, [140, 136, 128]);
  circle(x + 310, y + horizon - 132, 18, [160, 156, 148]);
  circle(x + 150, y + horizon - 60, 22, [120, 116, 108]);
  // sinking hull, listing hard to the right
  poly(
    [
      [x + 120, y + horizon + 8],
      [x + 430, y + horizon - 34],
      [x + 470, y + horizon + 6],
      [x + 430, y + horizon + 34],
      [x + 150, y + horizon + 52],
    ],
    [52, 52, 58]
  );
  // superstructure, half-awash
  poly(
    [
      [x + 210, y + horizon - 6],
      [x + 300, y + horizon - 22],
      [x + 330, y + horizon + 2],
      [x + 240, y + horizon + 14],
    ],
    [88, 88, 96]
  );
  // mast, leaning
  line(x + 300, y + horizon - 20, x + 322, y + horizon - 74, INK);
  line(x + 322, y + horizon - 74, x + 336, y + horizon - 60, INK);
  // flames on deck
  triangle(x + 250, y + horizon - 10, x + 268, y + horizon - 66, x + 286, y + horizon - 10, ORANGE);
  triangle(x + 282, y + horizon - 8, x + 296, y + horizon - 48, x + 310, y + horizon - 8, YELLOW);
  triangle(x + 350, y + horizon - 22, x + 364, y + horizon - 62, x + 378, y + horizon - 22, ORANGE);
  // sea drones: small dark boats with wakes, closing in
  poly(
    [
      [x + 40, y + horizon + 62],
      [x + 84, y + horizon + 62],
      [x + 96, y + horizon + 72],
      [x + 52, y + horizon + 72],
    ],
    INK
  );
  line(x + 96, y + horizon + 67, x + 150, y + horizon + 67, WHITE);
  poly(
    [
      [x + 470, y + horizon + 78],
      [x + 514, y + horizon + 78],
      [x + 526, y + horizon + 88],
      [x + 482, y + horizon + 88],
    ],
    INK
  );
  line(x + 470, y + horizon + 83, x + 420, y + horizon + 83, WHITE);
  // listing wake
  line(x + 120, y + horizon + 56, x + 470, y + horizon + 40, WHITE);
}

// COP31 art: a globe over a conference hall of empty chairs, with a
// red NO DEAL stamp across the panel.
function drawCopArt(x, y, w, h) {
  rect(x, y, w, h, [214, 226, 214]);
  // globe
  circle(x + 72, y + 44, 36, BLUE);
  poly(
    [
      [x + 46, y + 26],
      [x + 64, y + 20],
      [x + 78, y + 34],
      [x + 68, y + 48],
      [x + 50, y + 44],
    ],
    GREEN
  );
  poly(
    [
      [x + 80, y + 58],
      [x + 98, y + 54],
      [x + 104, y + 70],
      [x + 90, y + 76],
    ],
    GREEN
  );
  ring(x + 72, y + 44, 36, 3, INK);
  // empty chairs row
  for (let i = 0; i < 5; i++) {
    const cx = x + 160 + i * 52;
    rect(cx, y + 60, 34, 7, INK);
    rect(cx + 4, y + 67, 5, 26, INK);
    rect(cx + 25, y + 67, 5, 26, INK);
  }
  rect(x + 150, y + 93, 288, 3, INK);
  // red stamp
  const sx = x + 196;
  const sy = y + 8;
  rect(sx, sy, 210, 44, RED);
  drawText(sx + 14, sy + 12, 'NO DEAL', 4, WHITE);
}

// Factory fire art: a candy factory with a sawtooth roof, chimney and
// flames, smoke rising.
function drawFireArt(x, y, w, h) {
  rect(x, y, w, h, [232, 200, 160]);
  // smoke
  circle(x + 330, y + 14, 18, [120, 116, 108]);
  circle(x + 352, y + 6, 12, [140, 136, 128]);
  circle(x + 120, y + 16, 14, [120, 116, 108]);
  // factory block
  rect(x + 30, y + 56, 300, 40, [70, 66, 60]);
  // sawtooth roof
  for (let i = 0; i < 5; i++) {
    triangle(x + 30 + i * 60, y + 56, x + 60 + i * 60, y + 38, x + 90 + i * 60, y + 56, [70, 66, 60]);
  }
  // chimney
  rect(x + 350, y + 18, 26, 78, [90, 86, 80]);
  rect(x + 344, y + 12, 38, 8, [70, 66, 60]);
  // windows, dark
  for (let i = 0; i < 6; i++) rect(x + 48 + i * 46, y + 68, 22, 18, [30, 28, 26]);
  // flames bursting from the roofline
  triangle(x + 90, y + 56, x + 116, y + 4, x + 142, y + 56, ORANGE);
  triangle(x + 128, y + 56, x + 146, y + 22, x + 164, y + 56, YELLOW);
  triangle(x + 220, y + 56, x + 240, y + 14, x + 260, y + 56, ORANGE);
  triangle(x + 246, y + 56, x + 260, y + 30, x + 274, y + 56, YELLOW);
}

// Kyiv art: a city skyline at dusk, an explosion blooming over it.
function drawKyivArt(x, y, w, h) {
  rect(x, y, w, h, [42, 44, 66]);
  // explosion bloom
  circle(x + 156, y + 46, 30, ORANGE);
  circle(x + 156, y + 46, 18, YELLOW);
  circle(x + 120, y + 30, 12, ORANGE);
  circle(x + 196, y + 34, 10, ORANGE);
  // smoke
  circle(x + 156, y + 12, 14, [110, 104, 96]);
  circle(x + 180, y + 8, 10, [110, 104, 96]);
  // skyline
  const tops = [70, 52, 82, 60, 44, 76, 58, 88];
  for (let i = 0; i < 8; i++) {
    const bx = x + 8 + i * 38;
    rect(bx, y + tops[i], 30, h - tops[i], [18, 18, 26]);
    // lit windows
    for (let wy = y + tops[i] + 8; wy < y + h - 8; wy += 14) {
      if ((i * 7 + wy) % 3 === 0) rect(bx + 6, wy, 5, 6, YELLOW);
      if ((i * 5 + wy) % 4 === 0) rect(bx + 18, wy, 5, 6, YELLOW);
    }
  }
}

// India-China art: Himalayan peaks with two small flags planted.
function drawTalksArt(x, y, w, h) {
  rect(x, y, w, h, SKY);
  circle(x + w - 46, y + 26, 16, YELLOW);
  // peaks
  poly(
    [
      [x, y + h],
      [x + 90, y + 26],
      [x + 180, y + h],
    ],
    [120, 128, 140]
  );
  poly(
    [
      [x + 120, y + h],
      [x + 210, y + 10],
      [x + 300, y + h],
    ],
    [88, 96, 110]
  );
  // snowcaps
  poly(
    [
      [x + 76, y + 42],
      [x + 90, y + 26],
      [x + 104, y + 42],
      [x + 96, y + 52],
      [x + 84, y + 50],
    ],
    WHITE
  );
  poly(
    [
      [x + 196, y + 26],
      [x + 210, y + 10],
      [x + 224, y + 26],
      [x + 216, y + 36],
      [x + 204, y + 34],
    ],
    WHITE
  );
  // India flag (saffron-white-green, wheel dot)
  rect(x + 34, y + h - 46, 44, 8, [255, 153, 51]);
  rect(x + 34, y + h - 38, 44, 8, WHITE);
  rect(x + 34, y + h - 30, 44, 8, [19, 136, 8]);
  circle(x + 56, y + h - 34, 4, [0, 56, 147]);
  line(x + 34, y + h - 46, x + 34, y + h - 4, INK);
  // China flag (red, five gold dots for stars)
  rect(x + w - 78, y + h - 46, 44, 24, [222, 41, 16]);
  circle(x + w - 68, y + h - 38, 3, YELLOW);
  circle(x + w - 56, y + h - 42, 2, YELLOW);
  circle(x + w - 52, y + h - 34, 2, YELLOW);
  circle(x + w - 58, y + h - 28, 2, YELLOW);
  circle(x + w - 68, y + h - 28, 2, YELLOW);
  line(x + w - 78, y + h - 46, x + w - 78, y + h - 4, INK);
}

// Chess art: a board corner and a white king.
function drawChessArt(x, y, w, h) {
  rect(x, y, w, h, [214, 196, 164]);
  const s = 26;
  const ox = x + 14;
  const oy = y + 14;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) rect(ox + c * s, oy + r * s, s, s, [240, 232, 210]);
      else rect(ox + c * s, oy + r * s, s, s, [60, 48, 36]);
    }
  }
  // white king standing on the board's edge
  const kx = x + w - 62;
  const ky = y + 18;
  rect(kx - 2, ky + 52, 44, 8, WHITE);
  poly(
    [
      [kx + 4, ky + 52],
      [kx + 12, ky + 18],
      [kx + 28, ky + 18],
      [kx + 36, ky + 52],
    ],
    WHITE
  );
  circle(kx + 20, ky + 12, 12, WHITE);
  rect(kx + 17, ky - 8, 6, 16, WHITE);
  rect(kx + 12, ky - 3, 16, 6, WHITE);
  ring(kx + 20, ky + 12, 12, 2, INK);
  // black pawn opposite
  circle(x + 40, y + h - 26, 9, INK);
  rect(x + 28, y + h - 20, 24, 6, INK);
}

// ---------------------------------------------------------------- layout
function panel(x, y, w, h) {
  rect(x, y, w, 1, INK);
  rect(x, y + h - 1, w, 1, INK);
  vline(x, y, h, INK);
  vline(x + w - 1, y, h, INK);
}

function main() {
  fill(PAPER);
  // double border
  rect(10, 10, W - 20, 3, INK);
  rect(10, H - 13, W - 20, 3, INK);
  rect(10, 10, 3, H - 20, INK);
  rect(W - 13, 10, 3, H - 20, INK);
  rect(18, 18, W - 36, 1, INK);
  rect(18, H - 19, W - 36, 1, INK);
  rect(18, 18, 1, H - 36, INK);
  rect(W - 19, 18, 1, H - 36, INK);

  // ---- masthead
  drawTextCentered(512, 34, 'THE WORLD', 11, INK);
  hline(28, 118, 968, 3, INK);
  // ---- date band
  rect(28, 126, 968, 34, INK);
  drawTextCentered(512, 135, 'TUESDAY  -  24 NOVEMBER 2026', 3, WHITE);
  drawTextCentered(512, 166, 'ONE DAY  ·  SIX STORIES  ·  EVERY REGION', 2, GREY);

  // ---- lead story: Ukraine sinks the Merkury off Libya
  const LX = 28;
  const LY = 192;
  const LW = 968;
  const LH = 368;
  panel(LX, LY, LW, LH);
  drawLeadArt(LX + 1, LY + 1, 560, LH - 2);
  vline(LX + 561, LY, LH, INK);
  const TX = LX + 578;
  drawText(TX, LY + 16, 'THE WAR AT SEA', 2, RED);
  drawWrapped(TX, LY + 40, 'UKRAINE SINKS RUSSIAN WARSHIP OFF LIBYA', 4, 384, INK, 6);
  hline(TX, LY + 162, 384, 2, INK);
  drawWrapped(
    TX,
    LY + 178,
    'Seven sea drones sink the corvette Merkury in Benghazi; a Ka-27 helicopter is destroyed and the cargo ship Angara is hit.',
    2,
    384,
    INK,
    5
  );

  // ---- second row: COP31 | Indonesia factory fire
  const R2Y = 574;
  const R2H = 226;
  const half = 474;
  // COP31
  panel(28, R2Y, half, R2H);
  drawCopArt(29, R2Y + 1, half - 2, 96);
  drawWrapped(40, R2Y + 106, 'COP31 ENDS WITH NO DEAL', 3, 450, INK, 4);
  drawWrapped(
    40,
    R2Y + 140,
    'Longest climate summit on record collapses in Antalya. The EU rejects a final text with no mention of fossil fuels.',
    2,
    450,
    INK,
    4
  );
  // Indonesia fire
  panel(522, R2Y, half, R2H);
  drawFireArt(523, R2Y + 1, half - 2, 96);
  drawWrapped(534, R2Y + 106, '24 DEAD IN INDONESIA FACTORY FIRE', 3, 450, INK, 4);
  drawWrapped(
    534,
    R2Y + 162,
    'Blaze at a candy plant in Serang kills 24; about 30 workers still missing as rescuers search the wreckage.',
    2,
    450,
    INK,
    4
  );

  // ---- third row: Kyiv | India-China talks | chess
  const R3Y = 814;
  const R3H = 134;
  const third = 312;
  // Kyiv
  panel(28, R3Y, third, R3H);
  drawKyivArt(29, R3Y + 1, third - 2, 52);
  drawWrapped(40, R3Y + 62, 'KYIV STRIKES KILL 14', 2, 288, INK, 3);
  drawWrapped(40, R3Y + 88, 'Russian missiles and drones hit homes.', 2, 288, GREY, 3);
  // India-China
  panel(356, R3Y, third, R3H);
  drawTalksArt(357, R3Y + 1, third - 2, 52);
  drawWrapped(368, R3Y + 62, 'INDIA, CHINA HOLD BORDER TALKS', 2, 288, INK, 3);
  drawWrapped(368, R3Y + 96, 'Commanders meet in Arunachal Pradesh.', 2, 288, GREY, 3);
  // Chess
  panel(684, R3Y, third, R3H);
  drawChessArt(685, R3Y + 1, third - 2, 52);
  drawWrapped(696, R3Y + 62, 'CHESS CROWN DEFENCE', 2, 288, INK, 3);
  drawWrapped(696, R3Y + 96, 'Gukesh defends his title in Geneva.', 2, 288, GREY, 3);

  // ---- footer ticker
  hline(28, 960, 968, 2, INK);
  drawTextCentered(512, 968, "ALSO: UK TO HOST 2035 WOMEN'S WORLD CUP  ·  ALCARAZ WINS ATP FINALS", 2, INK);
  drawTextCentered(512, 990, 'IRAN VOWS HORMUZ RESPONSE  ·  RUSSIAN SHIP SPARTA II ABLAZE OFF FINLAND', 2, GREY);

  const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'entry.png'), encodePNG());
}

main();
