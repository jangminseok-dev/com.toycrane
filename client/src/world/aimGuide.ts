import * as THREE from 'three';

// 고리 걸기 겨냥 표시(사용자 2026-11-02 '집게가 어디를 노리는지 알 수 있게 조금 더 쉽게'): 벌린 두 팔 끝마다 곧장 아래로 가는 가는 줄과
// 닿을 곳(상자 윗면·고리 날개·선반)의 고리 표시. 고리 판(형광 연두)·흰 선반 위에서 또렷한 진분홍. 기계 좌표(anchor 자식)
const COLOR = 0xff2f86;
const LINE = new THREE.CylinderGeometry(0.0025, 0.0025, 1, 8).translate(0, 0.5, 0); // 밑이 원점, 높이 1 — 길이만큼 늘린다
const MARK = new THREE.RingGeometry(0.009, 0.017, 24).rotateX(-Math.PI / 2);

export type AimTip = { x: number; y: number; z: number; floor: number }; // 팔 끝 자리와 그 아래 닿는 높이
export type AimGuide = { set(tips: AimTip[]): void; dispose(): void };

export function buildAimGuide(anchor: THREE.Object3D): AimGuide {
  const group = new THREE.Group(); group.name = 'aim-guide';
  const lineMat = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.55, depthWrite: false });
  const markMat = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const parts = [0, 1].map((i) => {
    const line = new THREE.Mesh(LINE, lineMat), mark = new THREE.Mesh(MARK, markMat);
    line.name = `aim-line-${i}`; mark.name = `aim-mark-${i}`; line.renderOrder = mark.renderOrder = 4;
    group.add(line, mark);
    return { line, mark };
  });
  anchor.add(group);
  return {
    set(tips) {
      parts.forEach(({ line, mark }, i) => {
        const t = tips[i];
        line.visible = mark.visible = !!t;
        if (!t) return;
        line.position.set(t.x, t.floor, t.z); line.scale.set(1, Math.max(0.001, t.y - t.floor), 1);
        mark.position.set(t.x, t.floor + 0.003, t.z);
      });
    },
    dispose() { anchor.remove(group); lineMat.dispose(); markMat.dispose(); },
  };
}
