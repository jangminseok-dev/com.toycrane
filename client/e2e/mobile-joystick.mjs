// 휴대폰 조이스틱 회귀 검사: 매장에 들어가면 왼쪽 아래에 조이스틱이 처음부터 보이고,
// 그걸 끌면 같은 매장 관찰자에게 걷는 move(방향 길이 1)와 멈춤이 가고, 놓으면 제자리로 돌아와 계속 보이는지 본다.
// (숨어 있던 조이스틱을 실제 휴대폰에서 못 찾음 — 2026-10-31 배포 확인)
// 사용: 헤드리스 크롬을 --remote-debugging-port=<port>로 띄운 뒤 `node client/e2e/mobile-joystick.mjs <port> <base-url>`
const [port, base] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

const g = await post('/api/guest', { nickname: '관찰자' });
const a = await post('/api/admission', { guestId: g.guestId });
const watcher = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/store/${a.store}?guest=${g.guestId}`);
const seen = [];
watcher.onmessage = (e) => seen.push(JSON.parse(e.data));

const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
// 조이스틱 원이 화면에 보이는지와 그 중심
const stick = () => evaluate(`(() => {
  const el = document.getElementById('joystick');
  if (!el) return { found: false };
  const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  const visible = s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0;
  return { found: true, visible, x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
})()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
// 앞선 실행이 저장한 게스트가 있으면 닉네임 칸 대신 "어서 오세요"가 떠서, 처음 온 사람처럼 저장소를 비운다
await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
await send('Page.navigate', { url: base + '/' });
await sleep(2500);
await evaluate("(() => { const i = document.querySelector('input'); i.value = '폰 조이스틱'; i.form.requestSubmit(); })()");
// 들어갈 때까지(관찰자가 join을 볼 때까지, 다른 e2e처럼 최대 10초) — 라이브는 손님 만들기·입장·접속에 2.5초 넘게 걸리기도 했다
const t0 = Date.now();
for (let i = 0; i < 100 && !seen.some((m) => m.t === 'join' && m.p.nick === '폰 조이스틱'); i++) await sleep(100);
console.log('joined after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await sleep(1000);

const view = await evaluate('({ w: innerWidth, h: innerHeight })');
const rest = await stick();
const restOk = rest.found && rest.visible && rest.left >= 0 && rest.bottom <= view.h && rest.right <= view.w / 2 && rest.top >= view.h / 2;

// 보이는 조이스틱 한가운데를 눌러 오른쪽 위로 끈다
const phone = seen.find((m) => m.t === 'join' && m.p.nick === '폰 조이스틱');
const from = rest.found ? { x: rest.x, y: rest.y } : { x: 100, y: 700 };
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
for (let i = 1; i <= 8; i++) {
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + i * 4, y: from.y - i * 4 }] });
  await sleep(30);
}
await sleep(1200);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(800);

const moves = seen.filter((m) => m.t === 'move' && phone && m.id === phone.p.id);
const walking = moves.find((m) => m.dx !== 0 || m.dz !== 0);
const walkingLen = walking ? Math.hypot(walking.dx, walking.dz) : 0;
const last = moves.at(-1);
const stopped = !!last && last.dx === 0 && last.dz === 0;
const after = await stick();
const backHome = after.found && after.visible && Math.hypot(after.x - rest.x, after.y - rest.y) < 2;

console.log(JSON.stringify({ view, rest, restOk, joined: !!phone, moves: moves.length, walkingLen: walkingLen.toFixed(3), stopped, after, backHome }));
await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
watcher.close();
const ok = restOk && !!phone && Math.abs(walkingLen - 1) < 0.01 && stopped && backHome;
console.log(ok ? 'PASS mobile-joystick' : 'FAIL mobile-joystick');
process.exit(ok ? 0 : 1);
