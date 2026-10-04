import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = +process.env.CDP_PORT || 9337;
const URL = process.env.CDP_URL || 'file:///E:/PROYECTOS/arcano/public/index.html?debug';
const dir = mkdtempSync(join(process.env.TEMP || '.', 'arcano-cdp-'));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch { } await sleep(200); }
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400); return r.result.result.value; };
const W = +process.argv[2] || 360, H = +process.argv[3] || 640;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await send('Page.enable');
await send('Runtime.enable');
const logs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 500)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + JSON.stringify(m.params.args).slice(0, 300)); });
await send('Page.navigate', { url: URL });
await sleep(1500);
const tap = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
globalThis.ctx = { send, ev, sleep, tap, logs };
const script = (await import('node:fs')).readFileSync(process.argv[4], 'utf8');
const fn = new Function('ctx', `return (async () => { const {send, ev, sleep, tap, logs} = ctx; ${script} })()`);
try { await fn(globalThis.ctx); } catch (e) { console.log('SCRIPT ERR', e); }
if (logs.length) console.log('CONSOLE ERRORS:\n' + logs.join('\n'));
ws.close(); proc.kill();
process.exit(0);
