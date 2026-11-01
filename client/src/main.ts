// toycrane 화면: 게스트 확인 → 매장 배정 → 매장 웹소켓 → 함께 걷기. 끊기면 다시 배정부터.
import * as THREE from 'three';
import { CAMERA_OFFSETS, followCamera } from './game/followCamera';
import { InputSampler } from './game/inputSampler';
import { LocalPlayer } from './game/localPlayer';
import { aimHeight, aimVisible } from './game/aim';
import { blocksView, machineCameraPose } from './game/machineCamera';
import { figureCameraPose } from './game/figureCamera';
import { FIGURE_SPOTS, FigurePlay } from './game/figurePlay';
import type { ButtonPlay } from './game/buttonPlay';
import { RingPlay } from './game/ringPlay';
import { MachineBusy } from './game/machineBusy';
import { PlaySession } from './game/playSession';
import { HoldLook } from './game/holdLook';
import { Swing } from './game/swing';
import { Tweens, ease } from './game/tween';
import { sfx, unlockAudio } from './audio/sfx';
import { AutoWalk, nearestCounter } from './game/autoWalk';
import { OcclusionFader } from './game/occlusion';
import { CoinShow } from './game/coinShow';
import { RemotePlayers } from './game/remotePlayers';
import { installJoystick } from './input/joystick';
import { readKeyboard } from './input/keyboard';
import { admit, createGuest, getGuest, type Guest } from './net/api';
import { encodeBeg, encodeCounterBeg, encodeDone, encodeGive, encodeMove, encodePlay, encodeStand, encodeTake, encodeTick, lookOf, uidOf, type Coins, type DollPose, type DollSpot, type Result, type ServerMsg } from './net/protocol';
import { loadRapier, rapierNow, rapierReady } from './physics/rapier';
import { MachineWorld } from './physics/machineWorld';
import { ClawBody } from './physics/clawBody';
import { CycleRunner } from './physics/clawCycle';
import { PoseReceiver, PoseSender } from './physics/relay';
import { CLAW } from './data/claw';
import { closeAction, nextDelay, retrying } from './net/reconnect';
import { safeStorage } from './net/storage';
import { StoreSocket, storeUrl } from './net/storeSocket';
import { setAction } from './ui/actionButton';
import { askNickname, hideEntry, showFull, showMessage, showWelcomeBack } from './ui/entry';
import { setHud, setInfo, toast } from './ui/hud';
import { eulReul, iGa } from './ui/josa';
import { hidePlayControls, hideSeatControls, setTimer, showHint, showPlayControls, showRunPause, showSeatControls } from './ui/playControls';
import { PlayRun, runSize } from './game/playRun';
import { buildMachineControls, type MachineControls } from './world/machineControls';
import { buildTopView, type TopView } from './world/topView';
import { showWinCard } from './ui/winCard';
import { setStatus } from './ui/status';
import { makeAvatar, type Avatar } from './world/avatar';
import { DOLLS, GOLD, SETS, dollName } from './data/catalog';
import { COUNTERS, MACHINES, MACHINE_SPEC, frontSpot, nearestMachine } from './data/storeLayout';
import { FIGURES, isFigure, nearestFigure } from './data/figures';
import { RINGS, nearestRing } from './data/rings';
import { buildBigZone, type LiveDolls } from './world/bigZone';
import { buildFigureZone } from './world/figureZone';
import { buildRingZone } from './world/ringZone';
import { figureName, makeFigure } from './world/figureModel';
import { PLAIN, makeDoll } from './world/dolls';
import { grounded } from './world/dollPose';
import { burst, updateEffects } from './world/effects';
import { CLAW_REST, CONTROLS, FELT_COLORS } from './world/machine';
import { CABLE_TOP } from './world/claw';
import { playGive, playHappy, playResult, playSulk, startBegging, startPlaying } from './world/motions';
import { buildCoinCounters } from './world/coinCounter';
import { buildDecor } from './world/decor';
import { buildStore } from './world/storeScene';
import { ALL_COPY, BEGGING, FIGURE_WORD, UI } from './world/copy';
import { openGiveSheet } from './ui/giveSheet';
import { blockSelect, installNoSelect } from './ui/noSelect';
// 창구 손 닿는 거리(서버 WINDOW_REACH 1.5m)보다 조금 안쪽 — 걷는 사이 위치가 조금 어긋나도 서버가 거절하지 않게
const COUNTER_REACH = 1.3, TAKE_LIMIT = 15, GIVE_REACH = 1.3;
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
installNoSelect(renderer.domElement); // 꾹 누르기(피규어 버튼)가 선택·끌기로 바뀌지 않게
document.addEventListener('selectstart', blockSelect);
// 성능 측정용(client/e2e/perf.mjs): 마지막으로 그린 화면의 그리기 호출·삼각형 수
// controlAt('lever'|'drop'): 하는 기계의 레버·하강 버튼 화면 자리(e2e가 누를 곳)
Object.assign(window, { __toycrane: {
  drawCalls: () => renderer.info.render.calls, triangles: () => renderer.info.render.triangles,
  contents: (id: string) => bigZone.contentsOf(id), // e2e: 이 화면이 아는 기계 속 배치
  physicsMs: () => (physicsMs.length ? physicsMs.reduce((a, b) => a + b, 0) / physicsMs.length : 0),
  settledIds: () => [...settledHere],
  watching: (id: string) => watches.has(id),
  controlAt: (part: 'lever' | 'drop') => {
    if (!session) return null;
    const [x, y, z] = CONTROLS[part];
    const p = bigZone.worldOf(session.machineId).localToWorld(new THREE.Vector3(x, y + 0.02, z)).project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  },
  // 피규어 기계(9단계): 누를 버튼 ①②의 화면 자리, 이 화면이 아는 상자 자리, 지금 옆 시점 정도(0 정면 ~ 1 옆)
  buttonAt: (b: 1 | 2) => activePlay()?.buttonAt(b, camera) ?? null,
  ringBoard: (id: string) => ringZone.boardOf(id),
  figureBox: (id: string) => figureZone.boxOf(id),
  figureSide: () => figurePlay.side.value(clock()),
} });
await loadFonts(ALL_COPY); // 간판 글꼴(2.5초 안에 못 오면 시스템 글꼴)
const scene = new THREE.Scene();
const tower = buildStore(scene);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.copy(CAMERA_OFFSETS.WIDE); // 입장 후 내 자리로 따라간다
const remotes = new RemotePlayers(scene);
const joystick = installJoystick(renderer.domElement);
let sampler = new InputSampler();

const bigZone = buildBigZone(scene);
const figureZone = buildFigureZone(scene); // 동쪽 피규어 기계 14대(9단계)
const ringZone = buildRingZone(scene); // 북쪽 고리 뽑기 10대(설계 2026-11-02)
// 탑·기계 행·교환소가 내 캐릭터를 가리면 그것만 흐리게(머리·몸통 중 하나라도 가리면)
const fader = new OcclusionFader([tower, ...bigZone.occluders, ...figureZone.occluders, ...ringZone.occluders, ...buildCoinCounters(scene), ...buildDecor(scene)]);

let me: LocalPlayer | null = null;
let wallet = { coins: 0, bag: 0 }; // 코인·가방 수 (서버가 알려 준 값)
let tickTimer = 0; // 다음 채울 시각에 서버를 깨우는 tick (stock 메시지)
let myId = '';
// 교환소에서 잠깐 보여 줄 상태 (조르기 쿨타임·가득 참 — 몇 초 뒤 사라짐)
let counterNote: { text: string; until: number } | null = null;
const walker = new AutoWalk(); // "코인이 없어요 · 교환소로": 가까운 교환소 줄 끝까지 저절로 걷기
// 기계 한 판: 내가 하는 중(session) → 내리고 결과 기다림(awaiting, dropped) → 판 사이(seated: 기계 앞 화면 그대로 "한 번 더·그만하기").
// busy = 기계 → 하는 사람(판이 끝날 시간, 판 사이엔 서버가 자리를 잡아 두는 시간이 지나면 풀림)
let session: PlaySession | null = null;
let awaiting: string | null = null;
let seated: string | null = null;
let holdFrom = 0; // 서버가 내 자리를 잡아 둔 시각(내 결과를 받은 때 = 내린 때) — 판 사이 남은 시간은 여기서 센다
const busy = new MachineBusy(MACHINE_SPEC.play_seconds, MACHINE_SPEC.hold_seconds, CLAW.cycle_seconds + CLAW.settle_seconds);
let dropped: PlaySession | null = null; // 내리고 결과를 기다리는 판 (8초 넘게 못 받으면 포기)
const clock = () => performance.now() / 1000;
const spotOf = new Map<string, { x: number; z: number; ry: number }>([...MACHINES, ...FIGURES, ...RINGS].map((m) => [m.id, m])); // 인형·피규어·고리 기계
// 피규어 한 판(9단계): 버튼·물리·중계·상자 까기는 FigurePlay가 맡고, 판 사이 흐름(awaiting·seated·이어 하기)은 인형 판과 함께 쓴다
const figurePlay = new FigurePlay(scene, figureZone, {
  send: (msg) => socket?.send(msg),
  rapier: rapierNow,
  onDrop: (id) => { awaiting = id; hidePlayControls(); },
  onOverdue: () => { endPlay(); toast('결과를 받지 못했어요'); },
});
// 고리 뽑기 한 판(설계 2026-11-02 §3): 결과는 서버가 정하고 ring 메시지로 모두가 같은 찌르기를 그린다
const ringPlay = new RingPlay(ringZone, {
  send: (msg) => socket?.send(msg),
  onDrop: (id) => { awaiting = id; hidePlayControls(); },
  onOverdue: () => { endPlay(); toast('결과를 받지 못했어요'); },
});
// 버튼으로 하는 기계들 — 판 흐름(시작·누르기·결과 기다리기·그만하기·시점)은 같은 길로
const buttonPlays: ButtonPlay[] = [figurePlay, ringPlay];
const playFor = (id: string) => buttonPlays.find((p) => p.handles(id)) ?? null;
const activePlay = () => buttonPlays.find((p) => p.session) ?? null;
const camLook = new THREE.Vector3();
// 연출: 기계마다 돌고 있는 코인·조이스틱 모션, 결과 연출 중인 기계.
// 결과마다 표(ticket)를 두고, 바로 뒤에 오는 새 배치(machine)는 그 결과 연출이 끝난 뒤에 넣는다
const tw = new Tweens();
const playing = new Map<string, { stop(): Promise<void> }>();
const showing = new Set<string>();
type Ticket = { pending?: DollSpot[]; done: boolean; gen: number };
const tickets = new Map<string, Ticket>();
const playGen = new Map<string, number>(); // 기계별 판 세대 — play마다 하나씩 올라간다. 앞 판의 machine이 다음 판의 구경·물리를 끊지 않게 (최종 리뷰 I5)
const genOf = (id: string) => playGen.get(id) ?? 0;
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
      setMyBegging(false); coinShow.reset(); // 다시 들어오면 서버에는 조르기가 없다 (최종 리뷰 I2)
      me = new LocalPlayer({ x: m.you.x, z: m.you.z });
      sampler = new InputSampler(); // 새로 들어오면 스폰 위치부터 다시 보낸다
      if (myAvatar) { scene.remove(myAvatar.root); myAvatar.dispose(); }
      myAvatar = makeAvatar(m.you.color, guest.nickname);
      scene.add(myAvatar.root);
      for (const p of m.players) { remotes.add(p, now); if (p.beg != null) remotes.setBegging(p.id, p.beg, tw); }
      scheduleRapier(); // 물리 모듈은 입장 뒤 한가할 때 받는다 (물리 뽑기 설계 §4.1)
      for (const [id, spots] of Object.entries(m.machines)) bigZone.setContents(id, spots.map(grounded));
      figurePlay.clearWatches(); figurePlay.setBoxes(m.figures); ringPlay.setBoards(m.rings);
      wallet = { coins: m.coins, bag: m.bag };
      setHud(wallet.coins, wallet.bag);
      myId = m.you.id;
      myNick = guest.nickname;
      playing.clear(); showing.clear(); tickets.clear(); chains.clear(); showingMe = false;
      for (const id of [...watches.keys()]) stopWatch(id); playGen.clear(); // 다시 들어오면 구경도 처음부터 (최종 리뷰 I6)
      busy.reset();
      for (const [id, who] of Object.entries(m.plays)) busy.set(id, who, now / 1000);
      endPlay();
      break;
    case 'play':
      busy.set(m.m, m.id, now / 1000);
      playGen.set(m.m, genOf(m.m) + 1);
      if (m.id !== myId) { // 남의 판: 그 기계의 인형(피규어는 상자)을 따로 그리고 중계(pose)를 기다린다
        if (!isFigure(m.m)) startWatch(m.m);
        else if (me) figurePlay.watch(m.m, me.pos);
      }
      else if (cycle?.machineId === m.m) cycle.gen = genOf(m.m); // 내 판의 물리는 play_ok에서 먼저 만들어졌다
      after(m.m, () => {
        const rig = remotes.rigOf(m.id);
        if (rig && busy.who(m.m, clock()) === m.id) playing.set(m.m, startPlaying(rig, tw, spotOf.get(m.m)!.ry + Math.PI));
      });
      break;
    case 'play_ok': { const bp = playFor(m.m); if (bp) startButtonPlay(bp, m.m, m.limit, m.coins); else startPlay(m.m, m.limit, m.coins); break; }
    case 'done_no': onDoneNo(m.m); break;
    case 'pose': watches.get(m.m)?.receiver.push(m, now / 1000); figurePlay.onPose(m, now / 1000); break;
    case 'play_no':
      if (m.why !== 'playing') toast({ busy: '다른 사람이 하는 중이에요', coins: UI.noCoinsToast, far: '기계 앞에 서 주세요' }[m.why]);
      if (seated === m.m) { run.stop(); nextRunAt = null; showSeat(); } // 이어 하던 판을 못 시작했으면 멈추고 다시 묻는다
      break;
    case 'free':
      busy.clear(m.m);
      stopWatch(m.m); figurePlay.stopWatch(m.m);
      void playing.get(m.m)?.stop(); playing.delete(m.m);
      if (session?.machineId === m.m || activePlay()?.session?.machineId === m.m || awaiting === m.m) { endPlay(); toast('시간이 지나 기계가 풀렸어요'); }
      else if (seated === m.m) { endPlay(); toast('자리를 비운 사이 다른 사람이 시작했어요'); }
      break;
    case 'result': {
      busy.hold(m.m, m.id, now / 1000); // 서버가 그 사람이 이어서 할 수 있게 자리를 잡아 둔다
      if (m.id === myId) { holdFrom = now / 1000; playFor(m.m)?.resulted(m.m); } // 보고한 때 = 서버가 자리를 잡아 둔 때
      const t: Ticket = { done: false, gen: genOf(m.m) };
      tickets.set(m.m, t);
      after(m.m, () => (isFigure(m.m) ? showFigureResult(m, t) : playFor(m.m) ? showPrizeResult(m, t) : showResult(m, t)));
      break;
    }
    case 'machine': {
      const t = tickets.get(m.m);
      if (t && !t.done) t.pending = m.dolls; // 집게·모션 연출이 끝난 뒤에 바꾼다
      else applyMachine(m.m, m.dolls, genOf(m.m));
      break;
    }
    case 'figure': { // 피규어 상자 자리(판 뒤·새 상자·직원이 옮김) — 판의 끝이니 그 기계 구경도 끝
      figurePlay.stopWatch(m.m); figurePlay.setBox(m.m, m.box);
      const f = FIGURE_SPOTS.get(m.m);
      if (m.nudged && f && me && Math.hypot(me.pos.x - frontSpot(f).x, me.pos.z - frontSpot(f).z) < 6) toast(UI.figureNudged);
      break;
    }
    case 'ring': ringPlay.onRing(m); break;
    case 'bag': wallet.bag = m.n; setHud(wallet.coins, wallet.bag); break;
    case 'spawn': announceSpawn(m.m, m.k, m.rv); break;
    case 'stock':
      // 다음 채울 시각이 지나면 서버를 깨운다 (아무도 움직이지 않아도 제때 채우게) — 매장 사람들이 한꺼번에 보내지 않게 조금씩 흩는다
      clearTimeout(tickTimer);
      if (m.in !== null) tickTimer = window.setTimeout(() => socket?.send(encodeTick()), (m.in + Math.random() * 1.5) * 1000);
      break;
    case 'take_no':
      if (m.why === 'far') toast(UI.giveNo.far);
      else counterNote = { text: UI.enough, until: now / 1000 + 3 };
      break;
    case 'cbeg': void counterBegShow(m.id, m.c, m.n); break;
    case 'beg':
      if (m.id === myId) setMyBegging(m.room !== null);
      else remotes.setBegging(m.id, m.room, tw);
      break;
    case 'gave':
      if (m.to === myId) coinShow.gaveMe();
      void gaveShow(m.from, m.to, m.n);
      break;
    case 'give_no': toast(UI.giveNo[m.why] ?? UI.giveNo.poor); break;
    case 'cbeg_no': {
      const text = m.why === 'wait' ? UI.begWait(Math.max(1, Math.ceil(m.wait / 60))) : m.why === 'full' ? UI.full : UI.giveNo.far;
      if (m.why === 'wait') coinShow.holdNote(text); // 바로 앞의 cbeg(0개)로 시작한 조르는 모션이 끝나면 보인다
      else { counterNote = { text, until: now / 1000 + 4 }; endCounterBeg(); }
      break;
    }
    case 'coins': {
      const { show, toast: plus } = coinShow.coins(m);
      if (show) showCoins(show);
      if (plus) toast(`🪙 +${m.got}`); // 준 사람(got<0)·받은 사람에게는 '줬어요' 알림이 따로 간다
      break;
    }
    case 'join': remotes.add(m.p, now); if (m.p.beg != null) remotes.setBegging(m.p.id, m.p.beg, tw); break;
    case 'move': remotes.move(m, now); break;
    case 'leave':
      // 나간 사람이 하던 기계도 푼다 (서버 free가 오지 않는 경우의 안전망)
      for (const id of busy.clearPlayer(m.id)) { void playing.get(id)?.stop(); playing.delete(id); stopWatch(id); }
      remotes.remove(m.id);
      break;
    case 'correct': me?.correct({ x: m.x, z: m.z }); break;
  }
}

function onClose(code: number, guest: Guest) {
  socket = null;
  remotes.clear();
  setMyBegging(false); coinShow.reset();
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
  run.began();
  seated = null; nextRunAt = null; hideSeatControls();
  if (run.current() >= 2) showRunPause(quitRun); // 이어 하는 둘째 판부터는 그만하기가 내내 보인다 — 누르면 바로 일어난다 (사용자 2026-11-01)
  setAction(null); setInfo(null);
  showPlayControls(); showHint();
  dropControls();
  controls = buildMachineControls(bigZone.worldOf(machineId)); controlsAt = machineId;
  bigZone.hideControls(machineId, true); // 기계 그림의 고정 레버·버튼은 숨긴다 — 남으면 기울일 때 잔상처럼 하나 더 보인다
  topView?.dispose(); // 뒷판 모니터: 위에서 본 기계 안 (설계 §3.9)
  topView = buildTopView(renderer, scene, bigZone.worldOf(machineId), FELT_COLORS[MACHINES.findIndex((m) => m.id === machineId) % FELT_COLORS.length]);
  if (myAvatar) {
    myAvatar.root.visible = false; // 정면 카메라를 가리지 않게 (다른 사람 화면에는 보임)
    playing.set(machineId, startPlaying(myAvatar.rig, tw, spotOf.get(machineId)!.ry + Math.PI, sfx.coin));
  }
  bigZone.showAim(machineId, true);
  bigZone.activateClaw(machineId); // 움직이는 집게로 바꿔 끼운다 (흔들림이 보이게)
  // 기계 속 물리 세계(물리 뽑기 설계 §4.4): 안 앉은 인형이 있으면 먼저 앉히고, 한 판 동안 인형을 따로 그린다
  const R = rapierNow();
  if (R) {
    settleMachine(machineId);
    dropCycle(); stopWatch(machineId);
    const world = new MachineWorld(R, bigZone.contentsOf(machineId));
    cycle = { machineId, gen: genOf(machineId), world, runner: null, claw: null, live: bigZone.live(machineId), before: bigZone.contentsOf(machineId), reported: false, look: new HoldLook(), wasHolding: false };
  }
  if (me && socket) { me.dir = { x: 0, z: 0 }; socket.send(encodeMove(me.pos, me.dir)); }
}

// 피규어 한 판(9단계 설계 §3.3): 조작대 버튼 ①② + 정면 시점. 판 사이 흐름(이어 하기·그만하기)은 인형 판과 같다
function startButtonPlay(play: ButtonPlay, machineId: string, limit: number, coins: number) {
  wallet.coins = coins;
  setHud(wallet.coins, wallet.bag);
  busy.set(machineId, myId, clock());
  run.began();
  seated = null; nextRunAt = null; hideSeatControls();
  if (run.current() >= 2) showRunPause(quitRun);
  setAction(null); setInfo(null);
  showPlayControls(); showHint(play.hint);
  play.start(machineId, limit, clock());
  if (myAvatar) {
    myAvatar.root.visible = false; // 정면 카메라를 가리지 않게 (다른 사람 화면에는 보임)
    playing.set(machineId, startPlaying(myAvatar.rig, tw, spotOf.get(machineId)!.ry + Math.PI, sfx.coin));
  }
  if (me && socket) { me.dir = { x: 0, z: 0 }; socket.send(encodeMove(me.pos, me.dir)); }
}

// 내 판의 물리: 레버 동안은 세계만 들고 있다가, 내리면 집게 한 바퀴(CycleRunner)를 프레임마다 돌린다. 끝나면 done 보고
type Cycle = { machineId: string; gen: number; world: MachineWorld; runner: CycleRunner | null; claw: ClawBody | null; live: LiveDolls; before: DollSpot[]; reported: boolean; look: HoldLook; wasHolding: boolean };
let cycle: Cycle | null = null;
const TOP_Y = CLAW_REST.y + CABLE_TOP;
function dropCycle() {
  if (!cycle) return;
  cycle.claw?.dispose(); cycle.world.dispose(); cycle.live.dispose();
  cycle = null;
}
const physicsMs: number[] = []; // 최근 프레임의 물리 계산 시간(ms) — e2e perf가 읽는다
function runCycleFrame(dt: number) {
  if (!cycle?.runner || !cycle.claw || !dropped) return;
  const { runner, claw, world, live, machineId } = cycle;
  const t0 = performance.now();
  const done = runner.advance(dt);
  physicsMs.push(performance.now() - t0); if (physicsMs.length > 120) physicsMs.shift();
  const rig = bigZone.rigOf(machineId), group = bigZone.clawOf(machineId);
  // 쥔 모습은 화면·중계에서만 다듬는다 (game/holdLook): 손가락은 공을 감싸는 벌림, 인형은 손가락 우리 안으로
  const hold = claw.heldBall(), holding = hold !== null;
  if (holding && !cycle.wasHolding) swingOf(machineId).kick(0, -0.5); // 쥐는 순간 몸통이 살짝 출렁
  cycle.wasHolding = holding;
  cycle.look.update(dt, holding);
  const shown = cycle.look.open(claw.open, hold), shift = cycle.look.shift(claw, hold), heldUid = claw.held();
  const shifted = (p: DollPose): DollPose => (p.uid === heldUid ? { uid: p.uid, p: [p.p[0] + shift[0], p.p[1] + shift[1], p.p[2] + shift[2]], q: p.q } : p);
  group.position.set(claw.x, claw.y, claw.z);
  rig?.setCable(TOP_Y - claw.y); rig?.setOpen(shown);
  for (const p of world.poses()) { const d = shifted(p); live.set(d.uid, d.p, d.q); }
  topView?.update({ x: claw.x, z: claw.z });
  poseSender.frame(machineId, { x: claw.x, y: claw.y, z: claw.z, open: shown }, world.movingPoses().map(shifted), clock());
  if (!done) return;
  const r = runner.done();
  for (const uid of r.won) live.remove(uid);
  socket?.send(encodeDone(machineId, r.won, r.poses));
  dropped.markDone(clock());
  cycle.runner = null; cycle.reported = true;
}
function onDoneNo(machineId: string) {
  const bp = playFor(machineId);
  if (bp) { // 버튼 기계(피규어·고리·미는 뽑기): 기계 상태는 판 시작 전 그대로
    if (awaiting !== machineId) return;
    toast(UI.saveFailed);
    bp.refused(machineId);
    sitDown(machineId, false);
    return;
  }
  if (!cycle || cycle.machineId !== machineId) return;
  toast(UI.saveFailed);
  bigZone.setContents(machineId, cycle.before); // 서버는 판 시작 전 그대로다 (물리 뽑기 설계 §9.7)
  dropCycle();
  if (awaiting === machineId) sitDown(machineId, false);
}

// 채우기 앉히기 (물리 뽑기 설계 §9.2): 8m 안의 기계에 안 앉은 인형이 있고 물리가 준비됐으면 그 화면이 1초 안쪽 계산으로 앉힌다 (프레임당 한 대)
const SETTLE_REACH = 8;
// 한 프레임에 앉히기에 쓰는 시간(ms): 기계 하나를 한 프레임에 다 앉히면 50~150ms 멈칫해 집게가 뚝뚝 끊겨 보였다(사용자 2026-11-01).
// 걸음 순서는 한 번에 앉힐 때와 같아 기기 사이 결과도 같다
const SETTLE_MS = 4;
const settledHere = new Set<string>(); // 이 화면이 앉힌 기계 (e2e 결정성 확인)
type Settling = { id: string; contents: DollSpot[]; world: MachineWorld; run: Generator<void, number, void> };
let settling: Settling | null = null;
function startSettling(R: NonNullable<ReturnType<typeof rapierNow>>, id: string): Settling {
  const contents = bigZone.contentsOf(id), world = new MachineWorld(R, contents);
  return { id, contents, world, run: world.settling(CLAW.settle_seconds) };
}
function finishSettling(s: Settling): void {
  settledHere.add(s.id);
  bigZone.settleWith(s.id, s.world.poses());
  s.world.dispose();
  if (settling === s) settling = null;
}
// 한 판 직전: 그 기계는 지금 끝까지 앉힌다 (걸어오는 동안 조금씩 앉히던 중이면 이어서)
function settleMachine(id: string): void {
  const R = rapierNow();
  if (!R || !bigZone.unsettled(id).length) return;
  const s = settling?.id === id && settling.contents === bigZone.contentsOf(id) ? settling : startSettling(R, id);
  while (!s.run.next().done) { /* 끝까지 */ }
  finishSettling(s);
}
function settleNearby(): void {
  const R = rapierNow();
  if (!me || !R) return;
  if (settling && bigZone.contentsOf(settling.id) !== settling.contents) { settling.world.dispose(); settling = null; } // 그새 배치가 바뀜 — 다시
  if (!settling) {
    // 가까운 기계부터 — 다가가는 기계가 먼저 앉아 있어야 한 판을 누를 때 남은 앉히기가 몰리지 않는다
    let m: (typeof MACHINES)[number] | null = null, best = SETTLE_REACH;
    for (const c of MACHINES) { const d = Math.hypot(c.x - me.pos.x, c.z - me.pos.z); if (d <= best && bigZone.unsettled(c.id).length > 0) { m = c; best = d; } }
    if (!m) return;
    settling = startSettling(R, m.id);
  }
  const s = settling, until = performance.now() + SETTLE_MS;
  while (performance.now() < until) if (s.run.next().done) { finishSettling(s); return; }
}
let rapierScheduled = false;
function scheduleRapier(): void {
  if (rapierScheduled) return;
  rapierScheduled = true;
  const start = () => { loadRapier().catch((e) => { console.error(e); rapierScheduled = false; }); };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback(cb: () => void): void }).requestIdleCallback(start);
  else setTimeout(start, 2000);
}

function sendDrop() {
  if (!session) return;
  dropControls(); letGoOfLever();
  bigZone.showAim(session.machineId, false);
  awaiting = session.machineId;
  dropped = session;
  const R = rapierNow();
  if (cycle && R && cycle.machineId === session.machineId) {
    cycle.claw = new ClawBody(R, cycle.world);
    cycle.runner = new CycleRunner(cycle.world, cycle.claw, session.claw.x, session.claw.z);
  } else { // 물리가 없으면(있을 수 없지만) 빈손으로 보고한다
    socket?.send(encodeDone(session.machineId, [], []));
    dropped.markDone(clock());
  }
  session = null;
  hidePlayControls();
}

function endPlay() {
  const id = session?.machineId ?? awaiting ?? seated;
  for (const p of buttonPlays) p.end();
  if (id && !playFor(id)) {
    bigZone.clawOf(id).position.copy(CLAW_REST); bigZone.showAim(id, false);
    if (!showing.has(id)) bigZone.releaseClaw(id);
  }
  session = null; awaiting = null; dropped = null; seated = null;
  dropCycle();
  run.stop(); nextRunAt = null;
  dropControls(); letGoOfLever();
  topView?.dispose(); topView = null;
  hidePlayControls(); hideSeatControls(); setInfo(null);
  if (myAvatar) myAvatar.root.visible = true;
}

// 기계 조작 (설계 §3.10, 3차): PC는 마우스로, 휴대폰은 손가락으로 기계에 그려진 레버를 잡고 끌면 집게가 그쪽으로 자유롭게 가고(놓으면 멈춤),
// 하강 버튼을 누르면 내린다. 레버는 처음 누른 곳에서 60px 끌면 최고 속도
let controls: MachineControls | null = null, controlsAt: string | null = null;
function dropControls() {
  controls?.dispose(); controls = null;
  if (controlsAt) bigZone.hideControls(controlsAt, false);
  controlsAt = null;
}
let topView: TopView | null = null;
let leverDrag: { id: number; x: number; y: number } | null = null;
let leverInput = { x: 0, z: 0 };
const LEVER_PX = 60, LEVER_DEAD = 0.12;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function letGoOfLever() { leverDrag = null; leverInput = { x: 0, z: 0 }; controls?.setPressed(false); }
// 피규어 기계: 버튼 ①②는 누르는 동안 움직이고 떼면 멈춘다(②는 떼면 내린다)
let figureHold: { id: number; b: 1 | 2 } | null = null;
function letGoOfFigure() {
  if (figureHold) activePlay()?.release(figureHold.b, clock());
  figureHold = null;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const bp = activePlay();
  if (bp) {
    const b = bp.pick(raycaster);
    if (!b || figureHold) return;
    e.preventDefault();
    if (bp.press(b)) { figureHold = { id: e.pointerId, b }; navigator.vibrate?.(15); }
    return;
  }
  if (!session || !controls) return;
  const part = controls.pick(raycaster);
  if (!part) return;
  e.preventDefault();
  if (part === 'lever') { leverDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
  controls.setPressed(true);
  navigator.vibrate?.(15);
  if (session.requestDrop(clock())) sendDrop();
});
addEventListener('pointermove', (e) => {
  if (!leverDrag || e.pointerId !== leverDrag.id) return;
  let x = (e.clientX - leverDrag.x) / LEVER_PX, z = (e.clientY - leverDrag.y) / LEVER_PX; // 화면 위 = 기계 안쪽(-z)
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  leverInput = len < LEVER_DEAD ? { x: 0, z: 0 } : { x, z };
});
for (const type of ['pointerup', 'pointercancel'] as const) addEventListener(type, (e) => {
  if (!leverDrag || e.pointerId === leverDrag.id) letGoOfLever();
  if (figureHold && e.pointerId === figureHold.id) letGoOfFigure();
});
addEventListener('blur', () => { letGoOfLever(); letGoOfFigure(); });

// 판 사이: 기계 앞 화면 그대로 "🪙1 한 번 더 / 🪙5 다섯 판 더 / 그만하기" — 그만하기 전까지 계속 뽑는다 (서버가 hold_seconds 동안 자리를 잡아 둔다).
// 여러 판을 이어 하는 중이면 묻지 않고 잠깐 뒤(당첨 카드가 닫힐 즈음) 다음 판을 저절로 시작한다
const run = new PlayRun();
let nextRunAt: number | null = null;
function sitDown(machineId: string, won: boolean) {
  awaiting = null; dropped = null;
  seated = machineId;
  if (run.next(wallet.coins)) { nextRunAt = clock() + (won ? 2.4 : 1.2); showRunPause(stopRun); } // 판 사이의 그만하기도 '이어 하기 멈춤' — 그만둘지는 그다음 버튼으로
  else { run.stop(); showSeat(); }
}
function playAgain(id: string, plays: number) {
  if (!rapierReady()) { scheduleRapier(); toast(UI.physicsLoading); return; }
  run.start(plays, wallet.coins);
  socket?.send(encodePlay(id));
}
function showSeat() {
  const id = seated;
  if (!id || nextRunAt !== null) return;
  const more = runSize(wallet.coins);
  showSeatControls(wallet.coins > 0 ? () => playAgain(id, 1) : null, more && { ...more, onPress: () => playAgain(id, more.plays) },
    standUp, () => { standUp(); startCoinWalk(); });
}
// 이어 하기 멈춤: 판 사이("곧 n번째 판이 시작돼요")의 그만하기 — 다음 판을 안 시작하고 바로 "한 판 더 / 그만하기"를 묻는다. 판 도중에는 버튼이 없다 (사용자 2026-11-01: 판을 멈추지 못하는 버튼은 무의미)
function stopRun() {
  run.stop(); nextRunAt = null; hideSeatControls(); showSeat();
}
function standUp() {
  socket?.send(encodeStand());
  endPlay();
}
// 이어 하는 판 도중의 그만하기: 이어 하기를 멈추고 바로 일어난다(그 판의 코인은 넣은 것). 집게가 도는 중이면 그 판 결과까지만 보고 묻는다
function quitRun() {
  run.stop();
  if (session || activePlay()) standUp(); // 버튼 기계의 버튼 단계도 (최종 리뷰 I2)
  else hideSeatControls();
}

// 희귀·황금이 채워졌다 (설계 2026-10-31 인형 채우기 §4.2 알림): 전광판에 기계 번호와 이름, 그 기계 간판 전구가 깜빡인다
function announceSpawn(machineId: string, kind: string, rare: string) {
  const name = dollName(kind, 0, rare);
  if (rare === GOLD.id) {
    tower.showMessage('★ 매우 희귀 등장! ★', `${machineId}에 ${name}${iGa(name)} 나타났어요`, true, 8);
    sfx.rare();
  } else tower.showMessage('희귀 등장!', `${machineId}에 ${name} 등장!`, false, 5);
  bigZone.flash(machineId, rare === GOLD.id, 3);
}

// 결과 연출. 남의 화면: 그 사람 캐릭터가 쾅 → 두근두근(집게가 내려갔다 올라옴) → 성공(꺼내기·번쩍·가방에 쏙) / 실패(털썩).
// 내 화면: 기계 앞 화면 그대로 집게 → 성공(번쩍·카드)/실패(소리) → 판 사이 버튼 (내 캐릭터는 숨어 있어 몸동작은 남의 화면에만)
async function showResult(m: Result, t: Ticket) {
  showing.add(m.m);
  const mine = m.id === myId;
  if (mine) showingMe = true;
  await playing.get(m.m)?.stop(); playing.delete(m.m);
  const spot = spotOf.get(m.m)!, face = spot.ry + Math.PI;
  const first = m.won[0];
  const info = first ? DOLLS[first[0]] : undefined, rare = !!first?.[2], tier = first?.[2] === GOLD.id ? 'gold' : rare ? 'rare' : '';
  const name = first ? dollName(first[0], first[1], first[2]) : '';
  const front = frontSpot(spot);
  const near = mine || (!!me && Math.hypot(me.pos.x - front.x, me.pos.z - front.z) < 6);
  const rig = mine ? null : remotes.rigOf(m.id);
  const doll = rig && first ? makeDoll(first[0], { ...PLAIN, color: first[1], rare: first[2] }) : null;
  if (doll) spinners.push(...doll.userData.spin);
  const o = m.won.length ? 'win' : 'miss';
  const fx = {
    bonk: () => { if (near) sfx.bonk(); },
    claw: async () => {}, // 집게는 물리가 이미 움직였다(내 판) / 중계로 보였다(남의 판, Task 12)
    afterClaw: () => { if (mine && awaiting === m.m) sitDown(m.m, o === 'win'); },
    pop: () => { if (near) sfx.pop(); },
    win: () => {
      bigZone.flash(m.m, tier === 'gold', 3.2);
      const at = new THREE.Vector3();
      (doll ?? bigZone.worldOf(m.m)).getWorldPosition(at); at.y += doll ? 0.3 : 1.2; // 캐릭터가 든 인형, 없으면 기계 유리 칸
      const colors = tier === 'gold' ? [0xffd36b, 0xfff6b0, 0xff9f43, 0xffffff] : rare ? [0xff9fd8, 0xffe0f4, 0xc9a8ff, 0xffffff] : [0xff7ab6, 0x8fd3ff, 0xffe066, 0x8fe3c8];
      burst(scene, at, colors, tier === 'gold' ? 90 : rare ? 60 : 36);
      if (rare) sfx.rare(); else if (near) sfx.win();
      if (rare && info) {
        const nick = mine ? myNick : remotes.nickOf(m.id);
        tower.showMessage(tier === 'gold' ? '★★ 매우 희귀! ★★' : '★ 희귀 뽑기! ★', `${nick} 님이 ${name}${eulReul(name)} 뽑았어요`, true, tier === 'gold' ? 8 : 6);
      }
      if (mine && info) showWinCard(name, SETS.find((x) => x.id === info.set)?.name ?? '', tier, wallet.bag);
      if (mine && m.won.length > 1) toast(UI.wonMore(m.won.length - 1)); // 탑이 무너져 여럿이 빠지면 모두 내 것 (물리 뽑기 설계 §9.1)
      return rare ? 1.7 : 1.0;
    },
    fail: () => { if (mine) sfx.fail(); },
  };
  if (rig) await playResult(rig, tw, o, doll, fx, face);
  else { fx.afterClaw(); if (o === 'win') fx.win(); else fx.fail(); }
  if (doll) spinners.splice(0, spinners.length, ...spinners.filter((s) => !doll.userData.spin.includes(s)));
  showing.delete(m.m);
  if (t.pending) { applyMachine(m.m, t.pending, t.gen); t.pending = undefined; }
  t.done = true;
  if (mine) showingMe = false;
}

// 피규어 결과(9단계 설계 §3.5): 내 화면은 정면 시점 앞에서 상자 까기 → 당첨 카드 → 판 사이 버튼. 일반은 효과 없이, 희귀·황금은 효과와 탑 알림.
// 남의 화면은 인형 판처럼 그 사람 캐릭터가 쾅 → 두근두근 → 피규어를 꺼내 보여 주기 / 털썩
async function showFigureResult(m: Result, t: Ticket) {
  showing.add(m.m);
  const mine = m.id === myId;
  if (mine) showingMe = true;
  await playing.get(m.m)?.stop(); playing.delete(m.m);
  const spot = FIGURE_SPOTS.get(m.m)!, front = frontSpot(spot);
  const first = m.won[0], tier = first?.[2] === GOLD.id ? 'gold' : first?.[2] ? 'rare' : '';
  const name = first ? figureName(first[0], first[2]) : '';
  const near = mine || (!!me && Math.hypot(me.pos.x - front.x, me.pos.z - front.z) < 6);
  // 희귀·황금은 탑 전광판에 알린다 — 내 판은 상자를 깐 뒤에(먼저 알리면 까기 전에 들킨다)
  const announce = () => {
    if (!tier) { if (near) sfx.win(); return; }
    const nick = mine ? myNick : remotes.nickOf(m.id);
    tower.showMessage(tier === 'gold' ? '★★ 황금 피규어! ★★' : '★ 희귀 피규어! ★', `${nick} 님이 ${name}${eulReul(name)} 뽑았어요`, true, tier === 'gold' ? 8 : 6);
    sfx.rare();
  };
  if (mine) {
    if (first) {
      await new Promise<void>((done) => figurePlay.reveal(first[0], first[2], figureCameraPose(spot, 0, camera.aspect), done, spot.box));
      announce();
      showWinCard(name, FIGURE_WORD, tier, wallet.bag);
    } else sfx.fail();
    if (awaiting === m.m) sitDown(m.m, !!first);
  } else {
    const rig = remotes.rigOf(m.id);
    let held: THREE.Group | null = null;
    if (rig && first) { held = new THREE.Group(); const fig = makeFigure(first[0], first[2]); fig.scale.setScalar(0.4); held.add(fig); } // 손에 든 인형(0.5배) 크기에 맞춤
    const fx = {
      bonk: () => { if (near) sfx.bonk(); },
      claw: async () => {}, // 집게는 중계로 보였다
      afterClaw: () => {},
      pop: () => { if (near) sfx.pop(); },
      win: () => { announce(); return tier ? 1.7 : 1.0; },
      fail: () => {},
    };
    if (rig) await playResult(rig, tw, first ? 'win' : 'miss', held, fx, spot.ry + Math.PI);
    else if (first) announce();
  }
  showing.delete(m.m);
  t.done = true;
  if (mine) showingMe = false;
}

// 보이는 경품 기계(고리·미는 뽑기, 설계 2026-11-02)의 결과: 결과 그리기(찌르기·밀기)가 끝난 뒤 — 내 판은 당첨 카드, 남의 판은 그 사람이 꺼내 보여 주기.
// 희귀·황금이면 탑 알림
async function showPrizeResult(m: Result, t: Ticket) {
  const bp = playFor(m.m)!, mine = m.id === myId;
  showing.add(m.m);
  if (mine) showingMe = true;
  await playing.get(m.m)?.stop(); playing.delete(m.m);
  await bp.finished(m.m);
  const spot = spotOf.get(m.m)!, front = frontSpot(spot), first = m.won[0];
  const tier = first?.[2] === GOLD.id ? 'gold' : first?.[2] ? 'rare' : '';
  const name = first ? `${dollName(first[0], first[1], first[2])} ${bp.prizeWord}` : '';
  const near = mine || (!!me && Math.hypot(me.pos.x - front.x, me.pos.z - front.z) < 6);
  const announce = () => {
    if (!tier) { if (near) sfx.win(); return; }
    const nick = mine ? myNick : remotes.nickOf(m.id);
    tower.showMessage(tier === 'gold' ? '★★ 매우 희귀! ★★' : '★ 희귀 뽑기! ★', `${nick} 님이 ${name}${eulReul(name)} 뽑았어요`, true, tier === 'gold' ? 8 : 6);
    sfx.rare();
  };
  if (mine) {
    if (first) { announce(); showWinCard(name, bp.prizeWord, tier, wallet.bag); if (m.won.length > 1) toast(UI.wonMore(m.won.length - 1)); } else sfx.fail();
    if (awaiting === m.m) sitDown(m.m, !!first);
  } else {
    const rig = remotes.rigOf(m.id), doll = rig && first ? makeDoll(first[0], { ...PLAIN, color: first[1], rare: first[2] }) : null;
    const fx = { bonk: () => { if (near) sfx.bonk(); }, claw: async () => {}, afterClaw: () => {}, pop: () => { if (near) sfx.pop(); }, win: () => { announce(); return tier ? 1.7 : 1.0; }, fail: () => {} };
    if (rig) await playResult(rig, tw, first ? 'win' : 'miss', doll, fx, spot.ry + Math.PI);
    else if (first) announce();
  }
  showing.delete(m.m);
  t.done = true;
  if (mine) showingMe = false;
}

// 새 배치(machine)를 넣는다 — 그 판(gen)의 live 모드는 여기서 끝나고 무더기로 돌아간다. 이미 다음 판이 시작됐으면 그 판의 구경·물리는 둔다
function applyMachine(id: string, dolls: DollSpot[], gen: number) {
  bigZone.setContents(id, dolls.map(grounded));
  if (cycle && cycle.machineId === id && cycle.reported && cycle.gen === gen) dropCycle();
  if (watches.get(id)?.gen === gen) stopWatch(id);
}

// 구경 (물리 뽑기 설계 §4.5·§4.6): 남이 하는 기계는 인형을 따로 그리고, 받은 중계(pose) 사이를 보간해 집게·인형을 움직인다. 판 끝의 machine으로 맞춘다
// 가까운 기계만 구경한다 — 매장 곳곳의 판을 다 따로 그리면 무겁다 (최종 리뷰 I6). 멀리서 시작된 판은 다가가도 끝의 machine으로만 맞는다
type Watch = { live: LiveDolls; receiver: PoseReceiver; poses: number; gen: number };
const watches = new Map<string, Watch>();
const WATCH_REACH = 12;
function startWatch(id: string) {
  const w = watches.get(id);
  if (w) { w.gen = genOf(id); return; } // 앞 판의 구경이 아직 끝나지 않았다(결과 모션 중) — 이 판의 것으로 잇는다
  if (cycle?.machineId === id) return;
  const spot = spotOf.get(id)!;
  if (!me || Math.hypot(me.pos.x - spot.x, me.pos.z - spot.z) > WATCH_REACH) return;
  bigZone.activateClaw(id);
  watches.set(id, { live: bigZone.live(id), receiver: new PoseReceiver(), poses: 0, gen: genOf(id) });
}
function stopWatch(id: string) {
  const w = watches.get(id);
  if (!w) return;
  w.live.dispose(); watches.delete(id);
  bigZone.clawOf(id).position.copy(CLAW_REST);
  const rig = bigZone.rigOf(id);
  if (rig) { rig.setCable(CABLE_TOP); rig.setOpen(0.35); }
  if (!showing.has(id)) bigZone.releaseClaw(id);
}
function updateWatches(nowSec: number) {
  for (const [id, w] of watches) {
    const { claw, dolls } = w.receiver.sample(nowSec);
    if (claw[1] <= 0) continue; // 아직 중계가 없다
    const rig = bigZone.rigOf(id), group = bigZone.clawOf(id);
    group.position.set(claw[0], claw[1], claw[2]);
    rig?.setCable(TOP_Y - claw[1]); rig?.setOpen(claw[3]);
    for (const p of dolls.values()) w.live.set(p.uid, p.p, p.q);
  }
}
const poseSender = new PoseSender((msg) => socket?.send(msg));

// 기계 앞자리 가까이면 그 기계: 비었으면 "🪙1 넣고 하기", 남이 하면 구경 중
function showMachineUi(): boolean {
  if (!me) return false;
  // 인형·피규어·고리 기계 중 앞자리가 가장 가까운 쪽
  const pos = me.pos, gap = (m: { x: number; z: number; ry: number }) => { const f = frontSpot(m); return Math.hypot(pos.x - f.x, pos.z - f.z); };
  const near = [nearestMachine(pos), nearestFigure(pos), nearestRing(pos)].filter((m) => m !== null).sort((a, b) => gap(a) - gap(b))[0];
  if (!near) return false;
  const who = busy.who(near.id, clock());
  if (who && who !== myId) { setAction(null); setInfo(UI.watching); return true; }
  setInfo(null);
  const more = runSize(wallet.coins);
  if (!rapierReady()) { scheduleRapier(); setAction(UI.playOne, () => {}, { badge: 1, dim: true, status: UI.physicsLoading }); } // 물리 모듈을 받는 중 (설계 §4.1)
  else if (wallet.coins > 0) setAction(UI.playOne, () => playAgain(near.id, 1), { badge: 1, extra: more && { label: UI.playRun(more.plays), badge: more.plays, onPress: () => playAgain(near.id, more.plays) } });
  else setAction(UI.goCounter, startCoinWalk, { status: UI.noCoins });
  return true;
}

// ---------- 조르기·주기 (교환소 개편 설계 §4.3·§4.4·§4.8) ----------
let myBegging = false, myBeg: { stop(): Promise<void> } | null = null;
const coinShow = new CoinShow();
const rigOfPlayer = (id: string) => (id === myId ? myAvatar?.rig ?? null : remotes.rigOf(id));
function setMyBegging(on: boolean) {
  myBegging = on;
  myAvatar?.setTag(on ? BEGGING : null);
  if (on && !myBeg && myAvatar) myBeg = startBegging(myAvatar.rig, tw);
  else if (!on && myBeg) { void myBeg.stop(); myBeg = null; }
}

// 교환소 조르기: 그 사람이 3초 조르고 → 받으면 기뻐하며 코인이 튀고, 쿨타임이면 시무룩 (모두의 화면)
async function counterBegShow(id: string, counter: number, n: number) {
  const rig = rigOfPlayer(id);
  if (rig) {
    const c = COUNTERS[counter];
    rig.root.rotation.y = Math.atan2(c.x - rig.root.position.x, c.z - rig.root.position.z);
    const beg = startBegging(rig, tw);
    await tw.wait(3);
    await beg.stop();
  }
  const mine = id === myId; // 내 결과(코인 수·안내)는 조르는 모션이 끝난 지금 보인다 (최종 리뷰 I3)
  if (n > 0) {
    const c = COUNTERS[counter];
    burst(scene, new THREE.Vector3(c.window[0], 1.4, c.window[1]), [0xffd36b, 0xfff6b0, 0xff9fd8], 26);
    if (mine) { endCounterBeg(); toast(UI.gotCoins(n)); }
    if (rig) await playHappy(rig, tw);
  } else {
    if (mine) endCounterBeg();
    if (rig) await playSulk(rig, tw);
  }
}

function endCounterBeg() {
  const { coins, note } = coinShow.endBeg();
  if (coins) showCoins(coins);
  if (note) counterNote = { text: note, until: performance.now() / 1000 + 4 };
}

function showCoins(m: Coins) {
  wallet.coins = m.n;
  setHud(wallet.coins, wallet.bag);
  if (seated) showSeat();
}

// 코인 주기: 주는 사람이 건네고 받는 사람이 기뻐한다 (모두의 화면), 두 사람에게 알림
async function gaveShow(from: string, to: string, n: number) {
  const giver = rigOfPlayer(from), taker = rigOfPlayer(to);
  if (to === myId) toast(UI.gaveYou(remotes.nickOf(from), n));
  if (from === myId) toast(UI.youGave(n));
  if (giver && taker) {
    const a = giver.root.position, b = taker.root.position;
    void playGive(giver, tw, Math.atan2(b.x - a.x, b.z - a.z));
    burst(scene, new THREE.Vector3(b.x, 1.6, b.z), [0xffd36b, 0xff7ab6, 0xfff6b0], 18);
    await playHappy(taker, tw);
  }
}

// 맵(기계 앞·교환소 근처가 아닌 곳): 조르는 사람이 가까우면 '주기', 아니면 '조르기'·'그만 조르기'
function showMapUi() {
  if (!me) return;
  const beggar = myBegging ? null : remotes.beggarNear(me.pos, GIVE_REACH);
  if (beggar) {
    const max = Math.min(wallet.coins, beggar.room);
    setAction(UI.give, () => {
      if (max > 0) openGiveSheet({ nick: beggar.nick, max, onGive: (n) => socket?.send(encodeGive(beggar.id, n)) });
    }, {
      status: max > 0 ? UI.someoneBegs(beggar.nick) : wallet.coins > 0 ? UI.giveNo.full : UI.giveNo.poor, dim: max === 0,
      extra: { label: UI.beg, onPress: () => socket?.send(encodeBeg(true)) }, // 조르기는 늘 있다 (설계 §4.3)
    });
    return;
  }
  setAction(myBegging ? UI.stopBeg : UI.beg, () => socket?.send(encodeBeg(!myBegging)));
}

// '교환소 가기': 걸어서 가장 가까운 교환소 창구 앞까지 장애물을 돌아 저절로 걷는다. 손으로 움직이면 멈춘다 (설계 §3.11).
// 도착하면 저절로 받지 않고 '코인 받기'·'조르기' 중에 고른다 (교환소 개편 설계 §4.5)
function startCoinWalk() {
  if (!me) return;
  const { counter, route } = nearestCounter(me.pos);
  walker.start(route, counter);
}

// 교환소 창구 가까이면 '코인 받기'(큰 버튼)·'조르기'(작은 버튼). 코인이 15개 이상이면 받기는 흐리게 '코인이 넉넉해요'
function showCounterUi(nowSec: number): boolean {
  if (!me) return false;
  const near = COUNTERS.find((c) => Math.hypot(me!.pos.x - c.window[0], me!.pos.z - c.window[1]) <= COUNTER_REACH);
  if (!near) { setAction(null); return false; }
  if (counterNote && nowSec > counterNote.until) counterNote = null;
  const enough = wallet.coins >= TAKE_LIMIT;
  setAction(UI.takeCoins, () => { if (!enough) socket?.send(encodeTake(near.id)); }, {
    status: counterNote?.text ?? (enough ? UI.enough : null), dim: enough,
    extra: { label: UI.beg, onPress: () => { if (coinShow.startBeg()) socket?.send(encodeCounterBeg(near.id)); } },
  });
  return true;
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
    runCycleFrame(dt); // 내린 뒤 집게 한 바퀴(물리)
    for (const p of buttonPlays) p.frame(dt, now / 1000); // 버튼 기계: 버튼 단계·결과 그리기·구경
    settleNearby(); // 가까운 기계의 안 앉은 인형 앉히기
    const atMachine = session?.machineId ?? activePlay()?.session?.machineId ?? awaiting ?? seated; // 기계 카메라를 쓰는 동안
    joystick.setEnabled(!atMachine); // 기계 앞에서는 기계 버튼으로 — 걷기 조이스틱은 숨긴다
    bigZone.hideRowsBehind(atMachine ?? null); // 기계 앞 화면에선 내 기계 뒤 줄을 숨긴다 (휴대폰 그리기 호출, 큰 홀 설계 §6)
    bigZone.setFocus(me.pos.x, me.pos.z); // 먼 묶음은 인형 외곽선을 끈다 (큰 홀 설계 §6)
    const myMachine = atMachine ? spotOf.get(atMachine) : undefined;
    remotes.fade(myMachine ? (p) => blocksView(myMachine, p) : null, dt); // 한 판 중 내 카메라를 가리는 사람은 거의 투명하게
    if (session) {
      // 기계 레버가 집게를 움직이고 캐릭터는 기계 앞에 서 있다.
      // 시간이 다 되면 여기서 내리고(sendDrop이 session을 비운다) — 그 뒤엔 session을 읽지 않는다 (읽으면 그리기 고리가 멈춘다)
      const playId = session.machineId;
      if (session.update(dt, leverInput, now / 1000) === 'drop') sendDrop();
      else if (session.phase === 'lever') {
        setTimer(session.remaining, run.label());
        controls?.update(now / 1000);
        controls?.setLever(leverInput.x, leverInput.z);
        const claw = bigZone.clawOf(session.machineId);
        swingOf(session.machineId);
        claw.position.set(session.claw.x, CLAW_REST.y, session.claw.z);
        topView?.update(session.claw);
        // 겨냥 고리는 집게 아래 인형 머리 위(없으면 바닥)에 놓는다
        const aim = claw.getObjectByName('aim')!;
        aim.position.y = aimHeight(bigZone.contentsOf(session.machineId), session.claw.x, session.claw.z) - CLAW_REST.y;
        aim.visible = aimVisible(session.claw); // 상품 구멍 위(시작 자리)에서는 숨긴다
      }
      me.autoTarget = frontSpot(spotOf.get(playId)!); // 기계 앞자리 가운데로 (카메라 구도가 늘 같게)
      me.drive({ x: 0, z: 0 }, dt);
    } else if (activePlay()?.session) {
      const bs = activePlay()!.session!;
      setTimer(bs.remaining(now / 1000), run.label());
      me.autoTarget = frontSpot(spotOf.get(bs.machineId)!);
      me.drive({ x: 0, z: 0 }, dt);
    } else if (showingMe || cycle?.runner || buttonPlays.some((p) => p.cycling())) {
      me.drive({ x: 0, z: 0 }, dt); // 내 결과 모션·집게 한 바퀴 동안은 제자리
    } else if (seated) {
      me.autoTarget = frontSpot(spotOf.get(seated)!); // 판 사이에도 기계 앞자리에 그대로
      me.drive({ x: 0, z: 0 }, dt);
      const left = MACHINE_SPEC.hold_seconds - (now / 1000 - holdFrom);
      if (nextRunAt !== null) {
        setInfo(UI.nextRun(run.upcoming()));
        if (clock() >= nextRunAt) { nextRunAt = null; socket?.send(encodePlay(seated)); }
      } else setInfo(left > 0 ? UI.continueIn(Math.ceil(left)) : null);
    } else if (!awaiting) {
      if (Math.hypot(input.x, input.z) > 0) { walker.cancel(); if (myBegging) setMyBegging(false); } // 손으로 움직이면 저절로 걷기·조르기를 멈춘다 (서버도 끝낸다)
      me.autoTarget = walker.next(me.pos);
      me.drive(input, dt);
      const goal = walker.counter !== null ? COUNTERS[walker.counter].window : null;
      if (goal && Math.hypot(me.pos.x - goal[0], me.pos.z - goal[1]) < 0.3) walker.cancel(); // 창구 앞에 닿으면 멈춘다
      if (!showMachineUi() && !showCounterUi(now / 1000)) showMapUi();
    }
    const moving = Math.hypot(me.dir.x, me.dir.z) > 0 && !atMachine;
    myAvatar.root.position.set(me.pos.x, 0, me.pos.z);
    if (moving && !showingMe) myAvatar.root.rotation.y = Math.atan2(me.dir.x, me.dir.z); // 기계 앞에선 모션이 방향을 정한다
    myAvatar.setWalking(moving);
    myAvatar.update(now / 1000);
    if (socket && sampler.shouldSend(me.dir, now)) socket.send(encodeMove(me.pos, me.dir));
    if (atMachine) {
      // 기계 정면에서 유리 칸을 본다 (0.6초쯤에 걸쳐 부드럽게). 피규어 기계는 ①을 떼면 옆 대각선, 판이 끝나면 정면
      const bp = playFor(atMachine);
      const pose = bp ? bp.cameraPose(atMachine, now / 1000, camera.aspect) : machineCameraPose(spotOf.get(atMachine)!);
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
  updateWatches(now / 1000);
  bigZone.update(now / 1000);
  tower.update(now / 1000); // 진열탑 전광판 광고 띠
  renderer.render(scene, camera);
}

ensureGuest().then(enter);
