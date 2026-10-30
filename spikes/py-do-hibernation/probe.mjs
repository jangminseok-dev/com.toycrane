// 버리는 시험 클라이언트: 2명 접속 → 메시지 → idleSec 동안 조용히 → 다시 메시지
// 사용: node probe.mjs <ws-url> <idleSec>
const [url = 'ws://localhost:8787/ws', idleSec = '15'] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const open = name => new Promise((res, rej) => {
  const ws = new WebSocket(url);
  ws.onopen = () => res(ws);
  ws.onerror = e => rej(new Error(`${name} 접속 실패: ${e.message ?? e.type}`));
  ws.onmessage = e => console.log(`${name} 받음: ${e.data}`);
  ws.onclose = e => console.log(`${name} 끊김: code=${e.code}`);
});
const a = await open('A'), b = await open('B');
a.send('first');
await sleep(1000);
console.log(`--- ${idleSec}초 동안 조용히 (이 사이에 잠들어야 함) ---`);
await sleep(Number(idleSec) * 1000);
b.send('second');
await sleep(2000);
a.close(); b.close();
await sleep(300);
