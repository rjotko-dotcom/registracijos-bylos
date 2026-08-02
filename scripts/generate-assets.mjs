// Generates PWA icons from the idle sprite and synthesizes placeholder
// audio (WAV) for purr/meow/chirp/pop. Real recordings of Frėja can replace
// the WAV files later — see docs/ASSETS.md.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src/assets/freja/idle/freja-idle-01.png');
const PWA = resolve(root, 'public/pwa');
const AUDIO = resolve(root, 'src/assets/audio');
mkdirSync(PWA, { recursive: true });
mkdirSync(AUDIO, { recursive: true });

// ---------- Icons ----------
const CREAM = { r: 0xf6, g: 0xef, b: 0xe3, alpha: 1 };
async function icon(size, name, pad = 0.82) {
  const inner = Math.round(size * pad);
  const img = await sharp(SRC)
    .resize(inner, inner, { fit: 'cover', position: 'attention' })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: img, gravity: 'centre' }])
    .png()
    .toFile(resolve(PWA, name));
  console.log('icon', name);
}
await icon(192, 'icon-192.png');
await icon(512, 'icon-512.png');
await icon(512, 'icon-512-maskable.png', 0.62);
await icon(180, 'apple-touch-icon.png', 1.0);
await sharp(SRC).resize(64, 64, { fit: 'cover', position: 'attention' }).png().toFile(resolve(root, 'public/favicon.png'));

// ---------- Audio (synthesized placeholder WAVs) ----------
const SR = 22050;
function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767 | 0, 44 + i * 2);
  return buf;
}
const save = (name, s) => { writeFileSync(resolve(AUDIO, name), wav(s)); console.log('audio', name); };

// Purr: low rumble ~26 Hz pulse train with breathing envelope, seamless loop.
{
  const dur = 4, n = SR * dur, s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const breath = 0.55 + 0.45 * Math.sin((2 * Math.PI * t) / dur * 2); // 2 breaths per loop
    const pulse = Math.sin(2 * Math.PI * 26 * t) * Math.exp(-3 * ((t * 26) % 1));
    const rumble = Math.sin(2 * Math.PI * 52 * t) * 0.35;
    const noise = (Math.random() * 2 - 1) * 0.06;
    s[i] = (pulse * 0.5 + rumble + noise) * breath * 0.4;
  }
  // crossfade tail into head for a click-free loop
  const f = SR * 0.05;
  for (let i = 0; i < f; i++) { const a = i / f; s[i] = s[i] * a + s[n - f + i] * (1 - a); }
  save('purr-loop.wav', s.slice(0, n - f));
}
// Meows: pitch sweep with vibrato + formant-ish harmonics.
function meow(base, peak, dur, wob) {
  const n = SR * dur | 0, s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur;
    const env = Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 1.5;
    const f = base + (peak - base) * Math.sin(Math.PI * p) + wob * Math.sin(2 * Math.PI * 7 * t);
    const ph = 2 * Math.PI * f * t;
    s[i] = (Math.sin(ph) * 0.6 + Math.sin(2 * ph) * 0.28 + Math.sin(3 * ph) * 0.12) * env * 0.5;
  }
  return s;
}
save('meow-1.wav', meow(420, 720, 0.75, 14));
save('meow-2.wav', meow(360, 620, 0.95, 20));
// Chirp / trill
{
  const dur = 0.35, n = SR * dur | 0, s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur;
    const env = Math.sin(Math.PI * p);
    const f = 600 + 250 * Math.sin(2 * Math.PI * 22 * t);
    s[i] = Math.sin(2 * Math.PI * f * t) * env * 0.4;
  }
  save('chirp.wav', s);
}
// Soft pop (UI feedback)
{
  const dur = 0.12, n = SR * dur | 0, s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    s[i] = Math.sin(2 * Math.PI * (300 + 500 * Math.exp(-t * 30)) * t) * Math.exp(-t * 28) * 0.5;
  }
  save('soft-pop.wav', s);
}
console.log('done');

// ---------- Sprite optimization ----------
// Downscale the large source frames to a phone-friendly size with palette
// compression. Pixel-art look is preserved (rendering uses image-rendering:
// pixelated). Idempotent: skips files already small.
import { readdirSync, statSync } from 'node:fs';
const FREJA = resolve(root, 'src/assets/freja');
async function optimizeDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) { await optimizeDir(p); continue; }
    if (!entry.name.endsWith('.png')) continue;
    if (statSync(p).size < 400 * 1024) continue;
    const buf = await sharp(p).resize({ width: 720, withoutEnlargement: true }).png({ palette: true, colors: 255, compressionLevel: 9 }).toBuffer();
    writeFileSync(p, buf);
    console.log('optimized', entry.name, Math.round(buf.length / 1024) + 'KB');
  }
}
await optimizeDir(FREJA);
