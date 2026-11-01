// 화면 확인 도구: 휴대폰·PC 화면으로 들어가(저장소 비우고 닉네임 넣기), 원하면 지점들을 차례로 걸어간 뒤 캡처한다.
// 초당 프레임(3초 평균)도 함께 출력한다.
// 사용: 헤드리스 크롬을 --remote-debugging-port=<port>로 띄운 뒤
//   node client/e2e/shot.mjs <port> <base-url> <out.png> [phone|pc] ["x,z;x,z…"] [누른 뒤 기다릴 초]
// 마지막 인자가 있으면 걸어간 뒤 오른쪽 아래 행동 버튼("줄 서기" 등)을 누르고 그만큼 기다렸다 캡처한다.
// 걷기 자리에 단계를 섞어 쓸 수도 있다: "go:x,z;press:4;go:x,z;press:1.5;keys:KeyA=0.8;shot:이름" (shot은 그 순간 따로 캡처)
// 걷기: 지점마다 장애물(shared/store_layout.json)을 피하는 길을 격자로 찾아, 휴대폰은 조이스틱을 그 방향으로 끌고
// PC는 WASD를 눌러 따라간다.
const [port, base, out, mode = 'phone', walk = '', press = ''] = process.argv.slice(2);
import { LAYOUT, frontOf, route } from './nav.mjs';
const fs = await import('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPEED = 3.2;
const phone = mode === 'phone';


// 내 스폰 자리를 알려고 같은 매장에 관찰자로 들어간다
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
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr, awaitPromise = false) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise })).result?.result?.value;

await send('Runtime.enable');
if (phone) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
} else {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
}
await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
await send('Page.navigate', { url: base + '/' });
await sleep(2500);
const nick = `캡처${Math.floor(Math.random() * 1000)}`;
await evaluate(`(() => { const i = document.querySelector('input'); i.value = ${JSON.stringify(nick)}; i.form.requestSubmit(); })()`);
let join;
for (let i = 0; i < 80 && !join; i++) { await sleep(100); join = seen.find((m) => m.t === 'join' && m.p.nick === nick); }
await sleep(500);
const pos = join ? { x: join.p.x, z: join.p.z } : null;

async function hold(dx, dz, seconds) {
  if (seconds <= 0.02) return;
  if (phone) {
    const home = await evaluate("(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [home] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: home.x + dx * 40, y: home.y + dz * 40 }] });
    await sleep(seconds * 1000);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    const code = dx > 0 ? 'KeyD' : dx < 0 ? 'KeyA' : dz > 0 ? 'KeyS' : 'KeyW';
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code.slice(3).toLowerCase() });
    await sleep(seconds * 1000);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase() });
  }
  await sleep(150);
}
async function goTo(gx, gz) {
  for (const { x: tx, z: tz } of route(pos, { x: gx, z: gz })) {
    if (phone) {
      const d = Math.hypot(tx - pos.x, tz - pos.z);
      if (d > 0.02) await hold((tx - pos.x) / d, (tz - pos.z) / d, d / SPEED);
    } else {
      await hold(Math.sign(tx - pos.x), 0, Math.abs(tx - pos.x) / SPEED);
      await hold(0, Math.sign(tz - pos.z), Math.abs(tz - pos.z) / SPEED);
    }
    pos.x = tx; pos.z = tz;
  }
}
const pressButton = () => evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent && x.getClientRects().length > 0); if (!b) return null; b.click(); return b.textContent; })()");
const steps = [];
if (walk && pos) {
  const stepped = /(go|press|keys|shot):/.test(walk);
  for (const part of walk.split(';')) {
    const [kind, arg] = stepped ? part.split(/:(.*)/s) : ['go', part];
    if (kind === 'go') { const [gx, gz] = arg.split(',').map(Number); await goTo(gx, gz); }
    else if (kind === 'press') { steps.push({ pressed: await pressButton() }); await sleep(Number(arg) * 1000); }
    else if (kind === 'keys') {
      const [code, secs] = arg.split('=');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code.slice(3).toLowerCase() });
      await sleep(Number(secs) * 1000);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase() });
    } else if (kind === 'shot') {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(out.replace(/\.png$/, `-${arg}.png`), Buffer.from(r.result.data, 'base64'));
      steps.push({ shot: arg, hud: await evaluate("document.body.innerText.replace(/\\s+/g, ' ').trim()") });
    }
  }
  await sleep(800);
}
let pressed = null;
if (press) {
  pressed = await pressButton();
  await sleep(Number(press) * 1000);
}
const fps = await evaluate('new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(Math.round(n / 3)); }; requestAnimationFrame(f); })', true);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
const last = seen.filter((m) => m.t === 'move' && join && m.id === join.p.id).at(-1);
const hud = await evaluate("document.body.innerText.replace(/\\s+/g, ' ').trim()");
console.log(JSON.stringify({ mode, spawn: join && { x: join.p.x, z: join.p.z }, serverSaysNow: last && { x: last.x, z: last.z }, steps, pressed, hud, fps, errors }));
await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
watcher.close();
process.exit(0);
