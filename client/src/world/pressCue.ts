import * as THREE from 'three';

// 지금 누를 버튼 둘레로 퍼지는 고리(사용자 2026-11-02 '반짝이는 걸 더 잘 보이게 — 저걸 눌러야 하는구나'): 버튼 색 고리 두 겹이
// 버튼 가장자리에서 반 박자씩 어긋나 PERIOD초마다 SPREAD배로 퍼지며 옅어진다. 조작대 윗면에 눕혀 놓는다(기계 좌표 at = 버튼 바닥)
const PERIOD = 1.0, SPREAD = 1.8, WIDTH = 0.012;
const RING = new THREE.RingGeometry(1 - WIDTH / 0.1, 1, 40);

export type PressCue = { group: THREE.Group; update(t: number, on: boolean): void };

export function makePressCue(name: string, color: number, radius: number, at: readonly [number, number, number]): PressCue {
  const group = new THREE.Group();
  group.name = name; group.position.set(at[0], at[1] + 0.002, at[2]); group.visible = false;
  const rings = [0, 0.5].map((offset) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(RING, mat);
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3;
    group.add(ring);
    return { ring, mat, offset };
  });
  return {
    group,
    update(t, on) {
      group.visible = on;
      if (!on) return;
      for (const { ring, mat, offset } of rings) {
        const k = (t / PERIOD + offset) % 1, s = radius * (1 + (SPREAD - 1) * k);
        ring.scale.set(s, s, 1);
        mat.opacity = 0.9 * (1 - k);
      }
    },
  };
}
