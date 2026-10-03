/** Generate flat PWA identity assets. These are app icons, not button pictograms. */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(directory, { recursive: true });

function icon(size, badge = false) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.fillStyle = '#FFF8ED';
  context.fillRect(0, 0, size, size);
  const inset = size * .13;
  context.fillStyle = '#EA6113';
  context.fillRect(inset, inset, size - inset * 2, size - inset * 2);
  context.fillStyle = '#261F19';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${Math.round(size * (badge ? .35 : .27))}px Georgia`;
  context.fillText(badge ? 'S' : 'S / M', size / 2, size / 2 - size * .025);
  context.fillRect(size * .27, size * .72, size * .46, Math.max(2, size * .018));
  return canvas.toBuffer('image/png');
}

for (const [name, size, badge] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
  ['badge-72.png', 72, true],
]) writeFileSync(join(directory, name), icon(size, badge));
