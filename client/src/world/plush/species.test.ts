import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../../test/canvasStub';
import { PLAIN } from '../dolls';
import { TARGET_TOP, makePlush, solidPoints } from './index';
import { SPECIES } from './species';

beforeAll(stubCanvas);
const kinds = () => Object.keys(SPECIES);

// 인형 리뉴얼 설계 §4: 지금 인형과 같은 키(서 있는 형 1.07, 동글이형 1.02), 서버 한계 0.34/0.3 아래
test('each species reaches its target height and stays under the server limit', () => {
  for (const id of kinds()) {
    const p = makePlush(id, PLAIN, false)!;
    const top = Math.max(...p.solid.map((h) => h.c.y + h.r));
    expect(top, id).toBeCloseTo(SPECIES[id].round ? TARGET_TOP.round : TARGET_TOP.standing, 2);
    expect(top, id).toBeLessThan(0.34 / 0.3);
  }
});

// spec §6: 부딪힘 공은 12개 안팎 (Task 3·6 ruling: 20 이하 — 바닥에 감긴 꼬리·문어 다리까지 감싸려면. 물리 시간은 Task 14에서 잰다)
test('each species has at most twenty hit balls and a head', () => {
  for (const id of kinds()) {
    const p = makePlush(id, PLAIN, false)!;
    expect(p.solid.length, id).toBeLessThanOrEqual(20);
    expect(p.head.r, id).toBeGreaterThan(0.2);
  }
});

// Review Focus 1: 보이는 단단한 부위(발·꼬리 포함)를 공이 감싼다 — 손가락·옆 인형이 뚫지 않게
test('hit balls hug every solid vertex', () => {
  for (const id of kinds()) {
    const p = makePlush(id, PLAIN, true)!;
    let worst = 0;
    for (const v of solidPoints(id, true)) worst = Math.max(worst, Math.min(...p.solid.map((h) => v.distanceTo(h.c) - h.r)));
    expect(worst, id).toBeLessThan(0.06);
  }
});

test('every species knows its eye style', () => {
  for (const id of kinds()) expect(['dot', 'anime'], id).toContain(SPECIES[id].eyes);
});
