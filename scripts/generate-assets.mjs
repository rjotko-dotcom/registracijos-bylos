// Builds every image and audio asset the app ships with:
//   1. Frėja's sprite frames, cut out of the supplied photos (see cutout.mjs)
//   2. Her cozy pixel-art bedroom backdrop (see room.mjs)
//   3. PWA icons
//   4. Placeholder purr/meow/chirp/pop audio — replace with real recordings
//      of Frėja any time, see docs/ASSETS.md
//
// Run with `npm run assets`. Source photos live in SOURCES below; point
// them at new uploads to refresh the art.

import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutout } from './cutout.mjs';
import { drawRoom } from './room.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UP = '/root/.claude/uploads/d0c33aac-370f-5a45-a345-424c6293bb67';

/** state folder -> [file name, source photo] */
const SOURCES = [
  ['idle', 'freja-idle-01.png', 'fd96a2c8-1000032462.png'],
  ['pressed', 'freja-pressed-closed.png', '4d890507-1000032461.png'],
  ['purr', 'freja-purr-01.png', '4d890507-1000032461.png'],
  ['sleep', 'freja-sleep-01.png', '7a10538d-1000032460.png'],
  ['meow', 'freja-meow-01.png', 'c2f1625c-1000032459.png'],
  ['meow', 'freja-meow-02.png', 'cb7869c9-1000032458.png'],
  ['yawn', 'freja-yawn-01.png', 'f5d0fee7-1000032457.png'],
];

const FREJA = resolve(root, 'src/assets/freja');
const SCENE = resolve(root, 'src/assets/scene');
const PWA = resolve(root, 'public/pwa');
const AUDIO = resolve(root, 'src/assets/audio');
[SCENE, PWA, AUDIO].forEach((d) => mkdirSync(d, { recursive: true }));

// ---------- 1. Sprite frames ----------
// Every frame is cut and trimmed independently, then padded back onto one
// shared canvas so the bed never shifts between frames.
const cuts = [];
for (const [folder, name, src] of SOURCES) {
  const from = resolve(UP, src);
  if (!existsSync(from)) {
    console.warn('missing source photo, skipping:', src);
    continue;
  }
  const buf = await cutout(from, { width: 760 });
  const meta = await sharp(buf).metadata();
  cuts.push({ folder, name, buf, w: meta.width, h: meta.height });
}
const boxW = Math.max(...cuts.map((c) => c.w));
const boxH = Math.max(...cuts.map((c) => c.h));
for (const c of cuts) {
  mkdirSync(resolve(FREJA, c.folder), { recursive: true });
  // Bottom-aligned and centred: the bed sits on the floor in every frame.
  await sharp({ create: { width: boxW, height: boxH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: c.buf, left: Math.round((boxW - c.w) / 2), top: boxH - c.h }])
    .png({ palette: true, colors: 255, compressionLevel: 9 })
    .toFile(resolve(FREJA, c.folder, c.name));
  console.log('frame', c.folder + '/' + c.name, `${boxW}x${boxH}`);
}

// ---------- 2. Room backdrop ----------
writeFileSync(resolve(SCENE, 'room.png'), await drawRoom());
console.log('scene room.png');

// ---------- 3. PWA icons ----------
const ICON_SRC = resolve(FREJA, 'idle/freja-idle-01.png');
const CREAM = { r: 0xf6, g: 0xef, b: 0xe3, alpha: 1 };
async function icon(size, name, pad = 0.9) {
  const inner = Math.round(size * pad);
  const art = await sharp(ICON_SRC).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toFile(resolve(PWA, name));
  console.log('icon', name);
}
await icon(192, 'icon-192.png');
await icon(512, 'icon-512.png');
await icon(512, 'icon-512-maskable.png', 0.66);
await icon(180, 'apple-touch-icon.png');
await sharp(resolve(PWA, 'icon-192.png')).resize(64, 64).png().toFile(resolve(root, 'public/favicon.png'));

// ---------- 4. Audio ----------
const SR = 22050;
function wav(samples) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE((Math.max(-1, Math.min(1, samples[i])) * 32767) | 0, 44 + i * 2);
  return b;
}
const save = (name, s) => { writeFileSync(resolve(AUDIO, name), wav(s)); console.log('audio', name); };

{ // purr: ~26 Hz pulse train with a breathing envelope, crossfaded to loop
  const dur = 4, n = SR * dur, s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const breath = 0.55 + 0.45 * Math.sin(((2 * Math.PI * t) / dur) * 2);
    const pulse = Math.sin(2 * Math.PI * 26 * t) * Math.exp(-3 * ((t * 26) % 1));
    const rumble = Math.sin(2 * Math.PI * 52 * t) * 0.35;
    s[i] = (pulse * 0.5 + rumble + (Math.random() * 2 - 1) * 0.06) * breath * 0.4;
  }
  const f = SR * 0.05;
  for (let i = 0; i < f; i++) { const a = i / f; s[i] = s[i] * a + s[n - f + i] * (1 - a); }
  save('purr-loop.wav', s.slice(0, n - f));
}
function meow(base, peak, dur, wob) {
  const n = (SR * dur) | 0, s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur;
    const env = Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 1.5;
    const fr = base + (peak - base) * Math.sin(Math.PI * p) + wob * Math.sin(2 * Math.PI * 7 * t);
    const ph = 2 * Math.PI * fr * t;
    s[i] = (Math.sin(ph) * 0.6 + Math.sin(2 * ph) * 0.28 + Math.sin(3 * ph) * 0.12) * env * 0.5;
  }
  return s;
}
save('meow-1.wav', meow(420, 720, 0.75, 14));
save('meow-2.wav', meow(360, 620, 0.95, 20));
{ const dur = 0.35, n = (SR * dur) | 0, s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, p = t / dur;
    s[i] = Math.sin(2 * Math.PI * (600 + 250 * Math.sin(2 * Math.PI * 22 * t)) * t) * Math.sin(Math.PI * p) * 0.4; }
  save('chirp.wav', s); }
{ const dur = 0.12, n = (SR * dur) | 0, s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR;
    s[i] = Math.sin(2 * Math.PI * (300 + 500 * Math.exp(-t * 30)) * t) * Math.exp(-t * 28) * 0.5; }
  save('soft-pop.wav', s); }

console.log('assets done');
