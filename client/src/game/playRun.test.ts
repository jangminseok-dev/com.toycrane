import { expect, test } from 'vitest';
import { PlayRun, runSize } from './playRun';

// 여러 판 이어 하기 (2026-10-31 사용자 결정): '다섯 판'을 고르면 판 사이에 묻지 않고 이어서, 코인이 모자라면 있는 만큼만
test('five plays go on by themselves until the fifth is played', () => {
  const run = new PlayRun();
  run.start(5, 10);
  for (let i = 1; i <= 4; i++) { run.began(); expect(run.next(10 - i)).toBe(true); }
  run.began();
  expect(run.next(5)).toBe(false);
});

test('a short wallet plays only what it has and shows progress', () => {
  const run = new PlayRun();
  run.start(5, 3);
  run.began();
  expect(run.label()).toBe('1/3판');
  run.began(); run.began();
  expect(run.next(0)).toBe(false);
});

test('stopping or running out of coins ends the run', () => {
  const run = new PlayRun();
  run.start(5, 5); run.began();
  expect(run.next(0)).toBe(false);
  run.stop();
  expect(run.next(4)).toBe(false);
  expect(run.label()).toBeNull();
});

test('a single play asks again between plays and shows no progress', () => {
  const run = new PlayRun();
  run.start(1, 9); run.began();
  expect(run.next(8)).toBe(false);
  expect(run.label()).toBeNull();
});

test('the several-plays button names how many plays the coins allow', () => {
  expect(runSize(15)).toEqual({ plays: 5, name: '다섯 판' });
  expect(runSize(3)).toEqual({ plays: 3, name: '세 판' });
  expect(runSize(1)).toBeNull();
});

test('between plays of a run it names the play that comes next', () => {
  const run = new PlayRun();
  run.start(5, 9); run.began();
  expect(run.label(true)).toBe('2/5판');
});

test('between plays it knows which play comes next', () => {
  const run = new PlayRun();
  run.start(5, 9); run.began();
  expect(run.upcoming()).toBe(2);
});

// 이어 하는 중 판 도중에도 "그만하기"가 보이게 — 이번 판 뒤에 더 할 판이 남았는지 (사용자 2026-11-01)
test('remaining counts the plays still to come after the current one', () => {
  const run = new PlayRun();
  expect(run.remaining()).toBe(0);
  run.start(5, 5); run.began();
  expect(run.remaining()).toBe(4);
  run.began(); run.began(); run.began(); run.began();
  expect(run.remaining()).toBe(0);
  run.start(5, 5); run.began(); run.stop();
  expect(run.remaining()).toBe(0);
});
