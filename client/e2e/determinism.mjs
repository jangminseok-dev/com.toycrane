// 결정성 확인 (물리 뽑기 설계 §4.6·§8.5): 화면 둘이 같은 서버 상태(안 앉은 인형)를 각자 물리로 앉힌 뒤, 같은 기계의 인형 자리·돌림이 같은지 본다.
// 사용: `node client/e2e/determinism.mjs <port> <url>` — 창을 따로 열어 둘 다 그리게 한다
const [port, base] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);
await new Promise((r) => (browser.onopen = r));
let bid = 0; const bpending = new Map();
browser.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bpending.has(m.id)) { bpending.get(m.id)(m); bpending.delete(m.id); } };
const bsend = (method, params = {}) => new Promise((r) => { const i = ++bid; bpending.set(i, r); browser.send(JSON.stringify({ id: i, method, params })); });
async function page(nick) {
  const { result } = await bsend('Target.createTarget', { url: 'about:blank', newWindow: true, width: 1280, height: 800 });
  const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/${result.targetId}`); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
  await send('Page.navigate', { url: base + '/' }); await sleep(2500);
  await ev(`(() => { const i = document.querySelector('input'); i.value = ${JSON.stringify(nick)}; i.form.requestSubmit(); })()`);
  await sleep(1500);
  // 스폰 자리는 기계 줄에서 8m 넘게 떨어질 수 있다 — 앞(−z)의 기계 줄 쪽으로 조금 걸어 둘 다 같은 기계들을 앉히게 한다
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW' }); await sleep(1500); await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW' });
  return { ev, close: () => bsend('Target.closeTarget', { targetId: result.targetId }) };
}
const A = await page('같은이'), B = await page('같은둘');
await sleep(3000);
// 물리가 준비되고 8m 안의 기계가 앉혀질 때까지 (스폰 근처 기계들)
const settledIds = async (P) => P.ev("JSON.stringify(window.__toycrane.settledIds ? window.__toycrane.settledIds() : [])").then(JSON.parse);
// 두 화면의 스폰 자리가 달라 앉히는 기계도 다르다 — 둘 다 앉힌 기계만 비교한다
let ids = [];
for (let i = 0; i < 120; i++) { const idsB = new Set(await settledIds(B)); ids = (await settledIds(A)).filter((id) => idsB.has(id)); if (ids.length >= 2) break; await sleep(500); }
let compared = 0, mismatched = [];
for (const id of ids) {
  const a = await A.ev(`JSON.stringify(window.__toycrane.contents('${id}'))`).then(JSON.parse);
  const b = await B.ev(`JSON.stringify(window.__toycrane.contents('${id}'))`).then(JSON.parse);
  if (!a.length || a.some((d) => d[2] === null) || b.some((d) => d[2] === null)) continue;
  compared++;
  for (const d of a) { const e = b.find((x) => x[12] === d[12]); const same = e && d.slice(1, 8).every((v, k) => Math.abs(v - e[k + 1]) < 1e-6); if (!same) mismatched.push(`${id}#${d[12]}`); }
}
console.log('A settled', JSON.stringify(await settledIds(A)), 'B settled', JSON.stringify(await settledIds(B)));
console.log('settled by this screen', ids.length, 'compared', compared, 'mismatched', mismatched.length, mismatched.slice(0, 5).join(' '));
const ok = compared >= 2 && mismatched.length === 0;
console.log(ok ? 'PASS determinism' : 'FAIL determinism');
await A.close(); await B.close(); browser.close(); process.exit(ok ? 0 : 1);
