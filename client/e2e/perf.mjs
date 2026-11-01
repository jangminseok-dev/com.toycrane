// 성능 측정: PC(1280×800)와 휴대폰(390×844) 화면에서 걷기 시점(스폰)과 기계 앞 화면(C-6 한 판, 피규어 F-1 한 판)의 그리기 호출·삼각형 수를 잰다.
// 각 지점에서 30프레임 평균. 그래픽 개편 전후를 같은 방법으로 비교한다(설계 2026-10-31 §7: 1.5배 이하).
// 사용: 헤드리스 크롬을 --remote-debugging-port=9461로 띄운 뒤
//   node client/e2e/perf.mjs <base-url> <out.json> [port=9461]
// 출력: { walk_pc, machine_pc, cycle_pc(집게 한 바퀴 중), physics_pc_ms(프레임당 물리), figure_pc(피규어 기계 앞), ring_pc·pusher_pc(고리·미는 뽑기 기계 앞), walk_phone, …, walk_pc_tri, … }
const [base, out, port = '9461'] = process.argv.slice(2);
import { LAYOUT, frontOf, route } from './nav.mjs';
const fs = await import('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPEED = 3.2, FRONT_C6 = frontOf('C-6');
const WINDOW_0 = { x: LAYOUT.counters[0].window[0], z: LAYOUT.counters[0].window[1] };


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
  await click('코인 받기'); // 교환소 개편(5단계): 줄 없이 바로
  await sleep(1500);
  await goTo(FRONT_C6);
  await sleep(500);
  for (let i = 0; i < 100 && (await evaluate("document.body.innerText.includes('준비 중')")); i++) await sleep(300); // 물리 모듈을 받는 중이면 기다린다
  if (!(await click('한 판 하기'))) throw new Error('기계 앞에서 시작하지 못함');
  await sleep(2000);
  const machine = await sample(); // 기계 앞 화면(뒷판 모니터 포함)
  // 잡기 → 집게 한 바퀴(물리) 동안: 그리기 호출(live 모드)과 프레임당 물리 시간(ms). 휴대폰 흉내는 CPU 4배 느리게
  if (mode === 'phone') await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const drop = JSON.parse(await evaluate("JSON.stringify(window.__toycrane.controlAt('drop'))"));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: drop.x, y: drop.y, button: 'left', clickCount: 1 }); await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: drop.x, y: drop.y, button: 'left', clickCount: 1 });
  await sleep(1500);
  const cycle = await sample();
  const physics = Number((await evaluate('window.__toycrane.physicsMs()')).toFixed(2));
  if (mode === 'phone') await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // 고리 걸기·미는 뽑기 기계 앞 화면(계획 12): 결과를 기다려 일어난 뒤 R-3, P-2 앞에서 한 판씩 — 재고 나서 버튼(고리 ①②, 미는 뽑기 '잡기')을 눌러 판을 끝낸다
  const press = async (b) => {
    const p = JSON.parse((await evaluate(`JSON.stringify(window.__toycrane.buttonAt(${b}))`)) ?? 'null');
    if (!p) return;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(150);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(300);
  };
  const tapDrop = async () => {
    const p = JSON.parse((await evaluate("JSON.stringify(window.__toycrane.controlAt('drop'))")) ?? 'null');
    if (!p) return;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(80);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  };
  const playAt = async (id, buttons) => {
    for (let i = 0; i < 200 && !(await click('그만하기')); i++) await sleep(300); // 미는 뽑기는 놓은 뒤 판이 다 밀 때까지(최대 15초) 결과가 늦다
    await sleep(500);
    await goTo(frontOf(id));
    await sleep(500);
    if (!(await click('한 판 하기'))) throw new Error(`${id} 앞에서 시작하지 못함`);
    await sleep(2000);
    const s = await sample();
    for (const b of buttons) await (b === 'drop' ? tapDrop() : press(b));
    return s;
  };
  const ring = await playAt('R-3', [1, 2]);
  const pusher = await playAt('P-2', ['drop']);
  // 피규어 기계 앞 화면(9단계): 결과를 기다려 일어난 뒤 F-1 앞에서 한 판
  for (let i = 0; i < 200 && !(await click('그만하기')); i++) await sleep(300);
  await sleep(500);
  await goTo(frontOf('F-1'));
  await sleep(500);
  if (!(await click('한 판 하기'))) throw new Error('피규어 기계 앞에서 시작하지 못함');
  await sleep(2000);
  const figure = await sample();
  await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
  watcher.close();
  return { [`walk_${mode}`]: walk.calls, [`machine_${mode}`]: machine.calls, [`cycle_${mode}`]: cycle.calls, [`physics_${mode}_ms`]: physics, [`figure_${mode}`]: figure.calls, [`ring_${mode}`]: ring.calls, [`pusher_${mode}`]: pusher.calls, [`walk_${mode}_tri`]: walk.tri, [`machine_${mode}_tri`]: machine.tri, [`figure_${mode}_tri`]: figure.tri, [`ring_${mode}_tri`]: ring.tri, [`pusher_${mode}_tri`]: pusher.tri };
}

const result = { ...(await measure('pc')), ...(await measure('phone')) };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
process.exit(0);
