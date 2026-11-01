import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DOLLS, SETS } from '../data/catalog';
import type { DollLook } from '../net/protocol';
import { BODY_W, PLAIN } from '../world/dolls';
import { makePlush } from '../world/plush';
import { SPECIES } from '../world/plush/species';

// 인형 도감 시제품 (인형 리뉴얼 설계 §5.1, 개발 서버 전용 — vite build에는 들어가지 않는다).
// ?set=soft|forest|water|dream, ?kind=<id>, ?view=front|side|back|paws, ?face=0..4(기본 1 = 뜬 눈), ?look=variants, ?shot=1
const q = new URLSearchParams(location.search);
if (q.has('shot')) document.body.classList.add('shot');
const face = Number(q.get('face') ?? 1), kind = q.get('kind'), set = q.get('set'), view = q.get('view') ?? 'front';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6ebee);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;

// 시제품 v13과 같은 조명
scene.add(new THREE.HemisphereLight(0xfffaff, 0xe2cfd8, 0.9));
const key = new THREE.DirectionalLight(0xfff0e0, 2.6); key.position.set(2.5, 5, 4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 8; key.shadow.bias = -0.0004;
Object.assign(key.shadow.camera, { left: -12, bottom: -12, right: 12, top: 12 }); scene.add(key);
const fill = new THREE.DirectionalLight(0xeee6ff, 0.5); fill.position.set(-4, 2.5, 3); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 1.3); rim.position.set(-2, 4, -5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0xf1e3e8, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const labels: { el: HTMLDivElement; at: THREE.Vector3 }[] = [];
function place(id: string, look: DollLook, x: number, z: number, label: string): void {
  const p = makePlush(id, look, false);
  if (!p) return;
  const w = BODY_W[look.body];
  p.group.scale.set(w, 1, w); p.group.position.set(x, 0, z);
  scene.add(p.group);
  const el = document.createElement('div'); el.textContent = label;
  document.getElementById('labels')!.append(el);
  labels.push({ el, at: new THREE.Vector3(x, -0.05, z + 0.55) });
}

// 놓은 인형 전부가 화면에 들어오게 카메라를 앞쪽 위에서 맞춘다 (tilt = 위에서 내려다보는 정도)
function fit(tilt = 0.12): void {
  const box = new THREE.Box3();
  scene.updateMatrixWorld(true); // 놓은 그룹의 자리가 자식 메시에 반영되게
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== floor) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(size.y / (2 * t), size.x / (2 * t * camera.aspect)) * 1.18 + size.z / 2;
  camera.position.set(c.x, c.y + dist * tilt, c.z + dist); controls.target.copy(c);
}

const ready = Object.keys(SPECIES);
const hud = document.getElementById('hud')!;
hud.innerHTML = `<h1>인형 도감 시제품 (${ready.length}/24종)</h1>` +
  [['', '전부'], ...SETS.map((s) => [s.id, s.name])].map(([id, name]) => `<a href="?${id ? `set=${id}` : ''}">${name}</a>`).join('') +
  `<div>${ready.map((id) => `<a href="?kind=${id}">${DOLLS[id].name}</a>`).join('')}</div>`;

if (kind && q.get('look') === 'variants') {
  // 한 종의 변형: 색 6 · 표정 5 · 체형 3
  DOLLS[kind].palette.forEach((c, i) => place(kind, { ...PLAIN, color: i, face }, (i - 2.5) * 1.3, -1.5, c.name));
  for (let f = 0; f < 5; f++) place(kind, { ...PLAIN, face: f }, (f - 2) * 1.3, 0, `표정 ${f}`);
  (['n', 'c', 's'] as const).forEach((b, i) => place(kind, { ...PLAIN, body: b, face }, (i - 1) * 1.3, 1.5, { n: '보통', c: '통통', s: '날씬' }[b]));
  camera.position.set(0, 4.2, 9.5); controls.target.set(0, 0.5, 0);
} else if (kind) {
  place(kind, { ...PLAIN, face }, 0, 0, DOLLS[kind].name);
  const views: Record<string, [THREE.Vector3, THREE.Vector3]> = {
    front: [new THREE.Vector3(0, 0.75, 3.0), new THREE.Vector3(0, 0.52, 0)],
    side: [new THREE.Vector3(2.6, 0.8, 1.2), new THREE.Vector3(0, 0.5, 0)],
    back: [new THREE.Vector3(0.9, 0.9, -2.8), new THREE.Vector3(0, 0.45, 0)],
    paws: [new THREE.Vector3(0.1, 0.45, 1.6), new THREE.Vector3(0, 0.25, 0)],
  };
  const [pos, at] = views[view] ?? views.front;
  camera.position.copy(pos); controls.target.copy(at);
  if (view === 'front') fit(); // 귀가 긴 인형도 다 보이게
} else {
  // 세트마다 한 줄
  const rows = SETS.filter((s) => !set || s.id === set);
  rows.forEach((s, r) => {
    const ids = Object.keys(DOLLS).filter((id) => DOLLS[id].set === s.id && SPECIES[id]);
    ids.forEach((id, i) => place(id, { ...PLAIN, face }, (i - 2.5) * 1.5, (r - (rows.length - 1) / 2) * 2.2, DOLLS[id].name));
  });
  fit(0.35);
}
controls.update();

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const v = new THREE.Vector3();
let frames = 0;
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  for (const l of labels) { v.copy(l.at).project(camera); l.el.style.left = `${((v.x + 1) / 2) * innerWidth}px`; l.el.style.top = `${((1 - v.y) / 2) * innerHeight}px`; }
  if (++frames === 5) (window as Window & { __ready?: boolean }).__ready = true;
});
