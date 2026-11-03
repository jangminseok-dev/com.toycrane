import { ringSideOf } from '../data/hooks';
import { RINGS } from '../data/rings';
import { HookWorld } from '../physics/hookWorld';
import { UI } from '../world/copy';
import type { CameraPoses } from './figureCamera';
import type { BoxMachine } from './figurePlay';

// 고리 걸기 한 판(설계 2026-11-02 ring-hook §3): 피규어 판과 같은 흐름(버튼 ①②, 정면 → 옆 시점, 판 보고·구경), 세계만 HookWorld.
// 시점: 정면은 피규어와 같고, 옆은 옆 기계(2.1m 간격) 조작대 앞에서 73° 옆으로 — 고리 구멍의 앞뒤 자리를 본다
export const RING_SPOTS = new Map(RINGS.map((r) => [r.id, r]));
const HOOK_POSES: CameraPoses = {
  // 옆은 오른쪽 73°(피규어처럼 옆면이 보이게, 사용자 2026-11-03 '너무 대각선')에서 살짝 내려다보며(15° 안팎, 사용자 같은 날 '위에서 아래로'), 상자에서 2m — 상자 고리 판·쉬는 집게·조작대 버튼이 함께 보이게
  // (사진 208: 위에서 내려다봐 버튼이 화면 아래로 잘렸다). 시선이 옆 기계 몸통을 뚫지 않게 기계 간격을 2.1m로 벌렸다.
  // 62°는 앞 오른쪽 기둥 너머 시선이 선반 앞 왼쪽을 지나 그쪽으로 끌려온 상자가 기둥 뒤에 숨었다(2026-11-03 휴대폰 R-8) — 73°면 그 시선이 선반 앞 끝 밖으로 빠진다
  wide: { front: [[0, 1.6, 2.0], [0, 1.35, 0]], side: [[1.95, 1.85, 0.9], [0, 1.3, 0.3]] },
  tall: { front: [[0, 1.6, 2.2], [0, 1.4, 0]], side: [[1.95, 1.8, 0.9], [0, 1.2, 0.3]] },
};
export const HOOK_MACHINE: BoxMachine = {
  spots: RING_SPOTS,
  makeWorld: (R, box, id) => new HookWorld(R, box, ringSideOf(id)),
  hint: UI.hookHint,
  camera: HOOK_POSES,
  aimGuide: true, // 팔 끝이 내려갈 자리(사용자 2026-11-02 '어디를 노리는지 알 수 있게')
};
