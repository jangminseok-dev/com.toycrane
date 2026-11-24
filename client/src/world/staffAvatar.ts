// 상주 직원 생김새(설계 2026-11-24 store-staff, 사용자 고름 — 시안 dev/staff.ts의 ct): 손님 캐릭터와 같은 몸에
// 청록 폴로셔츠(몸 색 7)·청록 야구모자(챙·꼭지 단추·앞 노란 배지)·분홍 목줄과 흰 명찰. 가방은 없고 이름표는 '직원'
import * as THREE from 'three';
import { makeAvatar, type Avatar } from './avatar';
import { UI } from './copy';
import { SPH, part, toon } from './toon';

const SHIRT = 7, CAP = 0x1f9e8f;
const HALF = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const LANYARD = new THREE.TorusGeometry(0.2, 0.018, 8, 24), CARD = new THREE.BoxGeometry(0.2, 0.26, 0.03), STRIPE = new THREE.BoxGeometry(0.2, 0.06, 0.035);

function dress(b: THREE.Group): void {
  const cap = toon(CAP), white = toon(0xffffff), yellow = toon(0xffd36b);
  b.add(part(LANYARD, toon(0xff7ab6), [0, 0.86, 0.12], [1, 1.3, 1], [1.2, 0, 0], 1.15)); // 목줄
  b.add(part(CARD, white, [0, 0.62, 0.33], [1, 1, 1], [-0.2, 0, 0], 1.1)); // 명찰
  b.add(part(STRIPE, toon(0x2bb3a3), [0, 0.72, 0.34], [1, 1, 1], [-0.2, 0, 0], 0));
  b.add(part(HALF, cap, [0, 1.6, -0.03], [0.64, 0.46, 0.63], [-0.12, 0, 0], 1.04)); // 모자 윗부분
  b.add(part(SPH, cap, [0, 1.71, 0.55], [0.38, 0.045, 0.3], [0.12, 0, 0], 1.08)); // 챙
  b.add(part(SPH, cap, [0, 2.06, -0.08], [0.06, 0.035, 0.06], [0, 0, 0], 1.15)); // 꼭지 단추
  b.add(part(SPH, yellow, [0, 1.92, 0.4], [0.1, 0.07, 0.03], [-0.55, 0, 0], 1.1)); // 앞 배지
}

export function makeStaffAvatar(): Avatar {
  const av = makeAvatar(SHIRT, UI.staffName);
  dress(av.rig.bob);
  av.rig.backpack.visible = false;
  return av;
}
