import type * as THREE from 'three';

// 버튼으로 하는 기계(피규어·고리·미는 뽑기)의 한 판 — main.ts가 기계 종류와 상관없이 같은 길로 부른다(설계 2026-11-02 §8)
export type ButtonSession = { readonly machineId: string; remaining(now: number): number };

export interface ButtonPlay {
  readonly session: ButtonSession | null; // 버튼 단계
  readonly hint: string; // 판을 시작할 때 3초 안내
  handles(id: string): boolean;
  start(id: string, limit: number, now: number): void;
  pick(ray: THREE.Raycaster): 1 | 2 | null;
  press(button: 1 | 2): boolean;
  release(button: 1 | 2, now: number): void;
  frame(dt: number, now: number): void;
  cycling(): boolean; // 내 판의 결과를 그리는 중(캐릭터는 제자리)
  resulted(id: string): void; // 결과를 받았다 — 결과 기다리기 끝
  refused(id: string): void; // 서버가 거절(done_no)
  finished(id: string): Promise<void>; // 그 기계의 결과 그리기(찌르기·밀기)가 끝나면 — 당첨 카드는 그 뒤에
  readonly prizeWord: string; // 경품 이름 끝말(키링·미니 인형) — 피규어는 상자 까기라 따로
  end(): void;
  cameraPose(id: string, now: number, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 };
  buttonAt(button: 1 | 2, camera: THREE.Camera): { x: number; y: number } | null;
}
