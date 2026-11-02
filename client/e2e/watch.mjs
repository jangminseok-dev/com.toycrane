// 구경꾼 중계 e2e (Task 12): 화면 A가 C-6에서 한 판을 하고 화면 B가 옆에서 구경한다 — B가 중계(pose)를 받아 그 기계를 따로 그리는지,
// 판이 끝난 뒤 B의 배치가 서버 machine과 같은지 본다. 미는 뽑기도 같은 길(계획 12). 피규어·고리 걸기(F-·R-)는 버튼 ①②로 하고
// 끝의 figure(상자 자리)와 B 화면 상자를 견준다. 사용: `node client/e2e/watch.mjs <port> <url> [C-6|P-1|R-2|F-3 …]`
const [port, base, ID = 'C-6'] = process.argv.slice(2);
const fs = await import('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAYOUT = JSON.parse(fs.readFileSync(new URL('../../shared/store_layout.json', import.meta.url), 'utf8'));
import { frontOf } from './nav.mjs';
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const g = await post('/api/guest', { nickname: '관찰자' });
const a = await post('/api/admission', { guestId: g.guestId });
const watcher = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/store/${a.store}?guest=${g.guestId}`);
const seen = []; watcher.onmessage = (e) => seen.push(JSON.parse(e.data));

// 탭 둘을 한 창에 두면 뒤에 있는 탭은 그리기 고리(rAF)가 멈춰 걷지도 물리도 안 돈다 — 창을 따로 연다
const browser = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);
await new Promise((r) => (browser.onopen = r));
let bid = 0; const bpending = new Map();
browser.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bpending.has(m.id)) { bpending.get(m.id)(m); bpending.delete(m.id); } };
const bsend = (method, params = {}) => new Promise((r) => { const i = ++bid; bpending.set(i, r); browser.send(JSON.stringify({ id: i, method, params })); });
async function page(nick) {
  const { result } = await bsend('Target.createTarget', { url: 'about:blank', newWindow: true, width: 1280, height: 800 });
  const t = { id: result.targetId, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${result.targetId}` };
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
  await send('Page.navigate', { url: base + '/' }); await sleep(2500);
  await ev(`(() => { const i = document.querySelector('input'); i.value = ${JSON.stringify(nick)}; i.form.requestSubmit(); })()`);
  let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === nick)?.p; await sleep(100); }
  const posOfMe = () => { const mv = [...seen].reverse().find((m) => m.t === 'move' && m.id === me.id); return mv ? { x: mv.x, z: mv.z } : { x: me.x, z: me.z }; };
  const key = async (code, secs) => { if (secs <= 0.02) return; await send('Input.dispatchKeyEvent', { type: 'keyDown', code }); await sleep(secs * 1000); await send('Input.dispatchKeyEvent', { type: 'keyUp', code }); await sleep(120); };
  const HALF = LAYOUT.hall.map_half, CELL = 0.25, N = Math.round((HALF * 2) / CELL) + 1;
  const free = (x, z) => !LAYOUT.obstacles.some(([x0, z0, x1, z1]) => x > x0 - 0.35 && x < x1 + 0.35 && z > z0 - 0.35 && z < z1 + 0.35);
  const cellOf = (v) => Math.max(0, Math.min(N - 1, Math.round((v + HALF) / CELL))), at = (i) => -HALF + i * CELL;
  const route = (from, to) => {
    const start = cellOf(from.x) * N + cellOf(from.z), goal = cellOf(to.x) * N + cellOf(to.z);
    const prev = new Map([[start, -1]]), queue = [start];
    while (queue.length && !prev.has(goal)) { const c = queue.shift(), ci = Math.floor(c / N), cj = c % N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = ci + di, j = cj + dj, n = i * N + j; if (i < 0 || j < 0 || i >= N || j >= N || prev.has(n) || (!free(at(i), at(j)) && n !== goal)) continue; prev.set(n, c); queue.push(n); } }
    const cells = []; for (let c = goal; c !== -1 && c !== undefined; c = prev.get(c)) cells.unshift(c);
    return cells.filter((_, k) => k % 4 === 0 || k === cells.length - 1).map((c) => ({ x: at(Math.floor(c / N)), z: at(c % N) }));
  };
  const goTo = async (goal) => {
    let pos = posOfMe();
    for (const p of route(pos, goal)) { await key(p.x > pos.x ? 'KeyD' : 'KeyA', Math.abs(p.x - pos.x) / 3.2); await key(p.z > pos.z ? 'KeyS' : 'KeyW', Math.abs(p.z - pos.z) / 3.2); pos = p; }
    for (let k = 0; k < 8; k++) { await sleep(400); const q = posOfMe(), dx = goal.x - q.x, dz = goal.z - q.z; if (Math.hypot(dx, dz) < 0.25) break;
      if (Math.abs(dx) > 0.1) await key(dx > 0 ? 'KeyD' : 'KeyA', Math.min(1.5, Math.abs(dx) / 3.2)); if (Math.abs(dz) > 0.1) await key(dz > 0 ? 'KeyS' : 'KeyW', Math.min(1.5, Math.abs(dz) / 3.2)); }
  };
  const click = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none'); if (!b) return false; b.click(); return true; })()`);
  const at2 = (part) => ev(`JSON.stringify(window.__toycrane.controlAt('${part}'))`).then((s) => JSON.parse(s ?? 'null'));
  const drag = async (dx, dy, secs) => { const p = await at2('lever'); if (!p) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); for (let k = 1; k <= 5; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + dx * k / 5, y: p.y + dy * k / 5, button: 'left', buttons: 1 }); await sleep(30); } await sleep(secs * 1000); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + dx, y: p.y + dy, button: 'left', clickCount: 1 }); return true; };
  const tap = async (part) => { const p = await at2(part); if (!p) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(80); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); return true; };
  const press = async (b, ms) => { const p = JSON.parse((await ev(`JSON.stringify(window.__toycrane.buttonAt(${b}))`)) ?? 'null'); if (!p) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(ms); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); return true; };
  return { me, ev, goTo, click, drag, tap, press, posOfMe, close: () => fetch(`http://127.0.0.1:${port}/json/close/${t.id}`) };
}

const A = await page('하는이'), B = await page('구경이');
const w0 = { x: LAYOUT.counters[0].window[0], z: LAYOUT.counters[0].window[1] };
await A.goTo(w0);
console.log('A at', JSON.stringify(A.posOfMe()), 'window', JSON.stringify(w0), 'buttons', JSON.stringify(await A.ev("[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length > 0 && x.style.display !== 'none').map((x) => x.textContent)")));
for (let i = 0; i < 30 && !(await A.click('코인 받기')); i++) await sleep(200); // 창구 버튼이 뜰 때까지
for (let i = 0; i < 30 && !(await A.ev("/🪙 [1-9]/.test(document.body.innerText)")); i++) await sleep(200); // 코인이 들어올 때까지
console.log('coins', await A.ev("(document.body.innerText.match(/🪙 \\d+/) || [])[0]"));
const BOX = /^[RF]-/.test(ID); // 상자 기계(고리 걸기·피규어)
const C6 = frontOf(ID), RY = [...LAYOUT.machines, ...LAYOUT.pushers, ...LAYOUT.rings, ...LAYOUT.figures].find((m) => m.id === ID).ry; // B는 A 바로 뒤(기계가 보는 쪽) 옆에서 구경
const isEnd = (m) => m.m === ID && m.t === (BOX ? 'figure' : 'machine');
const playOnce = async (dx) => { if (BOX) { await A.press(1, 1300); await sleep(600); await A.press(2, 1300); } else { await A.drag(dx, 0, 1.0); await A.drag(0, -60, 0.6); await A.tap('drop'); } };
await A.goTo(C6); await B.goTo({ x: C6.x + Math.sin(RY) * 1.0 + Math.cos(RY) * 0.4, z: C6.z + Math.cos(RY) * 1.0 - Math.sin(RY) * 0.4 }); await sleep(500);
for (let i = 0; i < 100 && (await A.ev("document.body.innerText.includes('준비 중')")); i++) await sleep(300);
const n0 = seen.length;
console.log('A at', JSON.stringify(A.posOfMe()), 'buttons', JSON.stringify(await A.ev("[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length > 0 && x.style.display !== 'none').map((x) => x.textContent)")), 'text', await A.ev("document.body.innerText.replace(/\\n/g, ' | ').slice(0, 120)"));
const vitals = (P) => P.ev("(async () => { const t0 = performance.now(); const raf = await Promise.race([new Promise((r) => requestAnimationFrame(() => r('raf ' + Math.round(performance.now() - t0) + 'ms'))), new Promise((r) => setTimeout(() => r('raf none in 1500ms'), 1500))]); return document.visibilityState + ' focus=' + document.hasFocus() + ' ' + raf; })()");
console.log('A vitals', await vitals(A), '| B vitals', await vitals(B));
console.log('press', await A.click('한 판 하기')); await sleep(1500);
console.log('B watching', await B.ev(`window.__toycrane.watching('${ID}')`));
await playOnce(80);
let machine; for (let i = 0; i < 800 && !machine; i++) { machine = seen.slice(n0).find(isEnd); await sleep(50); }
const poses = seen.slice(n0).filter((m) => m.t === 'pose' && m.m === ID).reduce((n, m) => n + m.f.length, 0); // 0.4초 묶음 속 자리 수(2026-11-02)
const matches = async () => {
  if (BOX) { const b = await B.ev(`JSON.stringify(window.__toycrane.${ID.startsWith('R-') ? 'hookBox' : 'figureBox'}('${ID}'))`).then(JSON.parse); return !!machine && !!b && Math.hypot(b[0] - machine.box[0], b[1] - machine.box[1], b[2] - machine.box[2]) < 0.01; }
  const b = await B.ev(`JSON.stringify(window.__toycrane.contents('${ID}'))`).then(JSON.parse); return !!machine && b.length === machine.dolls.length && b.every((d) => { const s = machine.dolls.find((x) => x[12] === d[12]); return s && Math.hypot(d[1] - s[1], (d[2] ?? 0) - (s[2] ?? 0), d[3] - s[3]) < 0.01; });
};
console.log('poses relayed', poses, 'machine', !!machine, 'B still watching', await B.ev(`window.__toycrane.watching('${ID}')`));
// 최종 리뷰 I5: A는 결과를 보자마자 "한 판 더" — B 화면에서는 앞 판의 결과 모션(몇 초)이 아직 도는 중이라 machine이 기다리고 있다.
// 그 machine이 들어올 때 두 번째 판의 구경을 끊으면 안 된다
const n1 = seen.length;
let again = false; for (let i = 0; i < 50 && !(again = await A.click('한 판 더')); i++) await sleep(200);
console.log('again', again); await sleep(1500);
const watching2 = await B.ev(`window.__toycrane.watching('${ID}')`);
await playOnce(-80);
machine = null; for (let i = 0; i < 800 && !machine; i++) { machine = seen.slice(n1).find(isEnd); await sleep(50); }
const watching3 = await B.ev(`window.__toycrane.watching('${ID}')`);
for (let i = 0; i < 120 && (await B.ev(`window.__toycrane.watching('${ID}')`)); i++) await sleep(100); // 결과 모션이 끝나야 machine이 들어가고 구경이 끝난다
const poses2 = seen.slice(n1).filter((m) => m.t === 'pose' && m.m === ID).reduce((n, m) => n + m.f.length, 0), close2 = await matches();
console.log('second play: B watching at start', watching2, 'at end', watching3, 'poses relayed', poses2, 'machine', !!machine, 'B matches server', close2);
// 상자 기계는 figure(상자 자리)가 판의 끝이라 받는 순간 구경이 끝난다(인형 기계처럼 결과 모션까지 잇지 않음) — watching3은 인형·미는 뽑기만
const ok = poses >= 20 && again && watching2 && (BOX || watching3) && poses2 >= 20 && close2;
console.log(ok ? 'PASS watch' : 'FAIL watch');
await A.close(); await B.close(); watcher.close(); browser.close(); process.exit(ok ? 0 : 1);
