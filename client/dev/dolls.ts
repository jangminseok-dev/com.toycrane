// 개발용: 인형 줄 세우기 (npm run dev → /dev/dolls.html, 빌드에는 안 들어감).
// 기본: 24종을 세트별 4줄로(색·표정을 돌려 가며). ?view=rare: 특수효과 8가지·황금·표정 5가지. ?lite: 기계 속 무더기용 모양
import * as THREE from 'three';
import { DOLLS, EFFECTS, SETS } from '../src/data/catalog';
import { PLAIN, makeDoll } from '../src/world/dolls';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2138);
scene.add(new THREE.HemisphereLight(0xf0d0ff, 0x553a6a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(2, 6, 5); scene.add(sun);
const query = new URLSearchParams(location.search), lite = query.has('lite');
const spins: { obj: THREE.Object3D; speed: number }[] = [];
const place = (kind: string, look: typeof PLAIN, col: number, row: number, cols: number, rows: number) => {
  const doll = makeDoll(kind, look, lite)!;
  doll.position.set((col - (cols - 1) / 2) * 1.25, 0, (row - (rows - 1) / 2) * 1.5);
  doll.rotation.y = -0.35;
  scene.add(doll);
  spins.push(...doll.userData.spin);
};
if (query.get('view') === 'rare') {
  EFFECTS.forEach((e, col) => place('bear', { ...PLAIN, rare: e.id }, col, 0, 8, 3));
  ['bear', 'bunny', 'penguin', 'fox', 'cat', 'dino', 'octopus', 'pig'].forEach((k, col) => place(k, { ...PLAIN, rare: 'gold', face: col % 5 }, col, 1, 8, 3));
  [0, 1, 2, 3, 4].forEach((face, col) => place('bear', { ...PLAIN, color: col, face }, col + 1.5, 2, 8, 3));
} else {
  SETS.forEach((set, row) => {
    Object.values(DOLLS).filter((d) => d.set === set.id).forEach((d, col) => place(d.id, { ...PLAIN, color: (col + row) % 6, face: (col + row) % 5 }, col, row, 6, 4));
  });
}
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 7.5, 9.5); camera.lookAt(0, 0.3, 0.2);
renderer.setAnimationLoop((t) => {
  for (const s of spins) s.obj.rotation.y = (t / 1000) * s.speed;
  renderer.render(scene, camera);
});
