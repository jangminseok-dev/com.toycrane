// 가방 보기 e2e (설계 2026-11-02 §5): 새 게스트가 가방 칸을 누르면 '아직 뽑은 게 없어요' → 코인 15개를 받아 미는 뽑기 P-1에서
// 레버로 칸의 위가 열린 미니 인형 위에 가 잡기(턱 위에 쌓여 밀려 떨어질 때까지, 15판마다 코인을 다시 받아 45판까지) → 가방 칸을 누르면 '미는 뽑기' 구역에 뽑은 인형 이름이 보인다.
// 가방 API(GET /api/bag/{guestId})도 같은 것을 준다. 콘솔 오류 0
// 사용: `node client/e2e/bag.mjs <port> <url> [P-1 …]`
import { readFileSync } from 'node:fs';
const [port, base, ID = 'P-1'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { LAYOUT, frontOf, walk } from './nav.mjs';
import { leverTo, pileTarget, tapDrop } from './lever.mjs';
const PUSHER = JSON.parse(readFileSync(new URL('../../shared/pusher.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../../shared/catalog.json', import.meta.url)));
const dollName = (kind, color, rare) => {
  const d = catalog.dolls.find((x) => x.id === kind);
  const prefix = rare === catalog.gold.id ? catalog.gold.name : rare ? catalog.effects.find((e) => e.id === rare)?.name : d.palette[color]?.name;
  return prefix ? `${prefix} ${d.name}` : d.name;
};
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
await ev("(() => { const i = document.querySelector('input'); i.value = '가방시험'; i.form.requestSubmit(); })()");
let me; for (let i = 0; i < 80 && !me; i++) { me = seen.find((m) => m.t === 'join' && m.p.nick === '가방시험')?.p; await sleep(100); }
if (!me) { console.log('FAIL bag: no join'); process.exit(1); }
const guestId = await ev("localStorage.getItem('toycrane.guestId')");
const posOf = () => { const mv = [...seen].reverse().find((m) => m.t === 'move' && m.id === me.id); return mv ? { x: mv.x, z: mv.z } : { x: me.x, z: me.z }; };
const key = async (code, secs) => { if (secs <= 0.02) return; await send('Input.dispatchKeyEvent', { type: 'keyDown', code }); await sleep(secs * 1000); await send('Input.dispatchKeyEvent', { type: 'keyUp', code }); await sleep(120); };
const click = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none'); if (!b) return false; b.click(); return true; })()`);
const buttons = () => ev("[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length > 0 && x.style.display !== 'none').map((x) => x.textContent)");
const openBag = async () => { await ev("document.querySelector('.hud-bag').click()"); for (let i = 0; i < 40; i++) { const s = await ev("document.querySelector('.bag-list')?.innerText ?? null"); if (s !== null) return s; await sleep(100); } return null; };
const closeBag = () => click('닫기');

// 1) 빈 가방 — 가방 칸은 화면이 welcome을 받아야 생긴다(관찰자의 join이 먼저 올 수 있음)
for (let i = 0; i < 100 && !(await ev("!!document.querySelector('.hud-bag')")); i++) await sleep(100);
const empty = await openBag(); await closeBag();
console.log('empty bag', JSON.stringify(empty));
// 2) 코인 15개 → 기계 앞 (코인 받기는 15개까지라 15판마다 다시 채운다)
const fill = async (seated) => {
  if (seated) { for (let i = 0; i < 100 && !(await click('그만하기')); i++) await sleep(300); await sleep(800); } // 기계에서 일어나야 걷는다
  await walk(key, posOf, { x: LAYOUT.counters[0].window[0], z: LAYOUT.counters[0].window[1] }); await sleep(500);
  for (let k = 0; k < 3; k++) { await click('코인 받기'); await sleep(2600); }
  await walk(key, posOf, frontOf(ID)); await sleep(500);
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) { const b = await buttons(); ready = b.some((x) => x.includes('한 판 하기')) && !(await ev("document.body.innerText.includes('준비 중')")); if (!ready) await sleep(300); }
};
await fill();
// 3) 뽑힐 때까지: 칸의 위가 열린 미니 인형 위로 레버 → 잡기 (집게가 턱 위에 놓고, 판이 밀어 앞 끝으로 떨어지면 당첨)
const io = { send, ev, sleep };
let won = null, plays = 0;
for (; plays < 45 && !won; plays++) {
  if (plays > 0 && plays % 15 === 0) await fill(true);
  const n0 = seen.length;
  let pressed = false;
  for (let i = 0; i < 40 && !pressed; i++) { pressed = (await click('한 판 더')) || (await click('한 판 하기')); if (!pressed) await sleep(250); }
  if (!pressed) { console.log('no play button', JSON.stringify(await buttons())); break; }
  await sleep(1200);
  const goal = pileTarget(JSON.parse(await ev(`JSON.stringify(window.__toycrane.contents('${ID}'))`)), PUSHER.ledge.x1);
  await leverTo(io, goal); await tapDrop(io);
  let result; for (let i = 0; i < 800 && !result; i++) { result = seen.slice(n0).find((m) => m.t === 'result' && m.m === ID && m.id === me.id); await sleep(50); }
  if (result?.won.length) won = result.won[0];
  await sleep(3500); // 당첨 카드·판 사이 버튼이 뜰 때까지
  await ev("document.querySelector('.win-card')?.click?.()");
}
console.log('plays', plays, 'won', JSON.stringify(won));
// 4) 가방 보기
await ev("document.querySelector('.win-card')?.click?.()"); await sleep(300);
const sheet = await openBag();
const api = await fetch(`${base}/api/bag/${guestId}`).then((r) => r.json());
const name = won && dollName(won[0], won[1], won[2]);
console.log('sheet', JSON.stringify(sheet?.slice(0, 120)), 'api', JSON.stringify(api.items.slice(0, 2)));
console.log('errors', errors.slice(0, 3).join(' | ') || '-');
const ok = empty?.includes('아직 뽑은 게 없어요') && !!won && !!sheet?.includes('미는 뽑기') && sheet.includes(name) && api.items.some((i) => i.zone === 'pusher' && i.doll === won[0]) && errors.length === 0;
console.log(ok ? 'PASS bag' : 'FAIL bag');
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); watcher.close(); process.exit(ok ? 0 : 1);
