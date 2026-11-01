// 미는 뽑기 한 판 e2e (설계 2026-11-02 ring-hook §4, 계획 12 Task 10): 화면(헤드리스 크롬)이 코인을 받고 P-1 앞에서 한 판 —
// 집게는 턱 위에서 시작하고, 레버로 칸의 미니 인형 위로 옮겨 잡기를 누르면 브라우저 물리가 집어 턱 위에 놓고 판이 다 밀 때까지 기다린 뒤
// done을 보낸다. 관찰자(웹소켓)는 겨누는 동안의 중계(pose), result, machine(뽑힌 만큼 줄어든 미니 인형, 모두 앉은 자리)을 본다.
// 화면이 아는 칸 = 서버 machine, 콘솔 오류 0. 사용: `node client/e2e/pusher.mjs <port> <url> [out-prefix] [P-1]`
import fs from 'node:fs';
import { LAYOUT, frontOf, walk } from './nav.mjs';
import { leverTo, pileTarget, tapDrop } from './lever.mjs';
const [port, base, out, ID = 'P-1'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PUSHER = JSON.parse(fs.readFileSync(new URL('../../shared/pusher.json', import.meta.url), 'utf8'));
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
const shot = async (name) => { if (!out) return; const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}-${name}.png`, Buffer.from(r.result.data, 'base64')); };
const io = { send, ev, sleep };
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
await send('Page.navigate', { url: base + '/' }); await sleep(2500);
await ev("(() => { const i = document.querySelector('input'); i.value = '미는시험'; i.form.requestSubmit(); })()");
let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === '미는시험')?.p; await sleep(100); }
if (!me) { console.log('FAIL pusher: no join'); process.exit(1); }
const posOf = () => { const mv = [...seen].reverse().find((m) => m.t === 'move' && m.id === me.id); return mv ? { x: mv.x, z: mv.z } : { x: me.x, z: me.z }; };
const key = async (code, secs) => { if (secs <= 0.02) return; await send('Input.dispatchKeyEvent', { type: 'keyDown', code }); await sleep(secs * 1000); await send('Input.dispatchKeyEvent', { type: 'keyUp', code }); await sleep(120); };
const click = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none'); if (!b) return false; b.click(); return true; })()`);
const buttons = () => ev("[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length > 0 && x.style.display !== 'none').map((x) => x.textContent)");
const contents = async () => JSON.parse(await ev(`JSON.stringify(window.__toycrane.contents('${ID}'))`));

// 1) 코인 → P-1 앞, 물리 준비
await walk(key, posOf, { x: LAYOUT.counters[0].window[0], z: LAYOUT.counters[0].window[1] }); await sleep(500);
await click('코인 받기'); await sleep(900);
await walk(key, posOf, frontOf(ID)); await sleep(500);
let ready = false;
for (let i = 0; i < 100 && !ready; i++) { const b = await buttons(); ready = b.some((x) => x.includes('한 판 하기')) && !(await ev("document.body.innerText.includes('준비 중')")); if (!ready) await sleep(300); }
const before = await contents();
console.log('ready', ready, 'dolls', before.length, 'kinds', new Set(before.map((d) => d[0])).size, 'settled', before.filter((d) => d[2] !== null).length);
// 2) 한 판: 집게는 턱 위에서 시작 → 칸의 위가 열린 인형 위로 → 잡기
const n0 = seen.length;
console.log('press', await click('한 판 하기')); await sleep(1500);
const start = JSON.parse(await ev('JSON.stringify(window.__toycrane.claw())'));
await shot('play');
const goal = pileTarget(await contents(), PUSHER.ledge.x1);
console.log('start', JSON.stringify(start), 'goal', JSON.stringify(goal), 'lever', await leverTo(io, goal));
const aimPoses = seen.slice(n0).filter((m) => m.t === 'pose' && m.m === ID).length; // 겨누는 동안의 중계
console.log('drop', await tapDrop(io));
await sleep(6000); await shot('cycle');
let result, machine; for (let i = 0; i < 800 && !(result && machine); i++) { result = seen.slice(n0).find((m) => m.t === 'result' && m.id === me.id && m.m === ID); machine = seen.slice(n0).find((m) => m.t === 'machine' && m.m === ID); await sleep(50); }
await sleep(1500); await shot('after');
// 3) 확인: 줄어든 만큼 = 당첨, 모두 앉음, 화면이 아는 칸 = 서버
const screen = await contents();
const same = !!machine && screen.length === machine.dolls.length && machine.dolls.every((d, k) => d[12] === screen[k][12] && Math.abs(d[1] - screen[k][1]) < 1e-6 && d[2] === screen[k][2]);
const startOk = !!start && Math.abs(start.x - PUSHER.drop[0]) < 1e-6 && Math.abs(start.z - PUSHER.drop[1]) < 1e-6;
console.log('result', JSON.stringify(result && result.won), 'machine', machine?.dolls.length, 'settled', machine?.dolls.filter((d) => d[2] !== null).length, 'aim poses', aimPoses, 'screen=server', same, 'start on ledge', startOk);
console.log('errors', errors.slice(0, 3).join(' | ') || '-');
const ok = ready && startOk && !!result && !!machine && machine.dolls.length === before.length - result.won.length && machine.dolls.every((d) => d[2] !== null) && same && aimPoses > 0 && errors.length === 0;
console.log(ok ? 'PASS pusher' : 'FAIL pusher');
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); watcher.close(); process.exit(ok ? 0 : 1);
