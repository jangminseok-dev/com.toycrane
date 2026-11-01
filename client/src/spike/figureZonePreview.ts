import * as THREE from 'three';
import { FIGURE, FIGURES, variantOf } from '../data/figures';
import { figureCameraPose } from '../game/figureCamera';
import { buildFigureZone } from '../world/figureZone';
import { playReveal } from '../world/figureReveal';

// 피규어 기계 미리보기(개발 전용): ?view=front|side|row, 집게는 상자 위에 내려와 반쯤 벌림
const q = new URLSearchParams(location.search), view = q.get('view') ?? 'front';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4f1f7);
scene.add(new THREE.HemisphereLight(0xffffff, 0xeee6f2, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(3, 14, 5); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshToonMaterial({ color: 0xeeeaf2 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const zone = buildFigureZone(scene), id = 'F-4', f = FIGURES[3];
const y = FIGURE.bars.y + FIGURE.bars.radius + variantOf('long').box.d / 2;
zone.setBox(id, [0.01, y, -0.01, 0, Math.sin(0.1), 0, Math.cos(0.1)]);
zone.setClaw(id, 0.0, 1.25, 0.06, 0.6);
const a = zone.worldOf(id);
a.updateMatrixWorld(true);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 100);
if (view === 'row') { camera.position.copy(a.localToWorld(new THREE.Vector3(0, 3.2, 6))); camera.lookAt(a.localToWorld(new THREE.Vector3(0, 1.2, 0))); }
else { const p = figureCameraPose(f, view === 'side' ? 1 : 0, camera.aspect); camera.position.copy(p.pos); camera.lookAt(p.look); }
// ?reveal=|star|gold — 카메라 앞 0.7m에서 상자 까기(?at=초에서 멈춤)
let reveal: { update(dt: number): boolean } | null = null, last = performance.now();
if (q.has('reveal')) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const at = camera.position.clone().addScaledVector(dir, 0.9).add(new THREE.Vector3(0, -0.15, 0));
  reveal = playReveal(scene, at, camera.position, q.get('kind') ?? 'cat', q.get('reveal') ?? '', () => {});
}
const stopAt = Number(q.get('at') ?? 1e9);
let shown = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (reveal && shown < stopAt) { reveal.update(dt); shown += dt; }
  renderer.render(scene, camera);
});
