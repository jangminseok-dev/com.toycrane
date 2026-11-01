// 물리 뽑기 한 판 e2e (Task 11): 화면(헤드리스 크롬)이 코인을 받고 C-6 앞에서 한 판을 한다 — 레버로 옮기고 잡기를 누르면
// 브라우저 물리가 한 바퀴를 돌고 done 보고를 보내며, 서버가 result·machine(13칸, y가 채워진 인형)을 돌려주는지 관찰자(웹소켓)가 본다.
// 사용: 헤드리스 크롬 --remote-debugging-port=<port>, `node client/e2e/play.mjs <port> <url> [out-prefix]`
const [port, base, out] = process.argv.slice(2);
const fs = await import('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAYOUT = JSON.parse(fs.readFileSync(new URL('../../shared/store_layout.json', import.meta.url), 'utf8'));
import { frontOf } from './nav.mjs';
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
// --- 관찰자 (메시지만) ---
const g = await post('/api/guest', { nickname: '관찰자' });
const a = await post('/api/admission', { guestId: g.guestId });
const watcher = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/store/${a.store}?guest=${g.guestId}`);
const seen = []; watcher.onmessage = (e) => seen.push(JSON.parse(e.data));
// --- 화면 ---
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') logs.push(JSON.stringify(m.params.exceptionDetails?.exception?.description ?? m.params).slice(0, 200)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
const shot = async (name) => { if (!out) return; const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}-${name}.png`, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
await send('Page.navigate', { url: base + '/' }); await sleep(2500);
await ev("(() => { const i = document.querySelector('input'); i.value = '물리시험'; i.form.requestSubmit(); })()");
let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === '물리시험')?.p; await sleep(100); }
if (!me) { console.log('FAIL play: no join'); process.exit(1); }
const posOfMe = () => { const mv = [...seen].reverse().find((m) => m.t === 'move' && m.id === me.id); return mv ? { x: mv.x, z: mv.z } : { x: me.x, z: me.z }; };
const key = async (code, secs) => { if (secs <= 0.02) return; await send('Input.dispatchKeyEvent', { type: 'keyDown', code }); await sleep(secs * 1000); await send('Input.dispatchKeyEvent', { type: 'keyUp', code }); await sleep(120); };
// 길찾기 (perf.mjs와 같은 격자)
const HALF = LAYOUT.hall.map_half, CELL = 0.25, N = Math.round((HALF * 2) / CELL) + 1;
const free = (x, z) => !LAYOUT.obstacles.some(([x0, z0, x1, z1]) => x > x0 - 0.35 && x < x1 + 0.35 && z > z0 - 0.35 && z < z1 + 0.35);
const cellOf = (v) => Math.max(0, Math.min(N - 1, Math.round((v + HALF) / CELL))), at = (i) => -HALF + i * CELL;
function route(from, to) {
  const start = cellOf(from.x) * N + cellOf(from.z), goal = cellOf(to.x) * N + cellOf(to.z);
  const prev = new Map([[start, -1]]), queue = [start];
  while (queue.length && !prev.has(goal)) { const c = queue.shift(), ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = ci + di, j = cj + dj, n = i * N + j; if (i < 0 || j < 0 || i >= N || j >= N || prev.has(n) || (!free(at(i), at(j)) && n !== goal)) continue; prev.set(n, c); queue.push(n); } }
  const cells = []; for (let c = goal; c !== -1 && c !== undefined; c = prev.get(c)) cells.unshift(c);
  return cells.filter((_, k) => k % 4 === 0 || k === cells.length - 1).map((c) => ({ x: at(Math.floor(c / N)), z: at(c % N) }));
}
const goTo = async (goal) => {
  let pos = posOfMe();
  for (const p of route(pos, goal)) { await key(p.x > pos.x ? 'KeyD' : 'KeyA', Math.abs(p.x - pos.x) / 3.2); await key(p.z > pos.z ? 'KeyS' : 'KeyW', Math.abs(p.z - pos.z) / 3.2); pos = p; }
  for (let k = 0; k < 8; k++) { await sleep(400); const q = posOfMe(), dx = goal.x - q.x, dz = goal.z - q.z; if (Math.hypot(dx, dz) < 0.25) break;
    if (Math.abs(dx) > 0.1) await key(dx > 0 ? 'KeyD' : 'KeyA', Math.min(1.5, Math.abs(dx) / 3.2)); if (Math.abs(dz) > 0.1) await key(dz > 0 ? 'KeyS' : 'KeyW', Math.min(1.5, Math.abs(dz) / 3.2)); }
};
const click = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none'); if (!b) return false; b.click(); return true; })()`);
const buttons = () => ev("[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length > 0 && x.style.display !== 'none').map((x) => x.textContent)");
const at2 = (part) => ev(`JSON.stringify(window.__toycrane.controlAt('${part}'))`).then((s) => JSON.parse(s ?? 'null'));
const drag = async (dx, dy, secs) => {
  const p = await at2('lever'); if (!p) return 'no lever';
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 5; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + dx * k / 5, y: p.y + dy * k / 5, button: 'left', buttons: 1 }); await sleep(30); }
  await sleep(secs * 1000);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + dx, y: p.y + dy, button: 'left', clickCount: 1 });
  return 'ok';
};
const tap = async (part) => { const p = await at2(part); if (!p) return 'no ' + part; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(80); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); return 'ok'; };

// 1) 교환소에서 코인 받기
const w0 = { x: LAYOUT.counters[0].window[0], z: LAYOUT.counters[0].window[1] };
await goTo(w0); await sleep(500);
await click('코인 받기'); await sleep(900);
// 2) C-6 앞으로 — 물리 준비('준비 중'이 사라질 때까지)
await goTo(frontOf('C-6')); // 큰 홀: 서쪽 광장 쪽 줄, 광장(+x)을 봄 await sleep(500);
let ready = false;
for (let i = 0; i < 100 && !ready; i++) { const b = await buttons(); ready = b.some((x) => x.includes('한 판 하기')) && !(await ev("document.body.innerText.includes('준비 중')")); if (!ready) await sleep(300); }
console.log('buttons', JSON.stringify(await buttons()), 'ready', ready);
const n0 = seen.length;
console.log('press', await click('한 판 하기')); await sleep(1500);
await shot('play');
console.log('lever', await drag(80, 0, 1.0), await drag(0, -60, 0.6));
console.log('drop', await tap('drop'));
await sleep(1500); await shot('cycle');
let result, machine; for (let i = 0; i < 400 && !(result && machine); i++) { result = seen.slice(n0).find((m) => m.t === 'result' && m.id === me.id); machine = seen.slice(n0).find((m) => m.t === 'machine' && m.m === 'C-6'); await sleep(50); }
await shot('after');
const settled = machine ? machine.dolls.filter((d) => d[2] !== null).length : -1;
console.log('result', JSON.stringify(result && { won: result.won }), 'machine dolls', machine?.dolls.length, 'settled', settled, 'fields', machine?.dolls[0]?.length);
console.log('errors', logs.slice(0, 3).join(' | ') || '-');
const ok = !!result && !!machine && machine.dolls.every((d) => d.length === 13) && settled === machine.dolls.length;
console.log(ok ? 'PASS play' : 'FAIL play');
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); watcher.close(); process.exit(ok ? 0 : 1);
