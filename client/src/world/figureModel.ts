import * as THREE from 'three';
import { DOLLS, GOLD, dollName } from '../data/catalog';
import { PLAIN } from './dolls';
import { FIGURE_WORD } from './copy';
import { makePlush } from './plush';
import { toon } from './toon';

// 피규어 생김새 C(9단계 설계 §3.6, 시안 client/src/spike/figure.ts ?only=c): 우리 인형 빌더 모양 그대로에서 천 주름 그늘(꼭짓점 색)을 빼고
// 광이 거의 없는 매끈한 비닐(거칠기 0.62), 외곽선·그린 얼굴은 그대로, 둥근 받침대. 황금은 광이 살짝 있는 금도금 —
// 매장에 반사 환경이 없어 금속감을 높이면 어둡게 보이므로 금속감 0.35·거칠기 0.4. 인형 희귀의 둘레 반짝이(aura)는 쓰지 않는다(효과는 상자 까기에서)
const VINYL = 0.62, GOLD_COLOR = 0xffcf4a, BASES = [0xffc6dc, 0xbdeedd, 0xd9c8ff, 0xffe2a8];
const goldVinyl = () => new THREE.MeshStandardMaterial({ color: GOLD_COLOR, metalness: 0.35, roughness: 0.4 });

function restyle(m: THREE.Material, gold: boolean): THREE.Material {
  if (m.side === THREE.BackSide || m.transparent) return m; // 외곽선·얼굴 그림은 그대로
  if (gold && (m as THREE.MeshMatcapMaterial).isMeshMatcapMaterial) return goldVinyl();
  const t = m as THREE.MeshToonMaterial;
  if (!t.isMeshToonMaterial) return m;
  return gold ? goldVinyl() : new THREE.MeshStandardMaterial({ color: t.color, map: t.map, roughness: VINYL, metalness: 0 });
}

export function makeFigure(kind: string, rare: string): THREE.Group {
  const out = new THREE.Group(), p = makePlush(kind, { ...PLAIN, face: 1, rare }, false);
  if (p) {
    const aura = p.group.getObjectByName('aura');
    aura?.parent?.remove(aura);
    const gold = rare === GOLD.id;
    p.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => restyle(x, gold)) : restyle(mesh.material, gold);
    });
    p.group.position.y = 0.08;
    out.add(p.group);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.08, 40), toon(BASES[(DOLLS[kind]?.name.length ?? 0) % BASES.length]));
  base.position.y = 0.04; base.name = 'figure-base';
  out.add(base);
  return out;
}

// 피규어 이름: 일반은 색 없이 캐릭터 이름, 희귀는 효과 이름 + 캐릭터, 황금은 '황금' + 캐릭터 — 끝에 '피규어'
export function figureName(kind: string, rare: string): string {
  return `${rare ? dollName(kind, 0, rare) : DOLLS[kind]?.name ?? kind} ${FIGURE_WORD}`;
}
