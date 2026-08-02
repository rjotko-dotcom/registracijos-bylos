// Draws Frėja's cozy bedroom as real pixel art: a low-resolution RGBA
// buffer scaled up with nearest-neighbour, so every pixel stays a hard
// square. Kept deliberately low-contrast — the room is a backdrop, Frėja
// is the subject.

import sharp from 'sharp';

const W = 120;
const H = 138;
const SCALE = 7;

const C = {
  wall: [0xf0, 0xe4, 0xd1],
  wallStripe: [0xe9, 0xdb, 0xc5],
  wallShade: [0xe4, 0xd3, 0xba],
  base: [0xc9, 0xac, 0x84],
  floor: [0xd9, 0xbe, 0x99],
  floorDark: [0xcd, 0xaf, 0x88],
  rug: [0xe9, 0xd8, 0xc0],
  rugEdge: [0xdc, 0xc4, 0xa6],
  frameWood: [0xc0, 0x94, 0x68],
  frameDark: [0xa2, 0x79, 0x52],
  glass: [0xfd, 0xf2, 0xd8],
  glassWarm: [0xf8, 0xe2, 0xb4],
  curtain: [0xf7, 0xed, 0xdc],
  shelf: [0xbe, 0x92, 0x66],
  bookA: [0xc4, 0x7f, 0x7f],
  bookB: [0x8f, 0xa9, 0x7b],
  bookC: [0xd9, 0xb6, 0x6a],
  bookD: [0x94, 0x8c, 0xb5],
  pot: [0xc9, 0x8b, 0x6a],
  potDark: [0xad, 0x73, 0x55],
  leaf: [0x93, 0xa9, 0x7c],
  leafDark: [0x78, 0x8f, 0x63],
  art: [0xe6, 0xcf, 0xd6],
};

export async function drawRoom() {
  const buf = Buffer.alloc(W * H * 4, 0);
  const put = (x, y, c, a = 255) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    if (a >= 255) {
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
      return;
    }
    const t = a / 255;
    buf[i] = Math.round(buf[i] * (1 - t) + c[0] * t);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - t) + c[1] * t);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - t) + c[2] * t);
    buf[i + 3] = 255;
  };
  const rect = (x, y, w, h, c, a = 255) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, c, a);
  };

  const FLOOR_Y = 94;

  // --- wall with a soft vertical wallpaper stripe ---
  rect(0, 0, W, FLOOR_Y, C.wall);
  for (let x = 0; x < W; x += 8) rect(x, 0, 3, FLOOR_Y, C.wallStripe);
  // corner shading so the room has depth
  for (let x = 0; x < W; x++) {
    const edge = Math.min(x, W - 1 - x) / 26;
    if (edge < 1) rect(x, 0, 1, FLOOR_Y, C.wallShade, Math.round((1 - edge) * 90));
  }

  // --- floor + baseboard ---
  rect(0, FLOOR_Y - 5, W, 5, C.base);
  rect(0, FLOOR_Y, W, H - FLOOR_Y, C.floor);
  for (let y = FLOOR_Y + 6; y < H; y += 7) rect(0, y, W, 1, C.floorDark);

  // --- window, upper left, warm daylight ---
  rect(6, 6, 4, 48, C.curtain);
  rect(40, 6, 5, 48, C.curtain);
  rect(10, 8, 30, 44, C.frameWood);
  rect(12, 10, 26, 40, C.glass);
  rect(12, 34, 26, 16, C.glassWarm);
  rect(24, 10, 2, 40, C.frameWood); // mullion
  rect(12, 28, 26, 2, C.frameWood); // transom

  // --- shelf, upper right, with books and a framed photo ---
  rect(72, 44, 44, 3, C.shelf);
  rect(74, 47, 2, 3, C.frameDark); // bracket
  rect(112, 47, 2, 3, C.frameDark);
  const books = [C.bookA, C.bookB, C.bookC, C.bookD, C.bookA, C.bookB];
  let bx = 76;
  books.forEach((col, i) => {
    const bh = 10 + ((i * 3) % 5);
    rect(bx, 44 - bh, 4, bh, col);
    bx += 5;
  });
  // framed picture leaning on the shelf
  rect(96, 26, 16, 18, C.frameWood);
  rect(98, 28, 12, 14, C.art);
  rect(101, 33, 6, 6, C.frameDark, 70);

  // --- houseplant, lower left ---
  rect(10, 74, 16, 18, C.pot);
  rect(10, 74, 16, 3, C.potDark);
  rect(22, 77, 4, 15, C.potDark, 90);
  const leaves = [
    [17, 58, 3, 16],
    [13, 62, 3, 13],
    [21, 62, 3, 13],
    [9, 68, 4, 8],
    [25, 68, 4, 8],
    [17, 52, 3, 8],
  ];
  leaves.forEach(([x, y, w, h], i) => rect(x, y, w, h, i % 2 ? C.leafDark : C.leaf));
  rect(15, 66, 10, 4, C.leaf);
  rect(12, 72, 16, 3, C.leafDark, 150);

  // --- oval rug the bed will sit on ---
  const rcx = 60;
  const rcy = 116;
  const rrx = 54;
  const rry = 19;
  for (let y = rcy - rry; y <= rcy + rry; y++) {
    for (let x = rcx - rrx; x <= rcx + rrx; x++) {
      const d = ((x - rcx) / rrx) ** 2 + ((y - rcy) / rry) ** 2;
      if (d <= 1) put(x, y, d > 0.82 ? C.rugEdge : C.rug);
    }
  }

  // --- warm pool of light where Frėja rests ---
  for (let y = 40; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 60) / 62, (y - 96) / 58);
      if (d < 1) put(x, y, [0xff, 0xf3, 0xdc], Math.round((1 - d) * 46));
    }
  }

  return sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .resize(W * SCALE, H * SCALE, { kernel: 'nearest' })
    .png({ palette: true, colors: 128, compressionLevel: 9 })
    .toBuffer();
}
