// Renders public/favicon.svg into the PNG icons the PWA manifest and iOS need.
// Usage: PLAYWRIGHT_BROWSERS_PATH=0 node scripts/generate-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, square: true },
  // Maskable icons need their content inside the central 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12, square: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, pad, square } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  const body = square
    ? svg.replace('rx="14"', 'rx="0"')
    : svg;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${square ? '#2457D6' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
      <div style="width:${inner}px;height:${inner}px">${body.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
    </body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: !square });
}
await browser.close();
console.log('icons written');
