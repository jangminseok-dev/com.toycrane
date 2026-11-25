import { expect, test } from 'vitest';
import { STAFF, machineAt, postOf, sideSpot, walkSeconds } from '../data/staff';
import type { StaffJobWire } from '../net/protocol';
import { staffPose } from './staffSchedule';

// 상주 직원(설계 2026-11-24 store-staff): 서버 일정(시각)만으로 모든 화면이 같은 자리·동작을 구한다
const post = postOf('doll'), a1 = sideSpot('A-1'), a5 = sideSpot('A-5');
const job = (m: string, from: string | null, dep: number): StaffJobWire => {
  const start = from ? sideSpot(from) : post, arr = dep + walkSeconds(start, sideSpot(m)), put = arr + STAFF.work;
  return { m, from, dep, arr, put, end: put + STAFF.bow };
};
const j1 = job('A-1', null, 100), j2 = job('A-5', 'A-1', j1.end);
const back = j2.end + walkSeconds(a5, post);
const plan = { jobs: [j1, j2], back };
const near = (p: { x: number; z: number }, q: { x: number; z: number }, d = 1e-6) => Math.hypot(p.x - q.x, p.z - q.z) <= d;

test('no plan means idle at the post', () => {
  const p = staffPose('doll', null, 50);
  expect(p.phase).toBe('idle');
  expect(near(p, post)).toBe(true);
});

test('walks from the post after departing and works beside the machine facing it', () => {
  const start = staffPose('doll', plan, 100.01);
  expect(start.phase).toBe('walk');
  expect(Math.hypot(start.x - post.x, start.z - post.z)).toBeLessThan(0.2);
  const work = staffPose('doll', plan, (j1.arr + j1.put) / 2), m = machineAt('A-1');
  expect(work.phase).toBe('work');
  expect(near(work, a1)).toBe(true);
  expect(work.face).toBeCloseTo(Math.atan2(m.x - a1.x, m.z - a1.z));
  expect(work.k).toBeCloseTo(0.5);
  expect(staffPose('doll', plan, (j1.put + j1.end) / 2).phase).toBe('bow');
});

test('the second job walks straight from the first machine', () => {
  const p = staffPose('doll', plan, j2.dep + 0.01);
  expect(p.phase).toBe('walk');
  expect(Math.hypot(p.x - a1.x, p.z - a1.z)).toBeLessThan(0.2);
  expect(near(staffPose('doll', plan, j2.arr + 0.01), a5)).toBe(true);
});

test('walks back to the post after the last job and idles there', () => {
  const mid = staffPose('doll', plan, (j2.end + back) / 2);
  expect(mid.phase).toBe('walk');
  const done = staffPose('doll', plan, back + 1);
  expect(done.phase).toBe('idle');
  expect(near(done, post)).toBe(true);
});

test('a job queued after the walk back leaves from the post', () => {
  const ret = j1.end + walkSeconds(a1, post), later = job('A-5', null, ret);
  const p2 = { jobs: [j1, later], back: later.end + walkSeconds(a5, post) };
  expect(staffPose('doll', p2, (j1.end + ret) / 2).phase).toBe('walk'); // 돌아가는 중
  expect(near(staffPose('doll', p2, ret), post, 0.05)).toBe(true);
  expect(staffPose('doll', p2, later.dep + 0.01).phase).toBe('walk');
});

test('the same input gives the same pose', () => {
  expect(staffPose('doll', plan, 103.3)).toEqual(staffPose('doll', plan, 103.3));
});

// 2026-11-25 스크린샷: 미는 뽑기 판 화면 유리 너머로 대기 중인 직원이 보였다 — 판 화면(기계 앞)에선 손님처럼 숨기고,
// 내 기계로 일하러 오는(돌아가기까지) 직원만 보인다. 걷는 화면에선 모두 보인다
test('at a machine only the staff coming to that machine is shown', async () => {
  const { staffVisible } = await import('./staffSchedule');
  expect(staffVisible(null, null, 50)).toBe(true); // 걷는 화면
  expect(staffVisible(null, 'A-1', 50)).toBe(false); // 대기 중인 직원은 판 화면에서 숨김
  expect(staffVisible(plan, 'A-1', 100.5)).toBe(true);
  expect(staffVisible(plan, 'A-5', 100.5)).toBe(true); // 줄 선 내 기계
  expect(staffVisible(plan, 'A-9', 100.5)).toBe(false); // 남의 기계 일
  expect(staffVisible(plan, 'A-5', back + 0.1)).toBe(false); // 다 돌아간 뒤
});
