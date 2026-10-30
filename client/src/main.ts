// 임시 확인 화면(Task 8): 매장에서 내 캐릭터를 키보드·조이스틱으로 움직인다. Task 9에서 실제 입장 흐름으로 바뀐다.
import * as THREE from 'three';
import { followCamera } from './game/followCamera';
import { LocalPlayer } from './game/localPlayer';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { makeAvatar } from './world/avatar';
import { buildStore } from './world/storeScene';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
buildStore(scene);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 7, 11.4);

const me = new LocalPlayer({ x: 0, z: 2.4 });
const avatar = makeAvatar(0, '말랑 토끼');
scene.add(avatar.root);
const joystick = installJoystick(document.body);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 60 : 45;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const stick = joystick.read(), keys = readKeyboard();
  me.dir = Math.hypot(stick.x, stick.z) > 0 ? stick : keys;
  me.tick(dt);
  const moving = Math.hypot(me.dir.x, me.dir.z) > 0;
  avatar.root.position.set(me.pos.x, 0, me.pos.z);
  if (moving) avatar.root.rotation.y = Math.atan2(me.dir.x, me.dir.z);
  avatar.setWalking(moving);
  avatar.update(now / 1000);
  followCamera(camera, me.pos, dt);
  renderer.render(scene, camera);
});
