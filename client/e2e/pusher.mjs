// 미는 뽑기 한 판 e2e (설계 2026-11-02 §4): 화면이 코인을 받고 P-1 앞에서 한 판 — 미는 판이 오가는 동안 '밀기'를 누르면
// 그 자리를 act로 보내고, 관찰자가 result와 pusher(밀기 뒤 선반)를 받는다. 화면이 그린 선반이 pusher 메시지와 같은지, 콘솔 오류 0
// 사용: `node client/e2e/pusher.mjs <port> <url> [P-1 …]`
const [port, base, ID = 'P-1'] = process.argv.slice(2);
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
await ev("(() => { const i = document.querySelector('input'); i.value = '밀기시험'; i.form.requestSubmit(); })()");
let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === '밀기시험')?.p; await sleep(100); }
if (!me) { console.log('FAIL pusher: no join'); process.exit(1); }
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
await walk(key, posOf, { x: LAYOUT.counters[0].window[0], z: LAYOUT.counters[0].window[1] }); await sleep(500);
await click('코인 받기'); await sleep(900);
await walk(key, posOf, frontOf(ID)); await sleep(500);
let ready = false;
for (let i = 0; i < 100 && !ready; i++) { const b = await buttons(); ready = b.some((x) => x.includes('한 판 하기')) && !(await ev("document.body.innerText.includes('준비 중')")); if (!ready) await sleep(300); }
console.log('buttons', JSON.stringify(await buttons()), 'ready', ready);
const n0 = seen.length;
console.log('press', await click('한 판 하기')); await sleep(1800);
console.log('push', await hold(1, 0.2));
let result, pusher; for (let i = 0; i < 300 && !(result && pusher); i++) { result = seen.slice(n0).find((m) => m.t === 'result' && m.m === ID && m.id === me.id); pusher = seen.slice(n0).find((m) => m.t === 'pusher' && m.m === ID); await sleep(50); }
await sleep(2500); // 밀기·떨어지기가 끝나 화면 선반이 바뀐 뒤
const shelf = await ev(`JSON.stringify(window.__toycrane.pusherShelf('${ID}'))`).then((s) => JSON.parse(s ?? 'null'));
const same = !!pusher && JSON.stringify(shelf) === JSON.stringify(pusher.items);
const wonSame = !!result && !!pusher && result.won.length === pusher.fell.length;
console.log('result', JSON.stringify(result && { won: result.won }), 'pusher', JSON.stringify(pusher && { x: pusher.x, drop: pusher.drop?.[0], fell: pusher.fell }), 'items', pusher?.items.length, 'screen same', same);
console.log('errors', errors.slice(0, 3).join(' | ') || '-');
const ok = ready && !!result && !!pusher && pusher.items.length > 0 && same && wonSame && errors.length === 0;
console.log(ok ? `PASS pusher ${ID}` : `FAIL pusher ${ID}`);
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); watcher.close(); process.exit(ok ? 0 : 1);
