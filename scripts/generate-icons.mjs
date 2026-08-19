/**
 * scripts/generate-icons.mjs
 *
 * Generates all PWA icon assets using @napi-rs/canvas:
 *   public/icons/icon-192.png        (PWA manifest icon)
 *   public/icons/icon-512.png        (PWA manifest icon)
 *   public/icons/apple-touch-icon.png  (180×180, iOS home-screen)
 *   public/icons/badge-72.png        (72×72, notification badge — monochrome)
 *
 * Run once:  node scripts/generate-icons.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// ── Palette ───────────────────────────────────────────────────────────────────
const TWILIGHT_BLUE  = '#8AA3C2';
const SOFT_PEACH     = '#FFD194';
const SUNSET_ORANGE  = '#FF512F';
const WARM_SAND      = '#FDF5E6';
const OCEAN_NAVY     = '#2B4162';
const DEEP_TEAL      = '#1A8B9D';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Draw the main branded icon at given size and return PNG buffer */
function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const r = size / 2;
  const cx = r;
  const cy = r;

  // 1. Background circle with sunset gradient
  const grad = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy, r);
  grad.addColorStop(0,   SOFT_PEACH);
  grad.addColorStop(0.5, '#F5C98A');
  grad.addColorStop(1,   TWILIGHT_BLUE);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 2. Horizon line
  const horizonY = cy + r * 0.12;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, horizonY);
  ctx.lineTo(cx + r * 0.7, horizonY);
  ctx.strokeStyle = 'rgba(43,65,98,0.18)';
  ctx.lineWidth = size * 0.012;
  ctx.stroke();

  // 3. Sun disc
  const sunR = r * 0.26;
  const sunGrad = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, sunR);
  sunGrad.addColorStop(0, '#FFE0A0');
  sunGrad.addColorStop(0.6, SUNSET_ORANGE);
  sunGrad.addColorStop(1, '#C0391B');
  ctx.beginPath();
  ctx.arc(cx, horizonY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // 4. Sun rays (8 rays)
  const rayCount = 8;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 - Math.PI / 2;
    const innerR = sunR * 1.3;
    const outerR = sunR * 1.75;
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = horizonY + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = horizonY + Math.sin(angle) * outerR;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255,81,47,0.55)';
    ctx.lineWidth = size * 0.022;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // 5. Envelope shape (letter silhouette below sun)
  const envW = r * 1.0;
  const envH = r * 0.58;
  const envX = cx - envW / 2;
  const envY = horizonY + r * 0.08;

  ctx.beginPath();
  ctx.roundRect(envX, envY, envW, envH, size * 0.04);
  ctx.fillStyle = 'rgba(253,245,230,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(26,139,157,0.4)';
  ctx.lineWidth = size * 0.018;
  ctx.stroke();

  // Envelope V-flap
  ctx.beginPath();
  ctx.moveTo(envX, envY);
  ctx.lineTo(cx, envY + envH * 0.55);
  ctx.lineTo(envX + envW, envY);
  ctx.strokeStyle = 'rgba(26,139,157,0.35)';
  ctx.lineWidth = size * 0.016;
  ctx.stroke();

  // 6. Wax seal dot on envelope
  const sealR = size * 0.055;
  const sealGrad = ctx.createRadialGradient(cx, envY + envH * 0.55, 0, cx, envY + envH * 0.55, sealR);
  sealGrad.addColorStop(0, '#FF8C5A');
  sealGrad.addColorStop(1, SUNSET_ORANGE);
  ctx.beginPath();
  ctx.arc(cx, envY + envH * 0.55, sealR, 0, Math.PI * 2);
  ctx.fillStyle = sealGrad;
  ctx.fill();

  return canvas.toBuffer('image/png');
}

/** Draw a simple monochrome badge icon (72×72) for notification badge */
function drawBadge(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const r = size / 2;
  const cx = r;
  const cy = r;

  // White circle background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = SUNSET_ORANGE;
  ctx.fill();

  // Envelope outline
  const eW = size * 0.58;
  const eH = size * 0.42;
  const eX = cx - eW / 2;
  const eY = cy - eH / 2 + size * 0.03;

  ctx.beginPath();
  ctx.roundRect(eX, eY, eW, eH, size * 0.06);
  ctx.fillStyle = WARM_SAND;
  ctx.fill();

  // Flap
  ctx.beginPath();
  ctx.moveTo(eX, eY);
  ctx.lineTo(cx, eY + eH * 0.56);
  ctx.lineTo(eX + eW, eY);
  ctx.strokeStyle = 'rgba(43,65,98,0.4)';
  ctx.lineWidth = size * 0.05;
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// ── Generate ──────────────────────────────────────────────────────────────────

const sizes = [
  { name: 'icon-192.png',         size: 192, fn: drawIcon },
  { name: 'icon-512.png',         size: 512, fn: drawIcon },
  { name: 'apple-touch-icon.png', size: 180, fn: drawIcon },
  { name: 'badge-72.png',         size: 72,  fn: drawBadge },
];

for (const { name, size, fn } of sizes) {
  const buf = fn(size);
  const outPath = join(OUT_DIR, name);
  writeFileSync(outPath, buf);
  console.log(`✅  Generated  public/icons/${name}  (${size}×${size})`);
}

console.log('\n🎨  All icons generated in public/icons/');
