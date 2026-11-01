import * as THREE from 'three';
import { PUSHER, type PusherSpot } from '../data/pushers';
import { PLATE_INSET, plateDepth } from '../physics/pusherWorld';
import { PUSHER_SIGN } from './copy';
import {
  CABINET_SCALE, DOLL_FLOOR, FELT_COLORS, MACHINE_COLORS, PLAY_BOX, addControlBases, machineAcryl, machineBackMat, machineHoleMat, machinePopMat, machineSignMat, makeCabinetShell,
  type MachineParts,
} from './machine';
import { plateTex } from './signs';
import { part, toon } from './toon';

// 미는 뽑기 기계 그림(설계 2026-11-02 ring-hook §4, 사진 187·188): 인형 기계와 같은 몸통·조작대에 속만 다르다 — 오른쪽 넓은 칸(펠트)에
// 미니 인형이 수북하고, 왼쪽 앞은 한 단 높은 턱(오른쪽 끝에 낮은 턱), 턱 뒤는 미는 판이 숨는 집, 턱 앞은 어두운 출구(칸과는 투명 벽).
// 치수는 물리(physics/pusherWorld.ts)와 같다. 미는 판은 움직이므로 bigZone이 줄마다 InstancedMesh로 그린다(pusherPlateGeo)
const { ledge, plate, chute, house } = PUSHER; // plate.depth는 앞판 두께, 그리는 판은 plateDepth()(오가는 거리만큼 깊다)
const TOP = DOLL_FLOOR + ledge.h, BASE = 0.86, BACK = -PLAY_BOX.z, FRONT = PLAY_BOX.z, RIGHT = PLAY_BOX.x;
const LW = ledge.x1 - ledge.x0, LX = (ledge.x0 + ledge.x1) / 2;
// 판 집: 판 윗면보다 over만큼 높은 앞벽 + 앞으로 기운 비탈 윗면(물리와 같은 치수)
const HB = TOP + plate.h + house.over, SLOPE = (house.slope_deg * Math.PI) / 180, RUN = ledge.z0 - BACK;
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };

const G = once(() => ({
  pile: new THREE.BoxGeometry(RIGHT - ledge.x1, 0.02, FRONT - BACK),
  ledge: new THREE.BoxGeometry(LW, TOP - BASE, ledge.z1 - ledge.z0),
  edge: new THREE.BoxGeometry(LW, 0.014, 0.014),
  lip: new THREE.BoxGeometry(0.012, ledge.lip, ledge.z1 - ledge.z0),
  house: new THREE.BoxGeometry(LW, HB - BASE, RUN),
  roof: new THREE.BoxGeometry(LW, 0.012, RUN / Math.cos(SLOPE)),
  exit: new THREE.PlaneGeometry(LW, FRONT - ledge.z1),
  wall: new THREE.BoxGeometry(0.008, chute.h, FRONT - ledge.z1),
  back: new THREE.PlaneGeometry(RIGHT * 2, 1.08),
}));

// 미는 판(앞면 z = 0 기준, 판 두께만큼 뒤로) — bigZone이 판 자리마다 옮긴다
export const pusherPlateGeo = once(() => new THREE.BoxGeometry(LW - 0.01 - PLATE_INSET, plate.h, plateDepth()).translate(LX - PLATE_INSET / 2, TOP + plate.h / 2, -plateDepth() / 2)); // 뒤쪽은 집 안에 가려진다
export const pusherPlateMat = once(() => toon(0xff5f8f));

// 미니 인형 칸 펠트 색(뒷판 모니터도 같은 색) — index는 PUSHERS 안 순서
export const pusherFelt = (index: number): number => FELT_COLORS[(index + 1) % FELT_COLORS.length];

export function makePusherMachineParts(spot: PusherSpot, index: number): MachineParts {
  const g = G(), m = new THREE.Group();
  m.position.set(spot.x, 0, spot.z); m.rotation.y = spot.ry;
  const add = (o: THREE.Object3D) => { m.add(o); return o; };
  const color = MACHINE_COLORS[(index + 3) % MACHINE_COLORS.length];
  const ledGeo = makeCabinetShell(m, color, {
    sign: machineSignMat(PUSHER_SIGN, color),
    plate: new THREE.MeshBasicMaterial({ map: plateTex(spot.id) }),
    pop: machinePopMat(index + 2),
  }, CABINET_SCALE);
  addControlBases(m);
  add(part(g.pile, toon(pusherFelt(index)), [(RIGHT + ledge.x1) / 2, BASE, 0], [1, 1, 1], [0, 0, 0], 0)); // 미니 인형 칸
  add(new THREE.Mesh(g.back, machineBackMat(index + 1))).position.set(0, 1.4, BACK + 0.01);
  // 턱(크림색) + 앞 끝 분홍 띠(여기서 떨어진다) + 오른쪽 끝 낮은 턱(크롬)
  add(part(g.ledge, toon(0xfff3c4), [LX, (BASE + TOP) / 2, (ledge.z0 + ledge.z1) / 2], [1, 1, 1], [0, 0, 0], 1.02));
  add(part(g.edge, toon(0xff5f8f), [LX, TOP - 0.007, ledge.z1], [1, 1, 1], [0, 0, 0], 0));
  add(part(g.lip, toon(0xd3d6de), [ledge.x1 - 0.006, TOP + ledge.lip / 2, (ledge.z0 + ledge.z1) / 2], [1, 1, 1], [0, 0, 0], 0));
  // 미는 판 집(흰색) + 앞으로 기운 비탈 지붕(분홍) — 판이 집 앞벽 아래 틈에서 나온다
  add(part(g.house, toon(0xf8f6fb), [LX, (BASE + HB) / 2, (ledge.z0 + BACK) / 2], [1, 1, 1], [0, 0, 0], 1.02));
  add(part(g.roof, toon(0xffb3cf), [LX, HB + (RUN / 2) * Math.tan(SLOPE), (ledge.z0 + BACK) / 2], [1, 1, 1], [SLOPE, 0, 0], 1.02));
  // 출구: 턱 앞 어두운 구멍 + 칸과 사이의 투명 벽
  const exit = add(new THREE.Mesh(g.exit, machineHoleMat())); exit.rotation.x = -Math.PI / 2; exit.position.set(LX, BASE + 0.002, (ledge.z1 + FRONT) / 2);
  add(new THREE.Mesh(g.wall, machineAcryl())).position.set(ledge.x1, DOLL_FLOOR + chute.h / 2, (ledge.z1 + FRONT) / 2);
  m.traverse((o) => { o.castShadow = false; });
  return { statics: m, ledGeo };
}
