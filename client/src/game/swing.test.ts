import { expect, test } from 'vitest';
import { Swing } from './swing';

// 줄에 매달린 집게: 움직이다 멈추면 출렁이다가 잦아든다
test('claw swings after a stop and settles down', () => {
  const s = new Swing();
  for (let i = 0; i < 12; i++) s.update(1 / 60, 3, 0); // 오른쪽으로 가속
  let peak = 0;
  for (let i = 0; i < 90; i++) { s.update(1 / 60, 0, 0); peak = Math.max(peak, Math.abs(s.tiltX)); }
  expect(peak).toBeGreaterThan(0.03);
  for (let i = 0; i < 600; i++) s.update(1 / 60, 0, 0);
  expect(Math.abs(s.tiltX)).toBeLessThan(0.005);
});

test('a kick starts a swing', () => {
  const s = new Swing();
  s.kick(0.6, -0.4);
  let peak = 0;
  for (let i = 0; i < 60; i++) { s.update(1 / 60, 0, 0); peak = Math.max(peak, Math.hypot(s.tiltX, s.tiltZ)); }
  expect(peak).toBeGreaterThan(0.05);
});

// 덜 딱딱하게, 조금 더 오래 출렁인다 (설계 2026-10-31 §3.6)
test('a swing keeps rocking a little longer before it settles', () => {
  const s = new Swing();
  for (let i = 0; i < 12; i++) s.update(1 / 60, 3, 0);
  for (let i = 0; i < 60; i++) s.update(1 / 60, 0, 0);
  let peak = 0; // 1~2초 사이 가장 크게 기운 각 — 순간값은 출렁임 위상에 따라 0 근처일 수 있다
  for (let i = 0; i < 60; i++) { s.update(1 / 60, 0, 0); peak = Math.max(peak, Math.abs(s.tiltX)); }
  expect(peak).toBeGreaterThan(0.035);
});
