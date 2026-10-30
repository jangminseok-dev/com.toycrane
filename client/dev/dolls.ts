// 개발용: 인형 28종을 세트별로 4줄 세워 시제품과 비교한다 (npm run dev → /dev/dolls.html, 빌드에는 안 들어감)
import * as THREE from 'three';
import { SETS, DOLLS } from '../src/data/catalog';
import { makeDoll } from '../src/world/dolls';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2138);
scene.add(new THREE.HemisphereLight(0xf0d0ff, 0x553a6a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(2, 6, 5); scene.add(sun);
const lite = new URLSearchParams(location.search).has('lite');
const spins: { obj: THREE.Object3D; speed: number }[] = [];
SETS.forEach((set, row) => {
  Object.values(DOLLS).filter((d) => d.set === set.id).forEach((d, col) => {
    const doll = makeDoll(d.id, lite)!;
    doll.position.set((col - 3) * 1.25, 0, (row - 1.5) * 1.5);
    doll.rotation.y = -0.35;
    scene.add(doll);
    spins.push(...doll.userData.spin);
  });
});
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 7.5, 9.5); camera.lookAt(0, 0.3, 0.2);
renderer.setAnimationLoop((t) => {
  for (const s of spins) s.obj.rotation.y = (t / 1000) * s.speed;
  renderer.render(scene, camera);
});
