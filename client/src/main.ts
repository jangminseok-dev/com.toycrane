// toycrane 화면: 게스트 확인 → 매장 배정 → 매장 웹소켓 → 함께 걷기. 끊기면 다시 배정부터.
import * as THREE from 'three';
import { followCamera } from './game/followCamera';
import { InputSampler } from './game/inputSampler';
import { LocalPlayer } from './game/localPlayer';
import { machineCameraPose } from './game/machineCamera';
import { PlaySession } from './game/playSession';
import { QueueClient } from './game/queueClient';
import { OcclusionFader } from './game/occlusion';
import { RemotePlayers } from './game/remotePlayers';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { admit, createGuest, getGuest, type Guest } from './net/api';
import { encodeDrop, encodeMove, encodePlay, encodeQueue, encodeTake, encodeUnqueue, type ServerMsg } from './net/protocol';
import { closeAction, nextDelay, retrying } from './net/reconnect';
import { safeStorage } from './net/storage';
import { StoreSocket, storeUrl } from './net/storeSocket';
import { setAction } from './ui/actionButton';
import { askNickname, hideEntry, showFull, showMessage, showWelcomeBack } from './ui/entry';
import { setHud, setInfo, toast } from './ui/hud';
import { hidePlayControls, setTimer, showPlayControls } from './ui/playControls';
import { setStatus } from './ui/status';
import { makeAvatar, type Avatar } from './world/avatar';
import { DOLLS } from './data/catalog';
import { MACHINES, frontSpot, nearestMachine } from './data/storeLayout';
import { buildBigZone } from './world/bigZone';
import { CLAW_REST } from './world/machine';
import { buildCoinCounters } from './world/coinCounter';
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

const bigZone = buildBigZone(scene);
// 탑·기계 행·교환소가 내 캐릭터를 가리면 그것만 흐리게(머리·몸통 중 하나라도 가리면)
const fader = new OcclusionFader([tower, ...bigZone.occluders, ...buildCoinCounters(scene)]);

let me: LocalPlayer | null = null;
let wallet = { coins: 0, bag: 0 }; // 코인·가방 수 (서버가 알려 준 값)
let myId = '';
const queue = new QueueClient();
// 기계 한 판: 내가 하는 중(session) → 내리고 결과 기다림(awaiting). busy = 기계 → 하는 사람
let session: PlaySession | null = null;
let awaiting: string | null = null;
const busy = new Map<string, string>();
const spotOf = new Map(MACHINES.map((m) => [m.id, m]));
const camLook = new THREE.Vector3();
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
      for (const [id, spots] of Object.entries(m.machines)) bigZone.setContents(id, spots);
      wallet = { coins: m.coins, bag: m.bag };
      setHud(wallet.coins, wallet.bag);
      myId = m.you.id;
      queue.reset();
      m.queues.forEach((ids, c) => queue.onQueue(c, ids, myId, now / 1000));
      busy.clear();
      for (const [id, who] of Object.entries(m.plays)) busy.set(id, who);
      endPlay();
      break;
    case 'play': busy.set(m.m, m.id); break;
    case 'play_ok': startPlay(m.m, m.limit, m.coins); break;
    case 'play_no':
      if (m.why !== 'playing') toast({ busy: '다른 사람이 하는 중이에요', coins: '코인이 없어요 · 교환소에서 받아요', far: '기계 앞에 서 주세요' }[m.why]);
      break;
    case 'free':
      busy.delete(m.m);
      if (session?.machineId === m.m || awaiting === m.m) { endPlay(); toast('시간이 지나 기계가 풀렸어요'); }
      break;
    case 'result':
      busy.delete(m.m);
      if (m.id === myId) {
        toast(m.o === 'win' ? `짠! ${DOLLS[m.k ?? '']?.name ?? '인형'}` : m.o === 'slip' ? '아깝다! 놓쳤어요' : '헛잡았어요');
        setTimeout(endPlay, 1200); // 결과 모션은 Task 11
      }
      break;
    case 'machine': bigZone.setContents(m.m, m.dolls); break;
    case 'bag': wallet.bag = m.n; setHud(wallet.coins, wallet.bag); break;
    case 'queue': queue.onQueue(m.c, m.ids, myId, now / 1000); break;
    case 'queue_no': toast('줄이 꽉 찼어요'); break;
    case 'coins':
      wallet.coins = m.n;
      setHud(wallet.coins, wallet.bag);
      toast(m.got > 0 ? `🪙 +${m.got}` : '코인이 가득 찼어요');
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

// ---------- 기계 한 판 ----------
function startPlay(machineId: string, limit: number, coins: number) {
  wallet.coins = coins;
  setHud(wallet.coins, wallet.bag);
  busy.set(machineId, myId);
  session = new PlaySession(machineId, limit);
  setAction(null); setInfo(null);
  showPlayControls(() => { if (session?.requestDrop()) sendDrop(); });
  if (myAvatar) myAvatar.root.visible = false; // 정면 카메라를 가리지 않게 (다른 사람 화면에는 보임)
  bigZone.showAim(machineId, true);
  if (me && socket) { me.dir = { x: 0, z: 0 }; socket.send(encodeMove(me.pos, me.dir)); }
}

function sendDrop() {
  if (!session) return;
  socket?.send(encodeDrop(session.claw.x, session.claw.z));
  awaiting = session.machineId;
  session = null;
  hidePlayControls();
}

function endPlay() {
  const id = session?.machineId ?? awaiting;
  if (id) { bigZone.clawOf(id).position.copy(CLAW_REST); bigZone.showAim(id, false); }
  session = null; awaiting = null;
  hidePlayControls();
  if (myAvatar) myAvatar.root.visible = true;
}

// 기계 앞자리 가까이면 그 기계: 비었으면 "🪙1 넣고 하기", 남이 하면 구경 중
function showMachineUi(): boolean {
  if (!me) return false;
  const near = nearestMachine(me.pos);
  if (!near) return false;
  const who = busy.get(near.id);
  if (who && who !== myId) { setAction(null); setInfo('구경 중 · 다른 사람이 하는 중'); return true; }
  setInfo(null);
  if (wallet.coins > 0) setAction('🪙1 넣고 하기', () => socket?.send(encodePlay(near.id)));
  else setAction('코인이 없어요 · 교환소로', () => toast('허브의 코인 교환소에서 받아요'));
  return true;
}

// 교환소 줄: 진행 안내와 "줄 서기" 버튼
function showQueueUi(nowSec: number) {
  const st = queue.status(nowSec);
  setInfo(st.kind === 'waiting' ? `줄 서는 중 · ${st.place}번째` : st.kind === 'taking' ? '코인 받는 중…' : null);
  const entry = me && st.kind === 'none' ? queue.entryNear(me.pos) : null;
  setAction(entry !== null ? '줄 서기' : null, () => { if (entry !== null) socket?.send(encodeQueue(entry)); });
}

// ---------- 매 프레임 ----------
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (me && myAvatar) {
    const stick = joystick.read();
    const input = Math.hypot(stick.x, stick.z) > 0 ? stick : readKeyboard();
    const playing = session?.machineId ?? awaiting;
    if (session) {
      // 조이스틱·키가 집게를 움직이고 캐릭터는 기계 앞에 서 있다
      if (session.update(dt, input) === 'drop') sendDrop();
      else {
        setTimer(session.remaining);
        bigZone.clawOf(session.machineId).position.set(session.claw.x, CLAW_REST.y, session.claw.z);
      }
      me.autoTarget = frontSpot(spotOf.get(session.machineId)!); // 기계 앞자리 가운데로 (카메라 구도가 늘 같게)
      me.drive({ x: 0, z: 0 }, dt);
    } else if (!awaiting) {
      me.autoTarget = queue.target();
      me.drive(input, dt);
      const queueAction = queue.tick(me.pos, now / 1000);
      if (queueAction && socket) socket.send(queueAction === 'take' ? encodeTake() : encodeUnqueue());
      if (!showMachineUi()) showQueueUi(now / 1000);
    }
    const moving = Math.hypot(me.dir.x, me.dir.z) > 0 && !playing;
    myAvatar.root.position.set(me.pos.x, 0, me.pos.z);
    if (playing) myAvatar.root.rotation.y = spotOf.get(playing)!.ry + Math.PI; // 기계를 바라봄
    else if (moving) myAvatar.root.rotation.y = Math.atan2(me.dir.x, me.dir.z);
    myAvatar.setWalking(moving);
    myAvatar.update(now / 1000);
    if (socket && sampler.shouldSend(me.dir, now)) socket.send(encodeMove(me.pos, me.dir));
    if (playing) {
      // 기계 앞 위에서 유리 칸을 본다 (0.6초쯤에 걸쳐 부드럽게)
      const pose = machineCameraPose(spotOf.get(playing)!);
      camera.position.lerp(pose.pos, Math.min(1, dt * 5));
      camLook.lerp(pose.look, Math.min(1, dt * 5));
      camera.lookAt(camLook);
    } else {
      followCamera(camera, me.pos, dt);
      camLook.set(me.pos.x, 0.9, me.pos.z);
      fader.update(dt, camera.position, me.pos);
    }
  }
  remotes.update(now);
  bigZone.update(now / 1000);
  renderer.render(scene, camera);
});

ensureGuest().then(enter);
