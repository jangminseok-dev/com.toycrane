// 서버와 주고받는 메시지 형식. 견본: shared/protocol_fixtures.json (서버 server_messages.py·move_schema.py와 같은 형식)
import type { Vec2 } from '../game/movement';

export type PlayerView = { id: string; nick: string; color: number; x: number; z: number; dx: number; dz: number; beg?: number | null }; // beg: 조르는 중이면 더 받을 수 있는 코인 수
// 메시지 형식 버전 — 서버 welcome의 v와 다르면(배포로 형식이 바뀜) 화면을 새로고침한다
export const PROTOCOL = 14;
export type Body = 'n' | 'c' | 's'; // 보통 · 뚱뚱 · 마른
// 기계 속 인형 한 칸 [캐릭터, x, y, z, qx, qy, qz, qw, 색, 체형, 표정, 희귀, 번호] (기계 안 좌표·돌림 쿼터니언 — 물리 뽑기 설계 §4.5).
// y가 null이면 서버가 (x, z) 위 천장에서 떨어뜨린 아직 안 앉은 인형(돌림은 0,0,0,1) — 화면들이 같은 물리로 앉힌다.
// 희귀: '' 일반 · 효과 id · 'gold'. 번호(uid)는 기계 안에서 그 인형을 가리킨다
export type DollSpot = [kind: string, x: number, y: number | null, z: number, qx: number, qy: number, qz: number, qw: number,
  color: number, body: Body, face: number, rare: string, uid: number];
// 인형 하나의 겉모습 (world/dolls.ts makeDoll)
export type DollLook = { color: number; body: Body; face: number; rare: string };
export const lookOf = (s: DollSpot): DollLook => ({ color: s[8], body: s[9], face: s[10], rare: s[11] });
export const uidOf = (s: DollSpot): number => s[12];
// 인형 하나의 자리·돌림 (물리 → 보고·중계)
export type DollPose = { uid: number; p: [number, number, number]; q: [number, number, number, number] };
// 피규어 기계(9단계) 상자 자리 — 기계 좌표 (x, y, z, qx, qy, qz, qw). 경품은 담지 않는다(뽑힌 순간 result로만)
export type BoxWire = [x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number];
// 고리·미는 뽑기(설계 2026-11-02): 걸이 카드 [캐릭터, 색, 희귀], 선반 인형 [번호, 캐릭터, 색, 희귀, x, z] — 보이는 경품
export type Welcome = {
  t: 'welcome'; v: number; store: number; you: PlayerView; players: PlayerView[];
  coins: number; bag: number; machines: Record<string, DollSpot[]>; plays: Record<string, string>; figures: Record<string, BoxWire>;
};
export type Join = { t: 'join'; p: PlayerView };
export type Move = { t: 'move'; id: string; x: number; z: number; dx: number; dz: number };
export type Correct = { t: 'correct'; x: number; z: number };
export type Leave = { t: 'leave'; id: string };
export type Coins = { t: 'coins'; n: number; got: number };
export type PlayOk = { t: 'play_ok'; m: string; coins: number; limit: number };
export type PlayNo = { t: 'play_no'; m: string; why: 'busy' | 'coins' | 'far' | 'playing' };
export type Play = { t: 'play'; m: string; id: string };
// 한 판 결과: 구멍에 빠진 인형들 [캐릭터, 색, 희귀, 번호] (비어 있으면 못 뽑음) — 결과는 판을 한 화면의 물리가 정하고 서버는 기록·중계
export type WonDoll = [kind: string, color: number, rare: string, uid: number];
// staff: 미는 뽑기 15판 보장으로 직원이 꺼내 준 인형, miss: 그 사람이 이 기계에서 연달아 못 뽑은 판 수(인형 기계·미는 뽑기, 0이면 없음 — game/help.ts)
export type Result = { t: 'result'; m: string; id: string; won: WonDoll[]; staff?: boolean; miss?: number };
export type DoneNo = { t: 'done_no'; m: string; why: string }; // 서버가 판 보고를 거절(치명 규칙) — 기계는 판 시작 전으로
export type ClawPose = [x: number, y: number, z: number, open: number];
export type PoseWire = [uid: number, x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number];
export type Pose = { t: 'pose'; m: string; id: string; c: ClawPose; d: PoseWire[] }; // 판을 하는 사람의 집게·움직이는 인형 중계
export type MachineMsg = { t: 'machine'; m: string; dolls: DollSpot[] };
export type Free = { t: 'free'; m: string };
export type Bag = { t: 'bag'; n: number };
export type TakeNo = { t: 'take_no'; c: number; why: 'far' | 'enough' }; // 코인 받기 거절
export type CounterBeg = { t: 'cbeg'; id: string; c: number; n: number }; // 교환소 조르기 결과 (0이면 쿨타임 거절)
export type CounterBegNo = { t: 'cbeg_no'; c: number; why: 'wait' | 'full' | 'far'; wait: number }; // 본인에게: 거절 이유, 남은 초
export type Beg = { t: 'beg'; id: string; room: number | null }; // 맵 조르기 시작(더 받을 수 있는 수)·끝(null)
export type Gave = { t: 'gave'; from: string; to: string; n: number }; // 코인 주기가 이뤄짐
export type GiveNo = { t: 'give_no'; why: string };
export type Spawn = { t: 'spawn'; m: string; k: string; rv: string }; // 희귀·황금이 채워졌다
export type Stock = { t: 'stock'; in: number | null }; // 다음 채울 때까지 남은 초 (가득이면 null)
export type FigureMsg = { t: 'figure'; m: string; box: BoxWire; nudged: boolean }; // 피규어 상자 자리(판 뒤·새 상자·직원이 옮김)
// 고리 한 판: 판 뒤 카드, 갈고리가 멈춘 자리, 걸린 걸이(-1이면 없음), 출구까지 왔나
export type ServerMsg = Welcome | Join | Move | Correct | Leave | Coins | PlayOk | PlayNo | Play | Result | DoneNo | Pose | MachineMsg | Free | Bag
  | Spawn | Stock | TakeNo | CounterBeg | CounterBegNo | Beg | Gave | GiveNo | FigureMsg;

// 닫기 코드 (서버와 같은 값)
export const CLOSE_FULL = 4001;
export const CLOSE_UNKNOWN_GUEST = 4002;
export const CLOSE_OTHER_TAB = 4003;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';
const pose = (o: Record<string, unknown>) => num(o.x) && num(o.z) && num(o.dx) && num(o.dz);
const isPlayer = (v: unknown): v is PlayerView => {
  const o = v as Record<string, unknown>;
  return !!o && typeof o === 'object' && str(o.id) && str(o.nick) && num(o.color) && pose(o);
};

const isSpot = (v: unknown) => Array.isArray(v) && v.length === 13 && str(v[0]) && num(v[1]) && (v[2] === null || num(v[2])) && num(v[3])
  && num(v[4]) && num(v[5]) && num(v[6]) && num(v[7]) && num(v[8]) && ['n', 'c', 's'].includes(v[9]) && num(v[10]) && str(v[11]) && num(v[12]);
const isWon = (v: unknown) => Array.isArray(v) && v.length === 4 && str(v[0]) && num(v[1]) && str(v[2]) && num(v[3]);
const isPoseWire = (v: unknown) => Array.isArray(v) && v.length === 8 && v.every(num);
const isClawPose = (v: unknown) => Array.isArray(v) && v.length === 4 && v.every(num);
const isBox = (v: unknown): v is BoxWire => Array.isArray(v) && v.length === 7 && v.every(num);
const isFigures = (v: unknown) => !!v && typeof v === 'object' && Object.values(v).every(isBox);
const isMachines = (v: unknown) => !!v && typeof v === 'object' && Object.values(v).every((spots) => Array.isArray(spots) && spots.every(isSpot));

export function decode(raw: string): ServerMsg | null {
  let m: Record<string, unknown>;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  switch (m.t) {
    case 'welcome': return m.v === PROTOCOL && num(m.store) && isPlayer(m.you) && Array.isArray(m.players) && m.players.every(isPlayer)
      && num(m.coins) && num(m.bag) && isMachines(m.machines) && !!m.plays && typeof m.plays === 'object' && isFigures(m.figures) ? (m as Welcome) : null;
    case 'join': return isPlayer(m.p) ? (m as Join) : null;
    case 'move': return str(m.id) && pose(m) ? (m as Move) : null;
    case 'correct': return num(m.x) && num(m.z) ? (m as Correct) : null;
    case 'leave': return str(m.id) ? (m as Leave) : null;
    case 'coins': return num(m.n) && num(m.got) ? (m as Coins) : null;
    case 'play_ok': return str(m.m) && num(m.coins) && num(m.limit) ? (m as PlayOk) : null;
    case 'play_no': return str(m.m) && str(m.why) ? (m as PlayNo) : null;
    case 'play': return str(m.m) && str(m.id) ? (m as Play) : null;
    case 'result': return str(m.m) && str(m.id) && Array.isArray(m.won) && m.won.every(isWon) ? (m as Result) : null;
    case 'done_no': return str(m.m) && str(m.why) ? (m as DoneNo) : null;
    case 'pose': return str(m.m) && str(m.id) && isClawPose(m.c) && Array.isArray(m.d) && m.d.every(isPoseWire) ? (m as Pose) : null;
    case 'machine': return str(m.m) && Array.isArray(m.dolls) && m.dolls.every(isSpot) ? (m as MachineMsg) : null;
    case 'free': return str(m.m) ? (m as Free) : null;
    case 'bag': return num(m.n) ? (m as Bag) : null;
    case 'spawn': return str(m.m) && str(m.k) && str(m.rv) ? (m as Spawn) : null;
    case 'stock': return m.in === null || num(m.in) ? (m as Stock) : null;
    case 'figure': return str(m.m) && isBox(m.box) && typeof m.nudged === 'boolean' ? { t: 'figure', m: m.m, box: m.box, nudged: m.nudged } : null;
    case 'take_no': return num(m.c) && str(m.why) ? (m as TakeNo) : null;
    case 'cbeg': return str(m.id) && num(m.c) && num(m.n) ? (m as CounterBeg) : null;
    case 'cbeg_no': return num(m.c) && str(m.why) && num(m.wait) ? (m as CounterBegNo) : null;
    case 'beg': return str(m.id) && (m.room === null || num(m.room)) ? (m as Beg) : null;
    case 'gave': return str(m.from) && str(m.to) && num(m.n) ? (m as Gave) : null;
    case 'give_no': return str(m.why) ? (m as GiveNo) : null;
    default: return null;
  }
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

export function encodeMove(p: Vec2, d: Vec2): string {
  return JSON.stringify({ t: 'move', x: round(p.x, 2), z: round(p.z, 2), dx: round(d.x, 3), dz: round(d.z, 3) });
}

export const encodeTake = (c: number) => JSON.stringify({ t: 'take', c }); // 교환소 코인 받기
export const encodeCounterBeg = (c: number) => JSON.stringify({ t: 'cbeg', c }); // 교환소 조르기
export const encodeBeg = (on: boolean) => JSON.stringify({ t: 'beg', on }); // 맵 조르기 켜고 끄기
export const encodeGive = (to: string, n: number) => JSON.stringify({ t: 'give', to, n }); // 조르는 사람에게 코인 주기
export const encodePlay = (m: string) => JSON.stringify({ t: 'play', m });
const wire = (d: DollPose, digits: number): PoseWire => [d.uid, ...d.p.map((v) => round(v, digits)), ...d.q.map((v) => round(v, digits))] as PoseWire;
// 판 보고: 구멍에 빠진 인형 번호들과 멈춘 인형 전부의 자리·돌림 (소수 3자리)
export const encodeDone = (m: string, won: number[], dolls: DollPose[]) => JSON.stringify({ t: 'done', m, won, dolls: dolls.map((d) => wire(d, 3)) });
// 중계: 집게 자리·벌림과 움직이는 인형들만 (소수 2자리)
export const encodePose = (m: string, c: ClawPose, d: DollPose[]) =>
  JSON.stringify({ t: 'pose', m, c: c.map((v) => round(v, 2)), d: d.map((x) => wire(x, 2)) });
export const encodeStand = () => JSON.stringify({ t: 'stand' }); // 판 사이에 "그만하기"
export const encodeTick = () => JSON.stringify({ t: 'tick' }); // 다음 채울 시각이 지났다 — 아무도 움직이지 않아도 서버가 채우게

// 다른 형식 버전의 서버가 보낸 welcome (해석하기 전에 본다 — 형식이 달라 해석이 실패할 수 있으므로)
export function needsReload(raw: string): boolean {
  try {
    const m = JSON.parse(raw);
    return !!m && m.t === 'welcome' && m.v !== PROTOCOL;
  } catch {
    return false;
  }
}
