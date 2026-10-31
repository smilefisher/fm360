/**
 * Build the 1200×630 Open Graph image.
 * Uses the current English globe screenshot as a product backdrop and overlays
 * the bilingual brand lockup. Requires Chrome (same as the map texture script).
 *
 * Run: pnpm og
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const BG = path.join(ROOT, 'screenshots', 'globe-en.png');
const OUT = path.join(ROOT, 'public', 'og.png');
const HTML_OUT = '/tmp/fm360-og.html';
const W = 1200;
const H = 630;

if (!existsSync(BG)) throw new Error(`Missing screenshot: ${BG}`);
const bg = (await readFile(BG)).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #050b14; }
  .bg {
    position: absolute; inset: 0;
    background: url(data:image/png;base64,${bg}) center 32% / cover no-repeat;
    opacity: 0.92;
  }
  .veil {
    position: absolute; inset: 0;
    background:
      linear-gradient(90deg, rgba(3,8,14,0.99) 0%, rgba(3,8,14,0.94) 34%, rgba(3,8,14,0.46) 66%, rgba(3,8,14,0.22) 100%),
      linear-gradient(180deg, rgba(3,8,14,0.72) 0%, rgba(3,8,14,0.14) 26%, rgba(3,8,14,0.52) 56%, rgba(3,8,14,0.97) 80%, #03080e 100%);
  }
  .content {
    position: absolute; inset: 0;
    padding: 54px 64px 44px;
    display: flex; flex-direction: column; justify-content: space-between;
    color: #f4efe6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  }
  .brand { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 650; letter-spacing: -0.03em; }
  .brand svg { width: 32px; height: 32px; }
  .kicker { margin-top: 8px; font: 10px/1.4 'SFMono-Regular', Menlo, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #94a8b4; }
  .mid { max-width: 610px; }
  h1 {
    margin: 0;
    font-family: 'Songti SC', 'Iowan Old Style', Georgia, serif;
    font-size: 82px; font-weight: 400; line-height: 0.96; letter-spacing: -0.035em;
  }
  h1 span { color: #f5b544; font-style: italic; }
  .en { margin: 14px 0 0; font-family: 'Iowan Old Style', Georgia, serif; font-size: 30px; font-style: italic; color: #f5b544; }
  .lede { margin: 16px 0 0; max-width: 510px; color: #94a8b4; font-size: 14px; line-height: 1.65; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; font: 10px/1.5 'SFMono-Regular', Menlo, monospace; color: #94a8b4; letter-spacing: 0.04em; }
  .foot b { color: #f4efe6; font-weight: 500; }
</style></head><body>
  <div class="bg"></div><div class="veil"></div>
  <div class="content">
    <div>
      <div class="brand">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="2.5"/>
          <path d="M32 14v5M32 45v5M14 32h5M45 32h5" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round"/>
          <path d="M32 32 42 22" stroke="#f5b544" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="32" cy="32" r="2.8" fill="#f5b544"/>
          <circle cx="48" cy="16" r="3.2" fill="#f36b45"/>
        </svg>
        fm360
      </div>
      <div class="kicker">World Radio Atlas · 世界电台地图</div>
    </div>
    <div class="mid">
      <h1>随机一站，<br/><span>听见世界。</span></h1>
      <p class="en">Listen somewhere new.</p>
      <p class="lede">按晨昏线、流派、国家和地区漫游，随机收听世界各地的电台直播。No account. No ads. Audio streams directly from each station.</p>
    </div>
    <div class="foot">
      <span><b>fm360.toolora.stream</b> · 11,854 stations · 194 countries</span>
      <span>Directory by Radio Browser</span>
    </div>
  </div>
</body></html>`;

await writeFile(HTML_OUT, html);

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
const port = 9334;
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=/tmp/fm360-og-chrome',
    `--window-size=${W},${H}`,
    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

for (let i = 0; i < 100; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (res.ok) break;
  } catch {
    // not ready
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
}

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
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(HTML_OUT).href });
await new Promise((resolve) => setTimeout(resolve, 800));
const shot = await send('Page.captureScreenshot', {
  format: 'png',
  clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
  captureBeyondViewport: false,
});
await writeFile(OUT, Buffer.from(shot.data, 'base64'));
ws.close();
chrome.kill('SIGTERM');
console.log(`wrote ${OUT} (${W}x${H})`);
