// 도감 시제품 스크린샷 (인형 리뉴얼 Task 3): 개발 서버(npm run dev)와 헤드리스 크롬을 띄운 뒤
// node client/e2e/dogam-shot.mjs <port> <base-url> <out-dir> [query...]  — 쿼리마다 1400×900 사진, 페이지 오류를 찍는다
const [port, base, out, ...queries] = process.argv.slice(2);
const fs = await import('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });
for (const query of queries.length ? queries : ['shot=1']) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(), logs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 400));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/dogam.html?${query}` });
  let ok = false; for (let i = 0; i < 150 && !(ok = await ev('window.__ready === true')); i++) await sleep(200);
  await sleep(500);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${out}/${query.replace(/[^a-z0-9=]+/gi, '_')}.png`;
  fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log(ok ? 'ready' : 'NOT READY', file, logs.join(' | '));
  await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
}
process.exit(0);
