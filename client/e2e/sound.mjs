// 배경음·소리 버튼 e2e (설계 2026-11-02 §7): 들어와서 화면을 한 번 누르면 배경음이 걸리고(마디를 거는 중), 🔊를 누르면 🔇·멈춤,
// 새로 고침해도 꺼진 채(이 기기에 기억). 다시 누르면 켜진다. 콘솔 오류 0
// 사용: `node client/e2e/sound.mjs <port> <url>`
const [port, base] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails?.exception?.description ?? m.params).slice(0, 200)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((x) => x.value ?? x.description).join(' ').slice(0, 200)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
await send('Page.navigate', { url: base + '/' }); await sleep(2500);
await ev("(() => { const i = document.querySelector('input'); i.value = '소리시험'; i.form.requestSubmit(); })()");
const state = () => ev('JSON.stringify(window.__toycrane?.music?.() ?? null)').then((s) => JSON.parse(s ?? 'null'));
const tap = async () => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 500, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 500, button: 'left', clickCount: 1 }); };
const button = () => ev("document.querySelector('.hud-sound')?.textContent ?? null");
let b = null; for (let i = 0; i < 60 && !b; i++) { b = await button(); await sleep(100); }
await tap(); await sleep(400);
const on = await state();
await ev("document.querySelector('.hud-sound').click()"); await sleep(200);
const off = await state(), offIcon = await button();
await send('Page.reload'); await sleep(3000);
let kept = null; for (let i = 0; i < 60 && !kept; i++) { kept = await button(); await sleep(100); }
await tap(); await sleep(400);
const afterReload = await state();
await ev("document.querySelector('.hud-sound').click()"); await sleep(300);
const back = await state();
console.log('first', b, JSON.stringify(on), 'muted', offIcon, JSON.stringify(off), 'reload', kept, JSON.stringify(afterReload), 'on again', JSON.stringify(back));
console.log('errors', errors.slice(0, 3).join(' | ') || '-');
const ok = b === '🔊' && on?.playing && !on.muted && offIcon === '🔇' && off?.muted && !off.playing && kept === '🔇' && afterReload?.muted && !afterReload.playing && back?.playing && !back.muted && errors.length === 0;
console.log(ok ? 'PASS sound' : 'FAIL sound');
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); process.exit(ok ? 0 : 1);
