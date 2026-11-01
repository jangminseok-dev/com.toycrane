// 피규어 다섯 판 이어 하기 e2e (최종 리뷰 I2): 인형 기계처럼 첫 판에는 그만하기가 없고, 둘째 판부터 보이며 누르면 판 도중에도 바로 일어나 기계가 풀린다
// 사용: 헤드리스 크롬 --remote-debugging-port=<port>, `node client/e2e/figure-run.mjs <port> <url>`
const [port, base] = process.argv.slice(2);
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
await ev("(() => { const i = document.querySelector('input'); i.value = '피규어이어'; i.form.requestSubmit(); })()");
let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === '피규어이어')?.p; await sleep(100); }
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

// 1) 코인 받기 → F-3 앞
await walk(key, posOf, { x: LAYOUT.counters[1].window[0], z: LAYOUT.counters[1].window[1] }); await sleep(500);
await click('코인 받기'); await sleep(900);
await walk(key, posOf, frontOf('F-3')); await sleep(500);
let ready = false;
for (let i = 0; i < 100 && !ready; i++) { const b = await buttons(); ready = b.some((x) => x.includes('다섯 판 하기')) && !(await ev("document.body.innerText.includes('준비 중')")); if (!ready) await sleep(300); }
const visible = (text) => ev(`[...document.querySelectorAll('button')].some((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none')`);
const badge = () => ev("(document.body.innerText.match(/\\d\\/5판/) || [''])[0]");
console.log('ready', ready, 'press', await click('다섯 판 하기')); await sleep(1500);
const stop1 = await visible('그만하기');
console.log('play 1 badge', await badge(), 'stop visible', stop1); // 첫 판에는 없다
console.log('one', await hold(1, 0.2), 'two', await hold(2, 0.2));
for (let i = 0; i < 300 && (await badge()) !== '2/5판'; i++) await sleep(100); // 결과 뒤 두 번째 판이 저절로 시작된다
const n1 = seen.length; await sleep(1500);
const stop2 = await visible('그만하기');
console.log('play 2 badge', await badge(), 'stop visible', stop2);
console.log('quit', await click('그만하기')); // 버튼 단계 도중
let freed = false; for (let i = 0; i < 60 && !(freed = seen.slice(n1).some((m) => m.t === 'free' && m.m === 'F-3')); i++) await sleep(100);
await sleep(1000);
const playOne = await visible('한 판 하기'), badge2 = await badge(), still = await ev('JSON.stringify(window.__toycrane.buttonAt(1))');
console.log('after quit: freed', freed, 'play-one visible', playOne, 'badge', badge2, 'buttons on machine', still, 'errors', errors.slice(0, 3).join(' | ') || '-');
const ok = ready && !stop1 && stop2 && freed && playOne && badge2 === '' && still === 'null' && errors.length === 0;
console.log(ok ? 'PASS figure-run' : 'FAIL figure-run');
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); watcher.close(); process.exit(ok ? 0 : 1);
