// toycrane 화면: 게스트 확인 → 매장 배정 → 매장 웹소켓 → 함께 걷기. 끊기면 다시 배정부터.
import * as THREE from 'three';
import { followCamera } from './game/followCamera';
import { InputSampler } from './game/inputSampler';
import { LocalPlayer } from './game/localPlayer';
import { aimHeight } from './game/aim';
import { machineCameraPose } from './game/machineCamera';
import { MachineBusy } from './game/machineBusy';
import { PlaySession } from './game/playSession';
import { Tweens, ease } from './game/tween';
import { sfx, unlockAudio } from './audio/sfx';
import { QueueClient } from './game/queueClient';
import { OcclusionFader } from './game/occlusion';
import { RemotePlayers } from './game/remotePlayers';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { admit, createGuest, getGuest, type Guest } from './net/api';
import { encodeDrop, encodeMove, encodePlay, encodeQueue, encodeTake, encodeUnqueue, type DollSpot, type Result, type ServerMsg } from './net/protocol';
import { closeAction, nextDelay, retrying } from './net/reconnect';
import { safeStorage } from './net/storage';
import { StoreSocket, storeUrl } from './net/storeSocket';
import { setAction } from './ui/actionButton';
import { askNickname, hideEntry, showFull, showMessage, showWelcomeBack } from './ui/entry';
import { setHud, setInfo, toast } from './ui/hud';
import { eulReul } from './ui/josa';
import { hidePlayControls, setTimer, showPlayControls } from './ui/playControls';
import { showWinCard } from './ui/winCard';
import { setStatus } from './ui/status';
import { makeAvatar, type Avatar } from './world/avatar';
import { DOLLS, SETS } from './data/catalog';
import { MACHINES, MACHINE_SPEC, frontSpot, nearestMachine } from './data/storeLayout';
import { buildBigZone } from './world/bigZone';
import { makeDoll } from './world/dolls';
import { burst, updateEffects } from './world/effects';
import { CLAW_REST, DOLL_FLOOR } from './world/machine';
import { playResult, startPlaying } from './world/motions';
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
// 기계 한 판: 내가 하는 중(session) → 내리고 결과 기다림(awaiting, dropped). busy = 기계 → 하는 사람(판이 끝날 시간이 지나면 풀림)
let session: PlaySession | null = null;
let awaiting: string | null = null;
const busy = new MachineBusy(MACHINE_SPEC.play_seconds);
let dropped: PlaySession | null = null; // 내리고 결과를 기다리는 판 (8초 넘게 못 받으면 포기)
const clock = () => performance.now() / 1000;
const spotOf = new Map(MACHINES.map((m) => [m.id, m]));
const camLook = new THREE.Vector3();
// 연출: 기계마다 돌고 있는 코인·조이스틱 모션, 결과 연출 중인 기계, 연출이 끝나면 넣을 새 배치
const tw = new Tweens();
const playing = new Map<string, { stop(): Promise<void> }>();
const showing = new Set<string>();
const pendingContents = new Map<string, DollSpot[]>();
const spinners: { obj: THREE.Object3D; speed: number }[] = [];
let showingMe = false; // 내 결과 모션 중엔 걷지 않는다
let myNick = '';
let myAvatar: Avatar | null = null;
unlockAudio();
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
      myNick = guest.nickname;
      playing.clear(); showing.clear(); pendingContents.clear(); showingMe = false;
      queue.reset();
      m.queues.forEach((ids, c) => queue.onQueue(c, ids, myId, now / 1000));
      busy.reset();
      for (const [id, who] of Object.entries(m.plays)) busy.set(id, who, now / 1000);
      endPlay();
      break;
    case 'play': {
      busy.set(m.m, m.id, now / 1000);
      const rig = remotes.rigOf(m.id);
      if (rig) playing.set(m.m, startPlaying(rig, tw, spotOf.get(m.m)!.ry + Math.PI));
      break;
    }
    case 'play_ok': startPlay(m.m, m.limit, m.coins); break;
    case 'play_no':
      if (m.why !== 'playing') toast({ busy: '다른 사람이 하는 중이에요', coins: '코인이 없어요 · 교환소에서 받아요', far: '기계 앞에 서 주세요' }[m.why]);
      break;
    case 'free':
      busy.clear(m.m);
      void playing.get(m.m)?.stop(); playing.delete(m.m);
      if (session?.machineId === m.m || awaiting === m.m) { endPlay(); toast('시간이 지나 기계가 풀렸어요'); }
      break;
    case 'result': busy.clear(m.m); void showResult(m); break;
    case 'machine':
      if (showing.has(m.m)) pendingContents.set(m.m, m.dolls); // 집게·모션 연출이 끝난 뒤에 바꾼다
      else bigZone.setContents(m.m, m.dolls);
      break;
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
    case 'leave':
      // 나간 사람이 하던 기계도 푼다 (서버 free가 오지 않는 경우의 안전망)
      for (const id of busy.clearPlayer(m.id)) { void playing.get(id)?.stop(); playing.delete(id); }
      remotes.remove(m.id);
      break;
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
  busy.set(machineId, myId, clock());
  session = new PlaySession(machineId, limit, clock());
  setAction(null); setInfo(null);
  showPlayControls(() => { if (session?.requestDrop(clock())) sendDrop(); });
  if (myAvatar) {
    myAvatar.root.visible = false; // 정면 카메라를 가리지 않게 (다른 사람 화면에는 보임)
    playing.set(machineId, startPlaying(myAvatar.rig, tw, spotOf.get(machineId)!.ry + Math.PI, sfx.coin));
  }
  bigZone.showAim(machineId, true);
  if (me && socket) { me.dir = { x: 0, z: 0 }; socket.send(encodeMove(me.pos, me.dir)); }
}

function sendDrop() {
  if (!session) return;
  socket?.send(encodeDrop(session.claw.x, session.claw.z));
  bigZone.showAim(session.machineId, false);
  awaiting = session.machineId;
  dropped = session;
  session = null;
  hidePlayControls();
}

function endPlay() {
  const id = session?.machineId ?? awaiting;
  if (id) { bigZone.clawOf(id).position.copy(CLAW_REST); bigZone.showAim(id, false); }
  session = null; awaiting = null; dropped = null;
  hidePlayControls();
  if (myAvatar) myAvatar.root.visible = true;
}

// 결과 연출: 모두의 화면에서 같은 순서 — 쾅 → 두근두근(집게가 내려갔다 올라옴) → 성공(꺼내기·번쩍·가방에 쏙) / 실패(털썩)
async function showResult(m: Result) {
  showing.add(m.m);
  const mine = m.id === myId;
  if (mine) showingMe = true;
  await playing.get(m.m)?.stop(); playing.delete(m.m);
  const spot = spotOf.get(m.m)!, face = spot.ry + Math.PI;
  const info = m.k ? DOLLS[m.k] : undefined, rare = !!info?.rare;
  const front = frontSpot(spot);
  const near = mine || (!!me && Math.hypot(me.pos.x - front.x, me.pos.z - front.z) < 6);
  const rig = mine ? myAvatar?.rig ?? null : remotes.rigOf(m.id);
  const doll = m.o === 'win' && m.k ? makeDoll(m.k) : null;
  if (doll) spinners.push(...doll.userData.spin);
  const fx = {
    bonk: () => { if (near) sfx.bonk(); },
    claw: (seconds: number) => clawRun(m, seconds),
    afterClaw: () => { if (mine) { awaiting = null; if (myAvatar) myAvatar.root.visible = true; } },
    pop: () => { if (near) sfx.pop(); },
    win: () => {
      bigZone.flash(m.m, rare, 3.2);
      const at = new THREE.Vector3();
      (doll ?? bigZone.worldOf(m.m)).getWorldPosition(at); at.y += 0.3;
      burst(scene, at, rare ? [0xffd36b, 0xfff6b0, 0xff9f43, 0xffffff] : [0xff7ab6, 0x8fd3ff, 0xffe066, 0x8fe3c8], rare ? 80 : 36);
      if (rare) sfx.rare(); else if (near) sfx.win();
      if (rare && info) {
        const nick = mine ? myNick : remotes.nickOf(m.id);
        tower.showMessage('★ 희귀 등장! ★', `${nick} 님이 ${info.name}${eulReul(info.name)} 뽑았어요`, true, 6);
      }
      if (mine && info) showWinCard(info.name, SETS.find((x) => x.id === info.set)?.name ?? '', rare, wallet.bag);
      return rare ? 1.7 : 1.0;
    },
    fail: () => { if (mine) sfx.fail(); },
  };
  if (rig) await playResult(rig, tw, m.o, doll, fx, face);
  else { await clawRun(m, 1.7); fx.afterClaw(); }
  if (doll) spinners.splice(0, spinners.length, ...spinners.filter((s) => !doll.userData.spin.includes(s)));
  showing.delete(m.m);
  const next = pendingContents.get(m.m);
  if (next) { bigZone.setContents(m.m, next); pendingContents.delete(m.m); }
  if (mine) { showingMe = false; endPlay(); }
}

// 집게: 내린 자리로 옮겨 내려갔다 올라온다. 성공·놓침이면 노린 인형이 매달려 올라오고(놓침은 도중에 떨어짐)
function clawRun(m: Result, seconds: number): Promise<void> {
  const claw = bigZone.clawOf(m.m);
  claw.position.set(m.x, CLAW_REST.y, m.z);
  const before = bigZone.contentsOf(m.m);
  let carried: THREE.Group | null = null, dropped = false;
  // 노린 인형: 집게 위치에서 가장 가까운 그 종류
  const target = m.k && m.o !== 'miss'
    ? before.reduce<DollSpot | null>((best, d) => d[0] === m.k && (!best || Math.hypot(d[1] - m.x, d[2] - m.z) < Math.hypot(best[1] - m.x, best[2] - m.z)) ? d : best, null)
    : null;
  // 집게 손이 인형 머리(없으면 바닥) 바로 위까지 내려간다 — 얹힌 인형이면 덜 내려간다
  const depth = Math.max(0.3, CLAW_REST.y - (aimHeight(before, m.x, m.z) + 0.18));
  return tw.tween(seconds, (k) => {
    claw.position.y = CLAW_REST.y - Math.sin(k * Math.PI) * depth;
    if (target && !carried && k >= 0.5) {
      carried = makeDoll(target[0], true);
      if (carried) {
        carried.scale.setScalar(0.3); carried.position.set(0, DOLL_FLOOR + (target[4] ?? 0) - (CLAW_REST.y - depth), 0); claw.add(carried);
        bigZone.setContents(m.m, before.filter((d) => d !== target)); // 무더기에서 들어 올린다
      }
    }
    if (carried && m.o === 'slip' && !dropped && k >= 0.72) {
      dropped = true; claw.remove(carried); bigZone.setContents(m.m, before); // 미끄러져 제자리로
    }
  }, ease.lin).then(() => { if (carried && !dropped) claw.remove(carried); });
}

// 기계 앞자리 가까이면 그 기계: 비었으면 "🪙1 넣고 하기", 남이 하면 구경 중
function showMachineUi(): boolean {
  if (!me) return false;
  const near = nearestMachine(me.pos);
  if (!near) return false;
  const who = busy.who(near.id, clock());
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
    if (dropped && awaiting && dropped.resultOverdue(now / 1000)) { endPlay(); toast('결과를 받지 못했어요'); }
    const atMachine = session?.machineId ?? awaiting; // 기계 카메라를 쓰는 동안
    if (session) {
      // 조이스틱·키가 집게를 움직이고 캐릭터는 기계 앞에 서 있다
      if (session.update(dt, input, now / 1000) === 'drop') sendDrop();
      else {
        setTimer(session.remaining);
        const claw = bigZone.clawOf(session.machineId);
        claw.position.set(session.claw.x, CLAW_REST.y, session.claw.z);
        // 겨냥 고리는 집게 아래 인형 머리 위(없으면 바닥)에 놓는다
        claw.getObjectByName('aim')!.position.y = aimHeight(bigZone.contentsOf(session.machineId), session.claw.x, session.claw.z) - CLAW_REST.y;
      }
      me.autoTarget = frontSpot(spotOf.get(session.machineId)!); // 기계 앞자리 가운데로 (카메라 구도가 늘 같게)
      me.drive({ x: 0, z: 0 }, dt);
    } else if (showingMe) {
      me.drive({ x: 0, z: 0 }, dt); // 내 결과 모션 동안은 제자리
    } else if (!awaiting) {
      me.autoTarget = queue.target();
      me.drive(input, dt);
      const queueAction = queue.tick(me.pos, now / 1000);
      if (queueAction && socket) {
        socket.send(queueAction === 'take' ? encodeTake() : queueAction === 'unqueue' ? encodeUnqueue() : encodeQueue(queue.currentCounter!));
      }
      if (!showMachineUi()) showQueueUi(now / 1000);
    }
    const moving = Math.hypot(me.dir.x, me.dir.z) > 0 && !atMachine;
    myAvatar.root.position.set(me.pos.x, 0, me.pos.z);
    if (moving && !showingMe) myAvatar.root.rotation.y = Math.atan2(me.dir.x, me.dir.z); // 기계 앞에선 모션이 방향을 정한다
    myAvatar.setWalking(moving);
    myAvatar.update(now / 1000);
    if (socket && sampler.shouldSend(me.dir, now)) socket.send(encodeMove(me.pos, me.dir));
    if (atMachine) {
      // 기계 정면에서 유리 칸을 본다 (0.6초쯤에 걸쳐 부드럽게)
      const pose = machineCameraPose(spotOf.get(atMachine)!);
      camera.position.lerp(pose.pos, Math.min(1, dt * 5));
      camLook.lerp(pose.look, Math.min(1, dt * 5));
      camera.lookAt(camLook);
    } else {
      followCamera(camera, me.pos, dt);
      camLook.set(me.pos.x, 0.9, me.pos.z);
      fader.update(dt, camera.position, me.pos);
    }
  }
  tw.update(dt);
  updateEffects(dt);
  for (const sp of spinners) sp.obj.rotation.y += dt * sp.speed;
  remotes.update(now);
  bigZone.update(now / 1000);
  renderer.render(scene, camera);
});

ensureGuest().then(enter);
