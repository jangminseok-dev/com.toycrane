// 성능 측정: PC(1280×800)와 휴대폰(390×844) 화면에서 걷기 시점(스폰)과 기계 앞 화면(C-6 한 판)의 그리기 호출·삼각형 수를 잰다.
// 각 지점에서 30프레임 평균. 그래픽 개편 전후를 같은 방법으로 비교한다(설계 2026-10-31 §7: 1.5배 이하).
// 사용: 헤드리스 크롬을 --remote-debugging-port=9461로 띄운 뒤
//   node client/e2e/perf.mjs <base-url> <out.json> [port=9461]
// 출력: { walk_pc, machine_pc, walk_phone, machine_phone, walk_pc_tri, … }
const [base, out, port = '9461'] = process.argv.slice(2);
const fs = await import('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPEED = 3.2, FRONT_C6 = { x: 0, z: -5.4 }, WINDOW_0 = { x: -2.9, z: -2.6 };
const LAYOUT = JSON.parse(fs.readFileSync(new URL('../../shared/store_layout.json', import.meta.url), 'utf8'));

// 0.25m 격자에서 장애물(0.35m 여유)을 피하는 가장 짧은 길 (shot.mjs와 같은 방식)
const CELL = 0.25, HALF = 12.3, N = Math.round((HALF * 2) / CELL) + 1;
const free = (x, z) => Math.abs(x) <= HALF && Math.abs(z) <= HALF
  && !LAYOUT.obstacles.some(([x0, z0, x1, z1]) => x > x0 - 0.35 && x < x1 + 0.35 && z > z0 - 0.35 && z < z1 + 0.35);
const cellOf = (v) => Math.max(0, Math.min(N - 1, Math.round((v + HALF) / CELL)));
const at = (i) => -HALF + i * CELL;
function route(from, to) {
  const start = cellOf(from.x) * N + cellOf(from.z), goal = cellOf(to.x) * N + cellOf(to.z);
  const prev = new Map([[start, -1]]), queue = [start];
  while (queue.length && !prev.has(goal)) {
    const c = queue.shift(), ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const i = ci + di, j = cj + dj, n = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || prev.has(n) || !free(at(i), at(j))) continue;
      prev.set(n, c); queue.push(n);
    }
  }
  if (!prev.has(goal)) return [to];
  const cells = [];
  for (let c = goal; c !== -1; c = prev.get(c)) cells.unshift(c);
  const pts = [];
  for (let k = 1; k < cells.length; k++) {
    const d = (a, b) => [Math.floor(b / N) - Math.floor(a / N), (b % N) - (a % N)].join();
    if (k === cells.length - 1 || d(cells[k - 1], cells[k]) !== d(cells[k], cells[k + 1])) pts.push({ x: at(Math.floor(cells[k] / N)), z: at(cells[k] % N) });
  }
  pts[pts.length - 1] = to;
  return pts;
}

async function measure(mode) {
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
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const phone = mode === 'phone';
  await send('Emulation.setDeviceMetricsOverride', phone
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage' });
  await send('Page.navigate', { url: base + '/' });
  await sleep(3000);
  const nick = `측정${Math.floor(Math.random() * 1000)}`;
  await evaluate(`(() => { const i = document.querySelector('input'); i.value = ${JSON.stringify(nick)}; i.form.requestSubmit(); })()`);
  let me;
  for (let i = 0; i < 80 && !me; i++) { await sleep(100); me = seen.find((m) => m.t === 'join' && m.p.nick === nick)?.p; }
  if (!me) throw new Error('입장 실패');
  const posOfMe = () => { const mv = [...seen].reverse().find((m) => m.t === 'move' && m.id === me.id); return mv ? { x: mv.x, z: mv.z } : { x: me.x, z: me.z }; };
  const key = async (code, secs) => {
    if (secs <= 0.02) return;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code.slice(3).toLowerCase() });
    await sleep(secs * 1000);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase() });
    await sleep(120);
  };
  const goTo = async (goal) => {
    let pos = posOfMe();
    for (const p of route(pos, goal)) {
      await key(p.x > pos.x ? 'KeyD' : 'KeyA', Math.abs(p.x - pos.x) / SPEED);
      await key(p.z > pos.z ? 'KeyS' : 'KeyW', Math.abs(p.z - pos.z) / SPEED);
      pos = p;
    }
    for (let k = 0; k < 8; k++) { // 실제 위치를 보며 마지막으로 맞춘다
      await sleep(400);
      const q = posOfMe(), dx = goal.x - q.x, dz = goal.z - q.z;
      if (Math.hypot(dx, dz) < 0.25) break;
      if (Math.abs(dx) > 0.1) await key(dx > 0 ? 'KeyD' : 'KeyA', Math.min(1.5, Math.abs(dx) / SPEED));
      if (Math.abs(dz) > 0.1) await key(dz > 0 ? 'KeyS' : 'KeyW', Math.min(1.5, Math.abs(dz) / SPEED));
    }
  };
  const click = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)}) && x.getClientRects().length > 0 && x.style.display !== 'none'); if (!b) return false; b.click(); return true; })()`);
  const sample = async () => {
    const v = await evaluate("new Promise((r) => { const v = []; const f = () => { v.push([window.__toycrane.drawCalls(), window.__toycrane.triangles()]); if (v.length < 30) requestAnimationFrame(f); else r(v); }; requestAnimationFrame(f); })");
    return { calls: Math.round(v.reduce((s, x) => s + x[0], 0) / v.length), tri: Math.round(v.reduce((s, x) => s + x[1], 0) / v.length) };
  };
  await sleep(2500);
  const walk = await sample();
  await goTo(WINDOW_0);
  await click('줄 서기');
  await sleep(6000);
  await goTo(FRONT_C6);
  await sleep(500);
  if (!(await click('넣고 하기'))) throw new Error('기계 앞에서 시작하지 못함');
  await sleep(2000);
  const machine = await sample(); // 기계 앞 화면(뒷판 모니터 포함)
  await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
  watcher.close();
  return { [`walk_${mode}`]: walk.calls, [`machine_${mode}`]: machine.calls, [`walk_${mode}_tri`]: walk.tri, [`machine_${mode}_tri`]: machine.tri };
}

const result = { ...(await measure('pc')), ...(await measure('phone')) };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
process.exit(0);
