// 피규어 뽑기 한 판 e2e (9단계 Task 12): 화면(헤드리스 크롬)이 코인을 받고 F-1 앞에서 한 판 — 조작대 버튼 ①을 0.6초 눌렀다 떼면
// 옆 대각선 시점으로 넘어가고, ②를 0.5초 눌렀다 떼면 집게가 내려가 물리 한 바퀴를 돌고 done(상자 uid 0)을 보낸다.
// 관찰자(웹소켓)가 result와 figure(상자 자리만, 경품 없음)를 받고, 그 상자 자리가 화면이 아는 상자와 1cm 안에서 같은지 본다.
// 사용: 헤드리스 크롬 --remote-debugging-port=<port>, `node client/e2e/figure.mjs <port> <url> [F-1|F-8 …]`
const [port, base, ID = 'F-1'] = process.argv.slice(2); // 셋째 인자: 기계(F-1 긴 상자, F-8 정사각형 — 설계 §8)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { LAYOUT, frontOf, walk } from './nav.mjs';
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const g = await post('/api/guest', { nickname: '관찰자' }), a = await post('/api/admission', { guestId: g.guestId });
const watcher = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/store/${a.store}?guest=${g.guestId}`);
const seen = []; watcher.onmessage = (e) => seen.push(JSON.parse(e.data));
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
await ev("(() => { const i = document.querySelector('input'); i.value = '피규어시험'; i.form.requestSubmit(); })()");
let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === '피규어시험')?.p; await sleep(100); }
if (!me) { console.log('FAIL figure: no join'); process.exit(1); }
const posOf = () => { const mv = [...seen].reverse().find((m) => m.t === 'move' && m.id === me.id); return mv ? { x: mv.x, z: mv.z } : { x: me.x, z: me.z }; };
const key = async (code, secs) => { if (secs <= 0.02) return; await send('Input.dispatchKeyEvent', { type: 'keyDown', code }); await sleep(secs * 1000); await send('Input.dispatchKeyEvent', { type: 'keyUp', code }); await sleep(120); };
const click = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none'); if (!b) return false; b.click(); return true; })()`);
const buttons = () => ev("[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length > 0 && x.style.display !== 'none').map((x) => x.textContent)");
const hold = async (b, secs) => {
  const p = await ev(`JSON.stringify(window.__toycrane.buttonAt(${b}))`).then((s) => JSON.parse(s ?? 'null'));
  if (!p) return `no button ${b}`;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await sleep(secs * 1000);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  return 'ok';
};

// 1) 코인 받기 → 기계 앞
await walk(key, posOf, { x: LAYOUT.counters[1].window[0], z: LAYOUT.counters[1].window[1] }); await sleep(500);
await click('코인 받기'); await sleep(900);
await walk(key, posOf, frontOf(ID)); await sleep(500);
let ready = false;
for (let i = 0; i < 100 && !ready; i++) { const b = await buttons(); ready = b.some((x) => x.includes('한 판 하기')) && !(await ev("document.body.innerText.includes('준비 중')")); if (!ready) await sleep(300); }
console.log('buttons', JSON.stringify(await buttons()), 'ready', ready);
const n0 = seen.length;
console.log('press', await click('한 판 하기')); await sleep(1500);
// 2) ① 0.6초 → 옆 시점 → ② 0.5초
console.log('one', await hold(1, 0.6)); await sleep(900);
const side = await ev('window.__toycrane.figureSide()');
console.log('side', side);
console.log('two', await hold(2, 0.5));
let result, fig; for (let i = 0; i < 600 && !(result && fig); i++) { result = seen.slice(n0).find((m) => m.t === 'result' && m.m === ID && m.id === me.id); fig = seen.slice(n0).find((m) => m.t === 'figure' && m.m === ID); await sleep(50); }
await sleep(800);
const box = await ev(`JSON.stringify(window.__toycrane.figureBox('${ID}'))`).then((s) => JSON.parse(s ?? 'null'));
const figs = seen.filter((m) => m.t === 'figure'), clean = figs.every((m) => Object.keys(m).sort().join() === 'box,m,nudged,t' && m.box.every((v) => typeof v === 'number'));
const welcomeFigs = seen.find((m) => m.t === 'welcome')?.figures ?? {};
const welcomeClean = Object.values(welcomeFigs).every((b) => Array.isArray(b) && b.length === 7 && b.every((v) => typeof v === 'number'));
const close = fig && box && Math.hypot(fig.box[0] - box[0], fig.box[1] - box[1], fig.box[2] - box[2]) < 0.01;
console.log('result', JSON.stringify(result && { won: result.won }), 'figure', JSON.stringify(fig?.box), 'screen', JSON.stringify(box), 'clean', clean, welcomeClean);
console.log('errors', errors.slice(0, 3).join(' | ') || '-');
const ok = ready && side > 0.9 && !!result && !!fig && close && clean && welcomeClean && errors.length === 0;
console.log(ok ? `PASS figure ${ID}` : `FAIL figure ${ID}`);
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); watcher.close(); process.exit(ok ? 0 : 1);
