// 휴대폰 입장 회귀 검사: 세로 화면에서 닉네임 입력칸과 "들어가기" 버튼의 왼쪽 절반을 손가락으로 눌러 들어가지는지 본다.
// (조이스틱이 화면 왼쪽 아래 터치를 가로채면 입장 카드가 먹통이 된다 — 최종 리뷰 #2)
// 사용: 헤드리스 크롬을 --remote-debugging-port=<port>로 띄운 뒤 `node client/e2e/mobile-entry.mjs <port> <url>`
const [port, url] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
const tap = async (x, y) => {
  await send('Input.synthesizeTapGesture', { x, y, gestureSourceType: 'touch' });
  await sleep(300);
};
// 요소의 왼쪽 1/4 지점(화면 왼쪽 아래 사분면에 걸리는 곳)
const leftPoint = (selector) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width * 0.25, y: r.top + r.height / 2 }; })()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
// 앞선 실행이 저장한 게스트가 있으면 닉네임 칸 대신 "어서 오세요"가 떠서, 처음 온 사람처럼 저장소를 비운다
await send('Storage.clearDataForOrigin', { origin: new URL(url).origin, storageTypes: 'local_storage' });
await send('Page.navigate', { url });
await sleep(2500);

const input = await leftPoint('input');
const button = await leftPoint('button');
const view = await evaluate('({ w: innerWidth, h: innerHeight })');
const inLowerLeft = (p) => p.x < view.w / 2 && p.y > view.h / 2;
await tap(input.x, input.y);
const focused = await evaluate("document.activeElement?.tagName === 'INPUT'");
await send('Input.insertText', { text: '폰 토끼' });
await tap(button.x, button.y);
await sleep(3000);
const text = await evaluate('document.body.innerText');
const entered = text === '';
const fitsPhone = view.w === 390; // 화면이 축소되지 않고 휴대폰 폭 그대로인지
console.log(JSON.stringify({ view, button, buttonInLowerLeft: inLowerLeft(button), fitsPhone, focused, entered, text }));
await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
const ok = entered && focused && fitsPhone && inLowerLeft(button);
console.log(ok ? 'PASS mobile-entry' : 'FAIL mobile-entry');
process.exit(ok ? 0 : 1);
