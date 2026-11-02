import { ringSideOf } from '../data/hooks';
import { RINGS } from '../data/rings';
import { HookWorld } from '../physics/hookWorld';
import { UI } from '../world/copy';
import type { CameraPoses } from './figureCamera';
import type { BoxMachine } from './figurePlay';

// 고리 걸기 한 판(설계 2026-11-02 ring-hook §3): 피규어 판과 같은 흐름(버튼 ①②, 정면 → 옆 시점, 판 보고·구경), 세계만 HookWorld.
// 시점: 정면은 피규어와 같고, 옆은 옆 기계(1.84m 간격) 앞쪽 빈 곳에서 비스듬히 — 고리 구멍의 앞뒤 자리를 본다
export const RING_SPOTS = new Map(RINGS.map((r) => [r.id, r]));
const HOOK_POSES: CameraPoses = {
  // 옆은 오른쪽 앞 비스듬히 눈높이에서 — 상자 고리 판·쉬는 집게·조작대 버튼이 함께 보이게(사진 208: 위에서 내려다봐 버튼이 화면 아래로 잘렸다)
  wide: { front: [[0, 1.6, 2.0], [0, 1.35, 0]], side: [[1.1, 1.5, 1.55], [0, 1.3, 0.2]] },
  tall: { front: [[0, 1.6, 2.2], [0, 1.4, 0]], side: [[0.85, 1.6, 1.25], [0, 1.25, 0.2]] },
};
export const HOOK_MACHINE: BoxMachine = {
  spots: RING_SPOTS,
  makeWorld: (R, box, id) => new HookWorld(R, box, ringSideOf(id)),
  hint: UI.hookHint,
  camera: HOOK_POSES,
  aimGuide: true, // 팔 끝이 내려갈 자리(사용자 2026-11-02 '어디를 노리는지 알 수 있게')
};
