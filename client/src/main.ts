// toycrane 화면: 게스트 확인 → 매장 배정 → 매장 웹소켓 → 함께 걷기. 끊기면 다시 배정부터.
import * as THREE from 'three';
import { CAMERA_OFFSETS, followCamera } from './game/followCamera';
import { InputSampler } from './game/inputSampler';
import { LocalPlayer } from './game/localPlayer';
import { aimHeight } from './game/aim';
import { machineCameraPose } from './game/machineCamera';
import { MachineBusy } from './game/machineBusy';
import { PlaySession } from './game/playSession';
import { Swing } from './game/swing';
import { runClaw } from './world/clawShow';
import { Tweens, ease } from './game/tween';
import { sfx, unlockAudio } from './audio/sfx';
import { QueueClient } from './game/queueClient';
import { OcclusionFader } from './game/occlusion';
import { RemotePlayers } from './game/remotePlayers';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { admit, createGuest, getGuest, type Guest } from './net/api';
import { encodeDrop, encodeMove, encodePlay, encodeQueue, encodeStand, encodeTake, encodeUnqueue, type DollSpot, type Result, type ServerMsg } from './net/protocol';
import { closeAction, nextDelay, retrying } from './net/reconnect';
import { safeStorage } from './net/storage';
import { StoreSocket, storeUrl } from './net/storeSocket';
import { setAction } from './ui/actionButton';
import { askNickname, hideEntry, showFull, showMessage, showWelcomeBack } from './ui/entry';
import { setHud, setInfo, toast } from './ui/hud';
import { eulReul } from './ui/josa';
import { hidePlayControls, hideSeatControls, setTimer, showPlayControls, showSeatControls } from './ui/playControls';
import { showWinCard } from './ui/winCard';
import { setStatus } from './ui/status';
import { makeAvatar, type Avatar } from './world/avatar';
import { DOLLS, SETS } from './data/catalog';
import { MACHINES, MACHINE_SPEC, frontSpot, nearestMachine } from './data/storeLayout';
import { buildBigZone } from './world/bigZone';
import { makeDoll } from './world/dolls';
import { burst, updateEffects } from './world/effects';
import { CLAW_REST } from './world/machine';
import { playResult, startPlaying } from './world/motions';
import { buildCoinCounters } from './world/coinCounter';
import { buildDecor } from './world/decor';
import { buildStore } from './world/storeScene';
import { ALL_COPY } from './world/copy';
import { loadFonts } from './ui/fonts';

const GUEST_KEY = 'toycrane.guestId';
const storage = safeStorage();
const reconnecting = () => setStatus('다시 연결 중…');

// ---------- 무대 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#f4f1f7' });
// 캔버스는 화면에 고정해 꽉 채운다 — 픽셀 폭을 박으면 휴대폰에서 페이지가 넓어져 축소돼 보인다
Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none' });
document.body.appendChild(renderer.domElement);
// 성능 측정용(client/e2e/perf.mjs): 마지막으로 그린 화면의 그리기 호출·삼각형 수
Object.assign(window, { __toycrane: { drawCalls: () => renderer.info.render.calls, triangles: () => renderer.info.render.triangles } });
await loadFonts(ALL_COPY); // 간판 글꼴(2.5초 안에 못 오면 시스템 글꼴)
const scene = new THREE.Scene();
const tower = buildStore(scene);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.copy(CAMERA_OFFSETS.WIDE); // 입장 후 내 자리로 따라간다
const remotes = new RemotePlayers(scene);
const joystick = installJoystick(renderer.domElement);
let sampler = new InputSampler();

const bigZone = buildBigZone(scene);
// 탑·기계 행·교환소가 내 캐릭터를 가리면 그것만 흐리게(머리·몸통 중 하나라도 가리면)
const fader = new OcclusionFader([tower, ...bigZone.occluders, ...buildCoinCounters(scene), ...buildDecor(scene)]);

let me: LocalPlayer | null = null;
let wallet = { coins: 0, bag: 0 }; // 코인·가방 수 (서버가 알려 준 값)
let myId = '';
const queue = new QueueClient();
// 기계 한 판: 내가 하는 중(session) → 내리고 결과 기다림(awaiting, dropped) → 판 사이(seated: 기계 앞 화면 그대로 "한 번 더·그만하기").
// busy = 기계 → 하는 사람(판이 끝날 시간, 판 사이엔 서버가 자리를 잡아 두는 시간이 지나면 풀림)
let session: PlaySession | null = null;
let awaiting: string | null = null;
let seated: string | null = null;
let holdFrom = 0; // 서버가 내 자리를 잡아 둔 시각(내 결과를 받은 때 = 내린 때) — 판 사이 남은 시간은 여기서 센다
const busy = new MachineBusy(MACHINE_SPEC.play_seconds, MACHINE_SPEC.hold_seconds);
let dropped: PlaySession | null = null; // 내리고 결과를 기다리는 판 (8초 넘게 못 받으면 포기)
const clock = () => performance.now() / 1000;
const spotOf = new Map(MACHINES.map((m) => [m.id, m]));
const camLook = new THREE.Vector3();
// 연출: 기계마다 돌고 있는 코인·조이스틱 모션, 결과 연출 중인 기계.
// 결과마다 표(ticket)를 두고, 바로 뒤에 오는 새 배치(machine)는 그 결과 연출이 끝난 뒤에 넣는다
const tw = new Tweens();
const playing = new Map<string, { stop(): Promise<void> }>();
const showing = new Set<string>();
type Ticket = { pending?: DollSpot[]; done: boolean };
const tickets = new Map<string, Ticket>();
// 한 기계의 연출은 차례대로: 이어서 하는 사람의 다음 판 모션·결과가 앞 판 결과 모션과 겹치지 않게
const chains = new Map<string, Promise<void>>();
function after(id: string, job: () => void | Promise<void>): void {
  chains.set(id, (chains.get(id) ?? Promise.resolve()).then(job).catch((e) => console.error(e)));
}
const spinners: { obj: THREE.Object3D; speed: number }[] = [];
// 움직이는 집게의 흔들림(진자): 기계마다 집게 위치에서 속도·가속도를 구해 매 프레임 기울인다
const swings = new Map<string, { swing: Swing; px: number; pz: number; vx: number; vz: number }>();
function swingOf(id: string): Swing {
  let s = swings.get(id);
  if (!s) { const c = bigZone.clawOf(id).position; s = { swing: new Swing(), px: c.x, pz: c.z, vx: 0, vz: 0 }; swings.set(id, s); }
  return s.swing;
}
function updateSwings(dt: number) {
  if (dt <= 0) return;
  for (const [id, s] of swings) {
    const rig = bigZone.rigOf(id), c = bigZone.clawOf(id).position;
    const vx = (c.x - s.px) / dt, vz = (c.z - s.pz) / dt;
    const ax = Math.max(-20, Math.min(20, (vx - s.vx) / dt)), az = Math.max(-20, Math.min(20, (vz - s.vz) / dt));
    s.px = c.x; s.pz = c.z; s.vx = vx; s.vz = vz;
    s.swing.update(dt, ax, az);
    if (rig) { rig.swing.rotation.z = s.swing.tiltX; rig.swing.rotation.x = -s.swing.tiltZ; }
    else { s.swing.reset(); swings.delete(id); }
  }
}
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
      playing.clear(); showing.clear(); tickets.clear(); chains.clear(); showingMe = false;
      queue.reset();
      m.queues.forEach((ids, c) => queue.onQueue(c, ids, myId, now / 1000));
      busy.reset();
      for (const [id, who] of Object.entries(m.plays)) busy.set(id, who, now / 1000);
      endPlay();
      break;
    case 'play':
      busy.set(m.m, m.id, now / 1000);
      after(m.m, () => {
        const rig = remotes.rigOf(m.id);
        if (rig && busy.who(m.m, clock()) === m.id) playing.set(m.m, startPlaying(rig, tw, spotOf.get(m.m)!.ry + Math.PI));
      });
      break;
    case 'play_ok': startPlay(m.m, m.limit, m.coins); break;
    case 'play_no':
      if (m.why !== 'playing') toast({ busy: '다른 사람이 하는 중이에요', coins: '코인이 없어요 · 교환소에서 받아요', far: '기계 앞에 서 주세요' }[m.why]);
      break;
    case 'free':
      busy.clear(m.m);
      void playing.get(m.m)?.stop(); playing.delete(m.m);
      if (session?.machineId === m.m || awaiting === m.m) { endPlay(); toast('시간이 지나 기계가 풀렸어요'); }
      else if (seated === m.m) { endPlay(); toast('자리를 비운 사이 다른 사람이 시작했어요'); }
      break;
    case 'result': {
      busy.hold(m.m, m.id, now / 1000); // 서버가 그 사람이 이어서 할 수 있게 자리를 잡아 둔다
      if (m.id === myId) holdFrom = now / 1000; // 집게 연출이 길어도 남은 시간은 서버와 같게
      const t: Ticket = { done: false };
      tickets.set(m.m, t);
      after(m.m, () => showResult(m, t));
      break;
    }
    case 'machine': {
      const t = tickets.get(m.m);
      if (t && !t.done) t.pending = m.dolls; // 집게·모션 연출이 끝난 뒤에 바꾼다
      else bigZone.setContents(m.m, m.dolls);
      break;
    }
    case 'bag': wallet.bag = m.n; setHud(wallet.coins, wallet.bag); break;
    case 'queue': queue.onQueue(m.c, m.ids, myId, now / 1000); break;
    case 'queue_no': toast('줄이 꽉 찼어요'); break;
    case 'coins':
      wallet.coins = m.n;
      setHud(wallet.coins, wallet.bag);
      toast(m.got > 0 ? `🪙 +${m.got}` : '코인이 가득 찼어요');
      if (seated) showSeat();
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
  seated = null; hideSeatControls();
  setAction(null); setInfo(null);
  showPlayControls(() => { if (session?.requestDrop(clock())) sendDrop(); });
  if (myAvatar) {
    myAvatar.root.visible = false; // 정면 카메라를 가리지 않게 (다른 사람 화면에는 보임)
    playing.set(machineId, startPlaying(myAvatar.rig, tw, spotOf.get(machineId)!.ry + Math.PI, sfx.coin));
  }
  bigZone.showAim(machineId, true);
  bigZone.activateClaw(machineId); // 움직이는 집게로 바꿔 끼운다 (흔들림이 보이게)
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
  const id = session?.machineId ?? awaiting ?? seated;
  if (id) {
    bigZone.clawOf(id).position.copy(CLAW_REST); bigZone.showAim(id, false);
    if (!showing.has(id)) bigZone.releaseClaw(id);
  }
  session = null; awaiting = null; dropped = null; seated = null;
  hidePlayControls(); hideSeatControls(); setInfo(null);
  if (myAvatar) myAvatar.root.visible = true;
}

// 판 사이: 기계 앞 화면 그대로 "🪙1 한 번 더 / 그만하기" — 그만하기 전까지 계속 뽑는다 (서버가 hold_seconds 동안 자리를 잡아 둔다)
function sitDown(machineId: string) {
  awaiting = null; dropped = null;
  seated = machineId;
  showSeat();
}
function showSeat() {
  const id = seated;
  if (!id) return;
  showSeatControls(wallet.coins > 0 ? () => socket?.send(encodePlay(id)) : null, standUp, () => toast('코인이 없어요 · 교환소에서 받아요'));
}
function standUp() {
  socket?.send(encodeStand());
  endPlay();
}

// 결과 연출. 남의 화면: 그 사람 캐릭터가 쾅 → 두근두근(집게가 내려갔다 올라옴) → 성공(꺼내기·번쩍·가방에 쏙) / 실패(털썩).
// 내 화면: 기계 앞 화면 그대로 집게 → 성공(번쩍·카드)/실패(소리) → 판 사이 버튼 (내 캐릭터는 숨어 있어 몸동작은 남의 화면에만)
async function showResult(m: Result, t: Ticket) {
  showing.add(m.m);
  const mine = m.id === myId;
  if (mine) showingMe = true;
  await playing.get(m.m)?.stop(); playing.delete(m.m);
  const spot = spotOf.get(m.m)!, face = spot.ry + Math.PI;
  const info = m.k ? DOLLS[m.k] : undefined, rare = !!info?.rare;
  const front = frontSpot(spot);
  const near = mine || (!!me && Math.hypot(me.pos.x - front.x, me.pos.z - front.z) < 6);
  const rig = mine ? null : remotes.rigOf(m.id);
  const doll = rig && m.o === 'win' && m.k ? makeDoll(m.k) : null;
  if (doll) spinners.push(...doll.userData.spin);
  const fx = {
    bonk: () => { if (near) sfx.bonk(); },
    claw: () => runClaw({ tw, zone: bigZone, swing: swingOf(m.m), takePending: () => { const p = t.pending; t.pending = undefined; return p; } }, m, near), // 멀리서는 귀·옆 인형 연출 생략
    afterClaw: () => { if (mine && awaiting === m.m) sitDown(m.m); },
    pop: () => { if (near) sfx.pop(); },
    win: () => {
      bigZone.flash(m.m, rare, 3.2);
      const at = new THREE.Vector3();
      (doll ?? bigZone.worldOf(m.m)).getWorldPosition(at); at.y += doll ? 0.3 : 1.2; // 캐릭터가 든 인형, 없으면 기계 유리 칸
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
  else { fx.bonk(); await fx.claw(); fx.afterClaw(); if (m.o === 'win') fx.win(); else fx.fail(); }
  if (doll) spinners.splice(0, spinners.length, ...spinners.filter((s) => !doll.userData.spin.includes(s)));
  showing.delete(m.m);
  if (t.pending) { bigZone.setContents(m.m, t.pending); t.pending = undefined; }
  t.done = true;
  if (mine) showingMe = false;
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
// three.js는 그리기 콜백이 한 번이라도 예외를 던지면 다음 프레임을 요청하지 않아 화면이 영영 멈춘다 — 한 프레임의 실수가 게임 전체를 멈추지 않게 잡아 둔다
renderer.setAnimationLoop((now) => {
  try { frame(now); } catch (e) { console.error(e); }
});
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (me && myAvatar) {
    const stick = joystick.read();
    const input = Math.hypot(stick.x, stick.z) > 0 ? stick : readKeyboard();
    if (dropped && awaiting && dropped.resultOverdue(now / 1000)) { endPlay(); toast('결과를 받지 못했어요'); }
    const atMachine = session?.machineId ?? awaiting ?? seated; // 기계 카메라를 쓰는 동안
    if (session) {
      // 조이스틱·키가 집게를 움직이고 캐릭터는 기계 앞에 서 있다.
      // 시간이 다 되면 여기서 내리고(sendDrop이 session을 비운다) — 그 뒤엔 session을 읽지 않는다 (읽으면 그리기 고리가 멈춘다)
      const playId = session.machineId;
      if (session.update(dt, input, now / 1000) === 'drop') sendDrop();
      else {
        setTimer(session.remaining);
        const claw = bigZone.clawOf(session.machineId);
        swingOf(session.machineId);
        claw.position.set(session.claw.x, CLAW_REST.y, session.claw.z);
        // 겨냥 고리는 집게 아래 인형 머리 위(없으면 바닥)에 놓는다
        claw.getObjectByName('aim')!.position.y = aimHeight(bigZone.contentsOf(session.machineId), session.claw.x, session.claw.z) - CLAW_REST.y;
      }
      me.autoTarget = frontSpot(spotOf.get(playId)!); // 기계 앞자리 가운데로 (카메라 구도가 늘 같게)
      me.drive({ x: 0, z: 0 }, dt);
    } else if (showingMe) {
      me.drive({ x: 0, z: 0 }, dt); // 내 결과 모션 동안은 제자리
    } else if (seated) {
      me.autoTarget = frontSpot(spotOf.get(seated)!); // 판 사이에도 기계 앞자리에 그대로
      me.drive({ x: 0, z: 0 }, dt);
      const left = MACHINE_SPEC.hold_seconds - (now / 1000 - holdFrom);
      setInfo(left > 0 ? `이어서 하기 · ${Math.ceil(left)}초` : null);
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
      fader.clear(dt);
    } else {
      followCamera(camera, me.pos, dt);
      camLook.set(me.pos.x, 0.8, me.pos.z - 0.6); // 걷기 카메라가 보는 곳 (기계 카메라로 넘어갈 때 이어지게)
      fader.update(dt, camera.position, me.pos);
    }
  }
  tw.update(dt);
  updateSwings(dt);
  updateEffects(dt);
  for (const sp of spinners) sp.obj.rotation.y += dt * sp.speed;
  remotes.update(now);
  bigZone.update(now / 1000);
  renderer.render(scene, camera);
}

ensureGuest().then(enter);
