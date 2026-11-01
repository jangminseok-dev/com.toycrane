import { expect, test } from 'vitest';
import { dollName } from '../data/catalog';
import { UI } from '../world/copy';
import { bagGroups } from './bagSheet';

const e = (doll: string, color: number, rare: string, zone: string, count: number, first_at: number) => ({ doll, color, rare, zone, count, first_at });

// 가방 보기(설계 2026-11-02 §5): 구역별(인형·피규어·고리·미는 뽑기 순)로 묶고, 칸마다 이름·개수·희귀 표시(★ 희귀, ★★ 황금),
// 처음 뽑은 때가 늦은 것이 위로. 큰 기계·작은 기계 인형은 한 구역 '인형'으로 합친다
test('bag sheet groups by zone with counts and rare marks', () => {
  const groups = bagGroups([
    e('bear', 0, '', 'big', 2, 10), e('fox', 3, 'gold', 'ring', 1, 30), e('cat', 1, 'star', 'pusher', 3, 40),
    e('penguin', 2, '', 'figure', 1, 20), e('dino', 0, '', 'mini', 1, 50), e('bear', 0, '', 'mini', 1, 60),
  ]);
  expect(groups.map((g) => g.title)).toEqual(['인형', '피규어', '고리', '미는 뽑기']);
  expect(groups[0].cells.map((c) => [c.doll, c.count])).toEqual([['dino', 1], ['bear', 3]]);
  expect(groups[2].cells[0]).toMatchObject({ name: dollName('fox', 3, 'gold'), count: 1, mark: '★★' });
  expect(groups[3].cells[0]).toMatchObject({ count: 3, mark: '★' });
  expect(groups[1].cells[0].mark).toBe('');
});

test('an empty bag shows no groups and says nothing was won yet', () => {
  expect(bagGroups([])).toEqual([]);
  expect(UI.bagEmpty).toBe('아직 뽑은 게 없어요');
});
