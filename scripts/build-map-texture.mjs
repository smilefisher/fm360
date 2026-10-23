/**
 * Build the equirectangular map texture used by the globe shader.
 *
 * The texture encodes three masks in RGB:
 *   R = land fill
 *   G = country borders / coastlines
 *   B = graticule (30° grid)
 *
 * It is generated from Natural Earth 110m country polygons (world-atlas),
 * rendered as SVG and rasterized by headless Chrome. Run: pnpm map
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { feature } from 'topojson-client';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPO = path.join(ROOT, 'scripts', 'assets', 'countries-110m.json');
const SVG_OUT = path.join(ROOT, 'scripts', 'assets', 'world-map.svg');
const PNG_OUT = path.join(ROOT, 'public', 'world-map.png');
const HTML_OUT = path.join(ROOT, 'scripts', 'assets', 'world-map.html');
const W = 2048;
const H = 1024;

const topo = JSON.parse(await readFile(TOPO, 'utf8'));
const countries = feature(topo, topo.objects.countries);

function project([lng, lat]) {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
}

function ringPath(ring) {
  // Split rings at the antimeridian. Otherwise a polygon such as Russia or
  // Fiji gets a long straight border across the whole map.
  const parts = [];
  let current = [];
  let prevLng = null;
  for (const point of ring) {
    const lng = point[0];
    if (prevLng != null && Math.abs(lng - prevLng) > 180 && current.length) {
      parts.push(current);
      current = [];
    }
    current.push(point);
    prevLng = lng;
  }
  if (current.length) parts.push(current);

  return parts
    .map(
      (part) =>
        part
          .map((point, index) => {
            const [x, y] = project(point);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join('') + 'Z',
    )
    .join(' ');
}

function geometryPath(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return geometry.coordinates.map(ringPath).join(' ');
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat().map(ringPath).join(' ');
  }
  return '';
}

const paths = [];
for (const item of countries.features) {
  const d = geometryPath(item.geometry);
  if (!d) continue;
  paths.push(
    `<path d="${d}" fill="#ff0000" stroke="#00ff00" stroke-width="1.15" stroke-linejoin="round" fill-rule="evenodd"/>`,
  );
}

const grid = [];
for (let lng = -180; lng <= 180; lng += 30) {
  const x = ((lng + 180) / 360) * W;
  grid.push(`<path d="M${x.toFixed(2)} 0V${H}" stroke="#0000ff" stroke-width="0.7"/>`);
}
for (let lat = -60; lat <= 60; lat += 30) {
  const y = ((90 - lat) / 180) * H;
  grid.push(`<path d="M0 ${y.toFixed(2)}H${W}" stroke="#0000ff" stroke-width="0.7"/>`);
}
// Emphasize the equator and prime meridian slightly.
grid.push(`<path d="M0 ${H / 2}H${W}" stroke="#0000ff" stroke-width="1.1"/>`);
grid.push(`<path d="M${W / 2} 0V${H}" stroke="#0000ff" stroke-width="1.1"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#000000"/>
  <g>${paths.join('\n')}</g>
  <g>${grid.join('\n')}</g>
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body { margin:0; padding:0; background:#000; overflow:hidden; }
  svg { display:block; width:${W}px; height:${H}px; }
</style></head><body>${svg}</body></html>`;

await mkdir(path.dirname(SVG_OUT), { recursive: true });
await writeFile(SVG_OUT, svg);
await writeFile(HTML_OUT, html);

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
const port = 9333;
const profile = '/tmp/fm360-map-chrome';
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`,
    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function waitForChrome() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error('Chrome did not start');
}

await waitForChrome();
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (!msg.id) return;
  const item = pending.get(msg.id);
  if (!item) return;
  pending.delete(msg.id);
  msg.error ? item.reject(new Error(JSON.stringify(msg.error))) : item.resolve(msg.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W,
  height: H,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: pathToFileURL(HTML_OUT).href });
await new Promise((resolve) => setTimeout(resolve, 900));
const shot = await send('Page.captureScreenshot', {
  format: 'png',
  clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
  captureBeyondViewport: false,
});
await writeFile(PNG_OUT, Buffer.from(shot.data, 'base64'));
ws.close();
chrome.kill('SIGTERM');
console.log(`wrote ${PNG_OUT} (${W}x${H})`);
