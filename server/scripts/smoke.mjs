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
