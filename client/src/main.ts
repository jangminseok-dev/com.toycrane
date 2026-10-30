// 임시 확인 화면(Task 7): 매장 겉모습 + 탑 옆 아바타 하나. Task 9에서 실제 입장 흐름으로 바뀐다.
import * as THREE from 'three';
import { makeAvatar } from './world/avatar';
import { buildStore } from './world/storeScene';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
buildStore(scene);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const top = new URLSearchParams(location.search).has('top');
camera.position.set(0, top ? 34 : 7, top ? 6 : 13);
camera.lookAt(0, 0, top ? 0 : 2);

const avatar = makeAvatar(0, '말랑 토끼');
avatar.root.position.set(0, 0, 2.4);
scene.add(avatar.root);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
renderer.setAnimationLoop((t) => { avatar.update(t / 1000); renderer.render(scene, camera); });
