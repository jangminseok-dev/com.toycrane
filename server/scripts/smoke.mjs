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

const cases = {
  async myself() {
    const { status, body } = await getJson('/api/myself');
    assert(status === 200, `status ${status}`);
    assert(Array.isArray(body.endpoints) && body.endpoints.length === 5, `endpoints ${JSON.stringify(body?.endpoints)}`);
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
