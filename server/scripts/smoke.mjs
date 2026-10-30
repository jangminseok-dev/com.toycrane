// 스모크: 떠 있는 서버(로컬 pywrangler dev 또는 배포 주소)에 붙어서 실제 동작을 확인한다.
// 사용: node server/scripts/smoke.mjs <base-url> <case> [case...]
const [base, ...names] = process.argv.slice(2);
if (!base || names.length === 0) {
  console.error('사용: node smoke.mjs <base-url> <case...>');
  process.exit(2);
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const getJson = async (path, init) => {
  const res = await fetch(base + path, init);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const postJson = (path, data) =>
  getJson(path, { method: 'POST', body: JSON.stringify(data), headers: { 'content-type': 'application/json' } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 게스트를 만들고 배정받은 매장에 웹소켓으로 들어간다
async function newGuest(nickname) {
  const g = await postJson('/api/guest', { nickname });
  const a = await postJson('/api/admission', { guestId: g.body.guestId });
  assert(Number.isInteger(a.body.store), `admission ${JSON.stringify(a.body)}`);
  return { id: g.body.guestId, store: a.body.store };
}
function connect(guestId, store) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/store/${store}?guest=${guestId}`);
  const c = { ws, messages: [], closeCode: null };
  c.closed = new Promise((r) => ws.addEventListener('close', (e) => { c.closeCode = e.code; r(e.code); }));
  ws.addEventListener('message', (e) => c.messages.push(JSON.parse(e.data)));
  c.waitFor = async (pred, what, ms = 5000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) {
      const m = c.messages.find(pred);
      if (m) return m;
    }
    throw new Error(`기다리던 메시지 없음: ${what}`);
  };
  c.welcome = () => c.waitFor((m) => m.t === 'welcome', 'welcome');
  c.close = async () => { ws.close(); await c.closed; };
  return c;
}
const ids = (players) => players.map((p) => p.id);
const send = (c, msg) => c.ws.send(JSON.stringify(msg));

// 이동 예산(초당 4.8m) 안에서 걸어가기: 탑·교환소를 피해 반지름 3m 둘레를 돌아 목표 쪽으로 간 뒤 곧장 간다
async function walkTo(c, from, to) {
  const R = 3, path = [];
  const a0 = Math.atan2(from.z, from.x), a1 = Math.atan2(to.z, to.x);
  path.push({ x: Math.cos(a0) * R, z: Math.sin(a0) * R });
  let da = a1 - a0;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  for (let k = 1; k <= 12; k++) path.push({ x: Math.cos(a0 + (da * k) / 12) * R, z: Math.sin(a0 + (da * k) / 12) * R });
  path.push(to);
  let at = { ...from };
  for (const p of path) {
    for (let d = Math.hypot(p.x - at.x, p.z - at.z); d > 1e-6; d = Math.hypot(p.x - at.x, p.z - at.z)) {
      const k = Math.min(1, 0.7 / d);
      at = { x: at.x + (p.x - at.x) * k, z: at.z + (p.z - at.z) * k };
      send(c, { t: 'move', x: +at.x.toFixed(2), z: +at.z.toFixed(2), dx: 0, dz: 0 });
      await sleep(180);
    }
  }
  await sleep(200);
  assert(!c.messages.some((m) => m.t === 'correct'), `걷는 중 보정됨 ${JSON.stringify(c.messages.find((m) => m.t === 'correct'))}`);
}

const WINDOW = { x: -2.9, z: -2.6 }, C6 = { x: 0, z: -5.4 }; // 교환소 0 창구, C-6 기계 앞자리

// 교환소에서 코인 5개 받고 C-6 앞까지 간다
async function coinsThenC6(c, w) {
  await walkTo(c, w.you, WINDOW);
  send(c, { t: 'queue', c: 0 });
  await c.waitFor((m) => m.t === 'queue' && m.ids[0] === w.you.id, '줄 맨 앞');
  await sleep(2100);
  send(c, { t: 'take' });
  await c.waitFor((m) => m.t === 'coins' && m.got === 5, '코인 5개');
  await walkTo(c, WINDOW, C6);
}

const cases = {
  async myself() {
    const { status, body } = await getJson('/api/myself');
    assert(status === 200, `status ${status}`);
    assert(Array.isArray(body.endpoints) && body.endpoints.length === 5, `endpoints ${JSON.stringify(body?.endpoints)}`);
  },
  async guest() {
    const made = await postJson('/api/guest', { nickname: '  스모크  토끼 ' });
    assert(made.status === 201, `create ${made.status}`);
    assert(made.body.nickname === '스모크 토끼' && Number.isInteger(made.body.color), `body ${JSON.stringify(made.body)}`);
    const found = await getJson(`/api/guest/${made.body.guestId}`);
    assert(found.status === 200 && found.body.guestId === made.body.guestId, `find ${found.status}`);
    const blank = await postJson('/api/guest', { nickname: '   ' });
    assert(blank.status === 400 && blank.body.error === 'nickname', `blank ${blank.status}`);
    const broken = await getJson('/api/guest', { method: 'POST', body: 'not json', headers: { 'content-type': 'application/json' } });
    assert(broken.status === 400, `broken body ${broken.status}`);
    const unknown = await getJson('/api/guest/nope');
    assert(unknown.status === 404, `unknown ${unknown.status}`);
  },
  async admission() {
    const g = await postJson('/api/guest', { nickname: '배정 토끼' });
    const ok = await postJson('/api/admission', { guestId: g.body.guestId });
    assert(ok.status === 200 && (Number.isInteger(ok.body.store) || ok.body.full === true), `admit ${ok.status} ${JSON.stringify(ok.body)}`);
    const unknown = await postJson('/api/admission', { guestId: 'nope' });
    assert(unknown.status === 404, `unknown ${unknown.status}`);
    const intro = await getJson('/api/admission/myself');
    assert(intro.status === 200 && intro.body.name === '매장 배정', `myself ${intro.status}`);
  },
  async together() {
    const ga = await newGuest('같이 A'), gb = await newGuest('같이 B');
    const a = connect(ga.id, ga.store);
    const wa = await a.welcome();
    const b = connect(gb.id, ga.store);
    const wb = await b.welcome();
    assert(ids(wb.players).includes(wa.you.id), 'B의 welcome에 A가 없음');
    await a.waitFor((m) => m.t === 'join' && m.p.id === wb.you.id, 'A가 B join 받기');
    await b.close();
    await a.waitFor((m) => m.t === 'leave' && m.id === wb.you.id, 'A가 B leave 받기');
    await a.close();
  },
  async twotabs() {
    const g = await newGuest('두 탭');
    const first = connect(g.id, g.store);
    const w1 = await first.welcome();
    const second = connect(g.id, g.store);
    const w2 = await second.welcome();
    assert((await first.closed) === 4003, `첫 탭 닫기 코드 ${first.closeCode}`);
    assert(!ids(w2.players).includes(w1.you.id), '이전 탭 캐릭터가 남아 있음');
    await second.close();
  },
  async walk() {
    const ga = await newGuest('걷기 A'), gb = await newGuest('걷기 B');
    const a = connect(ga.id, ga.store), b = connect(gb.id, ga.store);
    const wa = await a.welcome();
    await b.welcome();
    const sx = wa.you.x, sz = wa.you.z;
    // 걷는 속도 안의 이동 → B가 받음
    a.ws.send(JSON.stringify({ t: 'move', x: sx + 0.3, z: sz, dx: 1, dz: 0 }));
    const m1 = await b.waitFor((m) => m.t === 'move' && m.id === wa.you.id, 'B가 A move 받기');
    assert(Math.abs(m1.x - (sx + 0.3)) < 0.02 && m1.dx === 1, `move ${JSON.stringify(m1)}`);
    // 이상한 메시지 → 무시, 접속 유지
    a.ws.send('not json');
    a.ws.send(JSON.stringify({ t: 'jump' }));
    // 순간이동 → A가 correct 받음
    a.ws.send(JSON.stringify({ t: 'move', x: -12, z: -12, dx: 0, dz: 0 }));
    const fix = await a.waitFor((m) => m.t === 'correct', 'A가 correct 받기');
    assert(Math.hypot(fix.x - (-12), fix.z - (-12)) > 5, `보정 위치 ${JSON.stringify(fix)}`);
    assert(a.closeCode === null, `이상한 메시지 뒤 접속이 닫힘 ${a.closeCode}`);
    await Promise.all([a.close(), b.close()]);
  },
  async coins() {
    const g = await newGuest('스모크 코인');
    const c = connect(g.id, g.store);
    const w = await c.welcome();
    assert(w.coins === 0 && w.bag === 0 && Object.keys(w.machines).length === 35, `welcome ${JSON.stringify({ coins: w.coins, bag: w.bag })}`);
    await walkTo(c, w.you, { x: -2.9, z: -2.6 }); // 교환소 0 창구
    send(c, { t: 'queue', c: 0 });
    await c.waitFor((m) => m.t === 'queue' && m.c === 0 && m.ids[0] === w.you.id, '줄 맨 앞');
    await sleep(1500);
    send(c, { t: 'take' }); // 2초 전 → 무시
    await sleep(300);
    assert(!c.messages.some((m) => m.t === 'coins'), '2초 전에 코인을 줌');
    await sleep(500);
    send(c, { t: 'take' });
    const got = await c.waitFor((m) => m.t === 'coins', '코인 받기');
    assert(got.n === 5 && got.got === 5, `coins ${JSON.stringify(got)}`);
    await c.waitFor((m) => m.t === 'queue' && m.c === 0 && !m.ids.includes(w.you.id), '받고 줄에서 빠짐');
    await c.close();
  },
  async play() {
    const g = await newGuest('스모크 한판'), o = await newGuest('스모크 구경');
    const c = connect(g.id, g.store), obs = connect(o.id, g.store);
    const w = await c.welcome();
    await obs.welcome();
    await coinsThenC6(c, w);
    send(c, { t: 'play', m: 'C-6' });
    const ok = await c.waitFor((m) => m.t === 'play_ok', 'play_ok');
    assert(ok.m === 'C-6' && ok.coins === 4 && ok.limit === 20, `play_ok ${JSON.stringify(ok)}`);
    await obs.waitFor((m) => m.t === 'play' && m.m === 'C-6' && m.id === w.you.id, '구경꾼이 play 받기');
    const [, x, z] = w.machines['C-6'][0];
    send(c, { t: 'drop', x, z }); // 인형 위에
    const r = await obs.waitFor((m) => m.t === 'result' && m.m === 'C-6', '구경꾼이 result 받기');
    assert(['win', 'slip', 'miss'].includes(r.o) && ['head', 'body', 'arm', 'none'].includes(r.part) && r.id === w.you.id, `result ${JSON.stringify(r)}`);
    if (r.o === 'win') {
      await obs.waitFor((m) => m.t === 'machine' && m.m === 'C-6' && m.dolls.length === 9, '새 배치');
      await c.waitFor((m) => m.t === 'bag' && m.n === 1, '가방 1');
    }
    await Promise.all([c.close(), obs.close()]);
  },
  async busy() {
    const ga = await newGuest('스모크 먼저'), gb = await newGuest('스모크 나중');
    const a = connect(ga.id, ga.store), b = connect(gb.id, ga.store);
    const wa = await a.welcome();
    await b.welcome();
    await coinsThenC6(a, wa);
    send(a, { t: 'play', m: 'C-6' });
    await a.waitFor((m) => m.t === 'play_ok', 'A play_ok');
    send(b, { t: 'play', m: 'C-6' });
    const no = await b.waitFor((m) => m.t === 'play_no', 'B play_no');
    assert(no.why === 'busy', `B ${JSON.stringify(no)}`);
    await Promise.all([a.close(), b.close()]);
  },
  async nocoins() {
    const g = await newGuest('스모크 빈지갑');
    const c = connect(g.id, g.store);
    const w = await c.welcome();
    await walkTo(c, w.you, C6);
    send(c, { t: 'play', m: 'C-6' });
    const no = await c.waitFor((m) => m.t === 'play_no', 'play_no');
    assert(no.why === 'coins', `play_no ${JSON.stringify(no)}`);
    await c.close();
  },
  async refund() {
    const g = await newGuest('스모크 환불'), o = await newGuest('스모크 지켜봄');
    const c = connect(g.id, g.store), obs = connect(o.id, g.store);
    const w = await c.welcome();
    await obs.welcome();
    await coinsThenC6(c, w);
    send(c, { t: 'play', m: 'C-6' });
    await c.waitFor((m) => m.t === 'play_ok' && m.coins === 4, 'play_ok');
    await c.close(); // 하는 도중 끊김
    await obs.waitFor((m) => m.t === 'free' && m.m === 'C-6', '구경꾼이 free 받기');
    const again = connect(g.id, g.store);
    const w2 = await again.welcome();
    assert(w2.coins === 5, `돌려받은 코인 ${w2.coins}`);
    await Promise.all([again.close(), obs.close()]);
  },
  async unknown() {
    const c = connect('nope', 1);
    assert((await c.closed) === 4002, `닫기 코드 ${c.closeCode}`);
  },
  async idle() {
    const ga = await newGuest('잠 A'), gb = await newGuest('잠 B'), gc = await newGuest('잠 C');
    const a = connect(ga.id, ga.store), b = connect(gb.id, ga.store);
    const wa = await a.welcome(), wb = await b.welcome();
    await sleep(20000); // 조용히 두면 매장 DO가 잠든다
    const c = connect(gc.id, ga.store);
    const wc = await c.welcome();
    assert(ids(wc.players).includes(wa.you.id) && ids(wc.players).includes(wb.you.id), `깨어난 뒤 목록 ${JSON.stringify(ids(wc.players))}`);
    await a.waitFor((m) => m.t === 'join' && m.p.id === wc.you.id, '깨어난 뒤 A가 C join 받기');
    await Promise.all([a.close(), b.close(), c.close()]);
  },
};

let failed = false;
for (const name of names) {
  try {
    assert(cases[name], `모르는 케이스: ${name}`);
    await cases[name]();
    console.log(`OK ${name}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
