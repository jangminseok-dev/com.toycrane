// toycrane 화면: 게스트 확인 → 매장 배정 → 매장 웹소켓 → 함께 걷기. 끊기면 다시 배정부터.
import * as THREE from 'three';
import { followCamera } from './game/followCamera';
import { InputSampler } from './game/inputSampler';
import { LocalPlayer } from './game/localPlayer';
import { RemotePlayers } from './game/remotePlayers';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { admit, createGuest, getGuest, type Guest } from './net/api';
import { CLOSE_FULL, CLOSE_OTHER_TAB, CLOSE_UNKNOWN_GUEST, encodeMove, type ServerMsg } from './net/protocol';
import { nextDelay } from './net/reconnect';
import { StoreSocket, storeUrl } from './net/storeSocket';
import { askNickname, hideEntry, showFull, showMessage, showWelcomeBack } from './ui/entry';
import { setStatus } from './ui/status';
import { makeAvatar, type Avatar } from './world/avatar';
import { buildStore } from './world/storeScene';

const GUEST_KEY = 'toycrane.guestId';

// ---------- 무대 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#1c1526' });
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
buildStore(scene);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 7, 11.4);
const remotes = new RemotePlayers(scene);
const joystick = installJoystick(document.body);
let sampler = new InputSampler();

let me: LocalPlayer | null = null;
let myAvatar: Avatar | null = null;
let socket: StoreSocket | null = null;
let attempt = 0;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 60 : 45;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- 게스트 ----------
async function ensureGuest(): Promise<Guest> {
  const saved = localStorage.getItem(GUEST_KEY);
  if (saved) {
    const g = await getGuest(saved);
    if (g) { showWelcomeBack(g.nickname); return g; }
    localStorage.removeItem(GUEST_KEY);
  }
  let error: string | undefined;
  for (;;) {
    const made = await createGuest(await askNickname(error));
    if (made !== 'bad_nickname') { localStorage.setItem(GUEST_KEY, made.guestId); return made; }
    error = '닉네임은 1~10자로 해 주세요';
  }
}

// ---------- 입장·재접속 ----------
function retryLater(guest: Guest) {
  setStatus('다시 연결 중…');
  setTimeout(() => enter(guest), nextDelay(attempt++));
}

async function enter(guest: Guest): Promise<void> {
  let seat;
  try {
    seat = await admit(guest.guestId);
  } catch {
    return retryLater(guest); // 서버 배포 중·네트워크 끊김
  }
  if (seat === 'unknown_guest') return restart();
  if ('full' in seat) { await showFull(); return enter(guest); }
  socket = new StoreSocket(storeUrl(seat.store, guest.guestId), {
    onMessage: (m) => onMessage(m, guest),
    onClose: (code) => onClose(code, guest),
  });
}

function onMessage(m: ServerMsg, guest: Guest) {
  const now = performance.now();
  switch (m.t) {
    case 'welcome':
      attempt = 0;
      setStatus(null);
      hideEntry();
      remotes.clear();
      me = new LocalPlayer({ x: m.you.x, z: m.you.z });
      sampler = new InputSampler(); // 새로 들어오면 스폰 위치부터 다시 보낸다
      if (myAvatar) scene.remove(myAvatar.root);
      myAvatar = makeAvatar(m.you.color, guest.nickname);
      scene.add(myAvatar.root);
      for (const p of m.players) remotes.add(p, now);
      break;
    case 'join': remotes.add(m.p, now); break;
    case 'move': remotes.move(m, now); break;
    case 'leave': remotes.remove(m.id); break;
    case 'correct': me?.correct({ x: m.x, z: m.z }); break;
  }
}

function onClose(code: number, guest: Guest) {
  socket = null;
  remotes.clear();
  if (code === CLOSE_OTHER_TAB) return showMessage('이 창은 멈췄어요', '다른 창에서 접속해서 이 창은 멈췄어요. 새로 고침하면 이 창으로 다시 들어와요.');
  if (code === CLOSE_UNKNOWN_GUEST) return void restart();
  if (code === CLOSE_FULL) return void enter(guest); // 그 사이 찼으면 다른 매장으로
  retryLater(guest);
}

async function restart() {
  localStorage.removeItem(GUEST_KEY);
  enter(await ensureGuest());
}

// ---------- 매 프레임 ----------
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (me && myAvatar) {
    const stick = joystick.read();
    me.dir = Math.hypot(stick.x, stick.z) > 0 ? stick : readKeyboard();
    me.tick(dt);
    const moving = Math.hypot(me.dir.x, me.dir.z) > 0;
    myAvatar.root.position.set(me.pos.x, 0, me.pos.z);
    if (moving) myAvatar.root.rotation.y = Math.atan2(me.dir.x, me.dir.z);
    myAvatar.setWalking(moving);
    myAvatar.update(now / 1000);
    if (socket && sampler.shouldSend(me.dir, now)) socket.send(encodeMove(me.pos, me.dir));
    followCamera(camera, me.pos, dt);
  }
  remotes.update(now);
  renderer.render(scene, camera);
});

ensureGuest().then(enter);
