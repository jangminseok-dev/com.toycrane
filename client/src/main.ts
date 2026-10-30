// toycrane 화면: 게스트 확인 → 매장 배정 → 매장 웹소켓 → 함께 걷기. 끊기면 다시 배정부터.
import * as THREE from 'three';
import { followCamera } from './game/followCamera';
import { InputSampler } from './game/inputSampler';
import { LocalPlayer } from './game/localPlayer';
import { blocksView } from './game/occlusion';
import { RemotePlayers } from './game/remotePlayers';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { admit, createGuest, getGuest, type Guest } from './net/api';
import { encodeMove, type ServerMsg } from './net/protocol';
import { closeAction, nextDelay, retrying } from './net/reconnect';
import { safeStorage } from './net/storage';
import { StoreSocket, storeUrl } from './net/storeSocket';
import { askNickname, hideEntry, showFull, showMessage, showWelcomeBack } from './ui/entry';
import { setStatus } from './ui/status';
import { makeAvatar, type Avatar } from './world/avatar';
import { buildStore } from './world/storeScene';

const GUEST_KEY = 'toycrane.guestId';
const storage = safeStorage();
const reconnecting = () => setStatus('다시 연결 중…');

// ---------- 무대 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#1c1526' });
// 캔버스는 화면에 고정해 꽉 채운다 — 픽셀 폭을 박으면 휴대폰에서 페이지가 넓어져 축소돼 보인다
Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none' });
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const tower = buildStore(scene);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 7, 11.4);
const remotes = new RemotePlayers(scene);
const joystick = installJoystick(renderer.domElement);
let sampler = new InputSampler();

// 탑이 내 캐릭터를 가리면 탑을 흐리게(머리·몸통 중 하나라도 가리면)
const TOWER_FADED = 0.25;
let towerOpacity = 1;
const eyeLine = { head: new THREE.Vector3(), body: new THREE.Vector3() };
function fadeTowerIfBlocking(dt: number, at: { x: number; z: number }) {
  eyeLine.head.set(at.x, 1.2, at.z); eyeLine.body.set(at.x, 0.4, at.z);
  const blocked = blocksView(camera.position, eyeLine.head, tower.box) || blocksView(camera.position, eyeLine.body, tower.box);
  const goal = blocked ? TOWER_FADED : 1;
  towerOpacity += (goal - towerOpacity) * Math.min(1, dt * 8);
  if (Math.abs(goal - towerOpacity) < 0.01) towerOpacity = goal;
  tower.setOpacity(towerOpacity);
}

let me: LocalPlayer | null = null;
let myAvatar: Avatar | null = null;
let socket: StoreSocket | null = null;
let attempt = 0;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 60 : 45;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- 게스트 ----------
// 네트워크가 잠깐 끊겨도 멈추지 않게 서버 호출은 retrying으로 감싼다
async function ensureGuest(): Promise<Guest> {
  const saved = storage.get(GUEST_KEY);
  if (saved) {
    const g = await retrying(() => getGuest(saved), reconnecting);
    setStatus(null);
    if (g) { showWelcomeBack(g.nickname); return g; }
    storage.remove(GUEST_KEY);
  }
  let error: string | undefined;
  for (;;) {
    const nickname = await askNickname(error);
    const made = await retrying(() => createGuest(nickname), reconnecting);
    setStatus(null);
    if (made !== 'bad_nickname') { storage.set(GUEST_KEY, made.guestId); return made; }
    error = '닉네임은 1~10자로 해 주세요';
  }
}

// ---------- 입장·재접속 ----------
function retryLater(guest: Guest) {
  reconnecting();
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
      if (myAvatar) { scene.remove(myAvatar.root); myAvatar.dispose(); }
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
  const action = closeAction(code);
  if (action === 'stop') return showMessage('이 창은 멈췄어요', '다른 창에서 접속해서 이 창은 멈췄어요. 새로 고침하면 이 창으로 다시 들어와요.');
  if (action === 'restart') return void restart();
  retryLater(guest); // 만석·배포·끊김: 간격을 두고 다시 배정부터
}

async function restart() {
  storage.remove(GUEST_KEY);
  enter(await ensureGuest());
}

// 탭을 내리면 멈춤을 알린다 — 안 그러면 다른 사람 화면에서 계속 걸어가 보인다
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !socket || !me) return;
  me.dir = { x: 0, z: 0 };
  socket.send(encodeMove(me.pos, me.dir));
  sampler = new InputSampler();
});

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
    fadeTowerIfBlocking(dt, me.pos);
  }
  remotes.update(now);
  renderer.render(scene, camera);
});

ensureGuest().then(enter);
