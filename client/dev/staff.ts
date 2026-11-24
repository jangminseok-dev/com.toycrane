// 임시 개발용: 상주 직원(NPC) 생김새 시안 — 손님 캐릭터(makeAvatar)에 옷·소품만 더한다. ?only=a|b|c 면 하나만 크게
import * as THREE from 'three';
import { makeAvatar } from '../src/world/avatar';
import { SPH, cap, part, toon } from '../src/world/toon';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1f7);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfe6, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 8, 6); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshToonMaterial({ color: 0xe9e3f2 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const HALF = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const white = toon(0xffffff), navy = toon(0x2c2470), yellow = toon(0xffd36b);

// A 캡모자·앞치마: 남색 캡(챙) + 흰 앞치마 + 노란 이름 배지
function styleA(b: THREE.Group) {
  b.add(part(HALF, navy, [0, 1.6, -0.03], [0.64, 0.46, 0.63], [-0.12, 0, 0], 1.04));
  b.add(part(SPH, navy, [0, 1.66, 0.5], [0.36, 0.04, 0.24], [-0.12, 0, 0], 1.08));
  b.add(part(SPH, yellow, [0, 1.9, 0.33], [0.1, 0.07, 0.03], [-0.6, 0, 0], 1.1));
  b.add(part(SPH, white, [0, 0.55, 0.2], [0.3, 0.36, 0.14], [0, 0, 0], 1.05));
  for (const s of [-1, 1]) b.add(part(cap(0.025, 0.3), white, [s * 0.14, 0.88, 0.22], [1, 1, 1], [0.35, 0, s * 0.35], 1.1));
  b.add(part(SPH, yellow, [0.12, 0.66, 0.34], [0.07, 0.05, 0.02], [0, 0, 0], 1.15));
}
// B 형광 조끼·헤드셋: 주황 조끼(반사띠) + 머리 위 헤드셋과 마이크
function styleB(b: THREE.Group) {
  b.add(part(SPH, toon(0xff8a3d), [0, 0.62, 0], [0.38, 0.39, 0.34], [0, 0, 0], 1.04));
  b.add(part(SPH, toon(0xfff3c4), [0, 0.52, 0], [0.392, 0.04, 0.35], [0, 0, 0], 0));
  b.add(part(SPH, toon(0xfff3c4), [0, 0.7, 0], [0.392, 0.04, 0.35], [0, 0, 0], 0));
  const band = part(new THREE.TorusGeometry(0.6, 0.035, 8, 28, Math.PI), toon(0x3a3a4a), [0, 1.42, 0], [1, 1, 1], [0, 0, 0], 1.15);
  b.add(band);
  for (const s of [-1, 1]) b.add(part(SPH, toon(0x3a3a4a), [s * 0.6, 1.4, 0], [0.07, 0.12, 0.12], [0, 0, 0], 1.1));
  b.add(part(cap(0.02, 0.3), toon(0x3a3a4a), [0.42, 1.18, 0.3], [1, 1, 1], [0, 0.6, 1.2], 1.15));
}
// C 폴로셔츠·목걸이 명찰: 청록 셔츠 + 분홍 목줄 + 하얀 명찰 카드 + 머리띠
function styleC(b: THREE.Group) {
  b.add(part(new THREE.TorusGeometry(0.2, 0.018, 8, 24), toon(0xff7ab6), [0, 0.86, 0.12], [1, 1.3, 1], [1.2, 0, 0], 1.15));
  b.add(part(new THREE.BoxGeometry(0.2, 0.26, 0.03), white, [0, 0.62, 0.33], [1, 1, 1], [-0.2, 0, 0], 1.1));
  b.add(part(new THREE.BoxGeometry(0.2, 0.06, 0.035), toon(0x2bb3a3), [0, 0.72, 0.34], [1, 1, 1], [-0.2, 0, 0], 0));
  b.add(part(new THREE.TorusGeometry(0.58, 0.045, 8, 28, Math.PI), toon(0xff7ab6), [0, 1.46, 0.05], [1, 1, 1], [-0.25, 0, 0], 1.1));
}
// 야구모자: 머리를 덮는 둥근 윗부분 + 앞으로 내민 챙(살짝 아래로) + 꼭지 단추 + 앞 노란 배지
function baseballCap(b: THREE.Group, color: number) {
  const c = toon(color);
  b.add(part(HALF, c, [0, 1.6, -0.03], [0.64, 0.46, 0.63], [-0.12, 0, 0], 1.04));
  b.add(part(SPH, c, [0, 1.71, 0.55], [0.38, 0.045, 0.3], [0.12, 0, 0], 1.08));
  b.add(part(SPH, c, [0, 2.06, -0.08], [0.06, 0.035, 0.06], [0, 0, 0], 1.15));
  b.add(part(SPH, yellow, [0, 1.92, 0.4], [0.1, 0.07, 0.03], [-0.55, 0, 0], 1.1));
}
// C 옷(폴로셔츠·목걸이 명찰)에 머리띠 대신 야구모자
function styleCWithCap(color: number) {
  return (b: THREE.Group) => {
    b.add(part(new THREE.TorusGeometry(0.2, 0.018, 8, 24), toon(0xff7ab6), [0, 0.86, 0.12], [1, 1.3, 1], [1.2, 0, 0], 1.15));
    b.add(part(new THREE.BoxGeometry(0.2, 0.26, 0.03), white, [0, 0.62, 0.33], [1, 1, 1], [-0.2, 0, 0], 1.1));
    b.add(part(new THREE.BoxGeometry(0.2, 0.06, 0.035), toon(0x2bb3a3), [0, 0.72, 0.34], [1, 1, 1], [-0.2, 0, 0], 0));
    baseballCap(b, color);
  };
}
const LOOKS: Record<string, { name: string; color: number; dress: (b: THREE.Group) => void }> = {
  guest: { name: '손님(비교)', color: 0, dress: () => {} },
  a: { name: '직원', color: 2, dress: styleA },
  b: { name: '직원', color: 2, dress: styleB },
  c: { name: '직원', color: 7, dress: styleC },
  cn: { name: '직원', color: 7, dress: styleCWithCap(0x2c2470) },
  ct: { name: '직원', color: 7, dress: styleCWithCap(0x1f9e8f) },
};
const only = new URLSearchParams(location.search).get('only');
const set = new URLSearchParams(location.search).get('set');
const ids = only ? [only] : set ? set.split(',') : ['guest', 'a', 'b', 'c'];
const avatars = ids.map((id, k) => {
  const L = LOOKS[id], av = makeAvatar(L.color, L.name);
  L.dress(av.rig.bob);
  if (id !== 'guest') av.rig.backpack.visible = false; // 직원은 가방 없이
  av.root.position.set((k - (ids.length - 1) / 2) * 2.1, 0, 0);
  av.root.rotation.y = -0.35;
  scene.add(av.root);
  return av;
});
const far = new URLSearchParams(location.search).has('far'); // 게임 걷기 시점처럼 멀리 위에서
const camera = new THREE.PerspectiveCamera(far ? 45 : 26, innerWidth / innerHeight, 0.1, 100);
const w = ids.length * 2.1;
if (far) { camera.position.set(0, 9, 11); camera.lookAt(0, 0.6, 0); } else { camera.position.set(0, 3.2, Math.max(4.8, w * 1.05)); camera.lookAt(0, 1.05, 0); }
renderer.setAnimationLoop((t) => { for (const a of avatars) a.update(t / 1000); renderer.render(scene, camera); });
