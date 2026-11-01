// 레버로 집게를 기계 안 (x, z)까지 옮긴다(e2e 공용): 레버를 끈 만큼 집게 속도가 정해지니, 남은 거리만큼 끌고 지금 자리를 읽어 몇 번 고친다.
// 화면 오른쪽(+px) = 기계 +x, 화면 위(−px) = 기계 안쪽(−z). 사용: await leverTo({ send, ev, sleep }, { x, z })
const SPEED = 0.35; // MACHINE_SPEC.claw_speed — 레버 60px 이상이면 최고 속도
export async function leverTo({ send, ev, sleep }, goal) {
  const read = async (x) => JSON.parse((await ev(x)) ?? 'null');
  for (let k = 0; k < 4; k++) {
    const c = await read('JSON.stringify(window.__toycrane.claw())'), p = await read("JSON.stringify(window.__toycrane.controlAt('lever'))");
    if (!c || !p) return 'no lever';
    const dx = goal.x - c.x, dz = goal.z - c.z;
    if (Math.hypot(dx, dz) < 0.012) return 'ok';
    for (const [d, px, py] of [[dx, Math.sign(dx) * 80, 0], [dz, 0, Math.sign(dz) * 80]]) {
      if (Math.abs(d) < 0.008) continue;
      const secs = Math.abs(d) / SPEED, scale = k === 0 ? 1 : 0.5; // 고칠 때는 반 속도(40px)로 더 길게 — 넘치지 않게
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + px * scale, y: p.y + py * scale, button: 'left', buttons: 1 });
      await sleep((secs / (k === 0 ? 1 : 40 / 60)) * 1000);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + px * scale, y: p.y + py * scale, button: 'left', clickCount: 1 });
      await sleep(80);
    }
  }
  return 'near';
}
export async function tapDrop({ send, ev, sleep }) {
  const p = JSON.parse((await ev("JSON.stringify(window.__toycrane.controlAt('drop'))")) ?? 'null');
  if (!p) return 'no drop';
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  return 'ok';
}
// 미는 뽑기 칸(턱 오른쪽)에서 위가 열린 미니 인형 — 가장 높이 앉은 것(머리 위가 비어 집기 쉽다). [x, z]
export function pileTarget(dolls, ledgeX1) {
  const pile = dolls.filter((d) => d[1] > ledgeX1 + 0.04 && d[2] !== null);
  if (!pile.length) return { x: 0.2, z: 0 };
  const top = pile.reduce((b, d) => (d[2] > b[2] ? d : b), pile[0]);
  return { x: Math.min(0.37, top[1]), z: Math.max(-0.31, Math.min(0.31, top[3])) };
}
