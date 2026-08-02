// Removes the black vignette backdrop from the supplied Frėja frames.
//
// Neither luminance nor hue can separate her on its own: where her dark
// back meets the backdrop she is actually *darker* than it (rgb 11,9,8 vs
// 28,22,16), so a threshold or a flood fill eats the cat. Two signals do
// work, and together they cover the whole subject:
//
//   * brightness — the cream bed is unmistakable (215+ vs a backdrop glow
//     that tops out near 160)
//   * local texture — her fur is detailed (std-dev ~15-19) while the
//     backdrop is a smooth gradient (~1-5), which finds the silhouette of
//     her back where brightness cannot
//
// The convex hull of those pixels is the subject's outline. Everything
// outside it is cleared, and a thin band just inside is faded by depth so
// the hull's straight edges never show.

import sharp from 'sharp';

const BRIGHT_MIN = 175; // cream bed; safely above the backdrop glow
const TEXTURE_MIN = 8; // std-dev marking detailed fur vs smooth backdrop
const TEXTURE_R = 3; // half-window for the std-dev
const HULL_GROW = 1.012; // a hair of slack around the silhouette
const FEATHER = 24; // px of alpha falloff outside the hull
const BAND = 30; // px inside the hull where leftover backdrop is faded
const BAND_MAX = 196; // in that band anything dimmer than this is backdrop

function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src) => {
    const out = [];
    for (const p of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Distance to the nearest polygon edge; negative outside. */
function insideDistance(poly, x, y) {
  let minEdge = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const ex = bx - ax;
    const ey = by - ay;
    const len = Math.hypot(ex, ey) || 1;
    minEdge = Math.min(minEdge, (ex * (y - ay) - ey * (x - ax)) / len);
  }
  return minEdge;
}

/** Local standard deviation via integral images. */
function textureMap(grey, w, h, r) {
  const sum = new Float64Array((w + 1) * (h + 1));
  const sqs = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = grey[y * w + x];
      const i = (y + 1) * (w + 1) + (x + 1);
      sum[i] = v + sum[i - 1] + sum[i - w - 1] - sum[i - w - 2];
      sqs[i] = v * v + sqs[i - 1] + sqs[i - w - 1] - sqs[i - w - 2];
    }
  }
  const box = (arr, x0, y0, x1, y1) =>
    arr[(y1 + 1) * (w + 1) + x1 + 1] - arr[y0 * (w + 1) + x1 + 1] - arr[(y1 + 1) * (w + 1) + x0] + arr[y0 * (w + 1) + x0];
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const n = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s = box(sum, x0, y0, x1, y1);
      const q = box(sqs, x0, y0, x1, y1);
      out[y * w + x] = Math.sqrt(Math.max(0, q / n - (s / n) ** 2));
    }
  }
  return out;
}

export async function cutout(srcPath, { width = 900 } = {}) {
  const img = sharp(srcPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const lum = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

  const grey = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) grey[p] = lum(p * 4);
  const sd = textureMap(grey, w, h, TEXTURE_R);

  // 1. Subject pixels: the bright bed plus everything with fur detail.
  const pts = [];
  for (let x = 0; x < w; x += 2) {
    let top = -1;
    let bot = -1;
    for (let y = 0; y < h; y++) {
      const p = y * w + x;
      if (grey[p] > BRIGHT_MIN || sd[p] > TEXTURE_MIN) {
        if (top < 0) top = y;
        bot = y;
      }
    }
    if (top >= 0) {
      pts.push([x, top]);
      pts.push([x, bot]);
    }
  }
  if (pts.length < 8) throw new Error(`no subject found in ${srcPath}`);

  // 2. Convex hull of the silhouette, with a little slack.
  const hull = convexHull(pts);
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  const grown = hull.map(([x, y]) => [cx + (x - cx) * HULL_GROW, cy + (y - cy) * HULL_GROW]);

  // 3. Alpha: opaque inside, faded across the boundary, and dimmed inside a
  //    thin band so no straight hull edge survives against a pale room.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = insideDistance(grown, x, y);
      if (d >= 0) {
        if (d < BAND && grey[y * w + x] < BAND_MAX) {
          const keep = d / BAND;
          data[i + 3] = Math.round(data[i + 3] * keep * keep);
        }
        continue;
      }
      const fade = 1 + d / FEATHER;
      data[i + 3] = fade <= 0 ? 0 : Math.round(255 * fade * fade);
    }
  }

  const raw = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return sharp(raw)
    .trim({ threshold: 1 })
    .resize({ width, withoutEnlargement: true })
    .png({ palette: true, colors: 255, compressionLevel: 9 })
    .toBuffer();
}
