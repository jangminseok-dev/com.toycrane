// 서버와 주고받는 메시지 형식. 견본: shared/protocol_fixtures.json (서버 server_messages.py·move_schema.py와 같은 형식)
import type { Vec2 } from '../game/movement';

export type PlayerView = { id: string; nick: string; color: number; x: number; z: number; dx: number; dz: number };
// 메시지 형식 버전 — 서버 welcome의 v와 다르면(배포로 형식이 바뀜) 화면을 새로고침한다
export const PROTOCOL = 2;
export type Body = 'n' | 'c' | 's'; // 보통 · 뚱뚱 · 마른
// 기계 속 인형 한 칸 [캐릭터, x, z, 몸 돌림, 얹힌 높이, 색, 체형, 표정, 희귀, 번호] (기계 안 좌표, 바닥이면 높이 0.
// 희귀: '' 일반 · 효과 id · 'gold'. 번호는 기계 안에서 그 인형을 가리킨다 — 새로 채워진 인형을 알아본다)
export type DollSpot = [kind: string, x: number, z: number, r: number, y: number, color: number, body: Body, face: number, rare: string, uid: number];
// 인형 하나의 겉모습 (world/dolls.ts makeDoll)
export type DollLook = { color: number; body: Body; face: number; rare: string };
export const lookOf = (s: DollSpot): DollLook => ({ color: s[5], body: s[6], face: s[7], rare: s[8] });
export type Welcome = {
  t: 'welcome'; v: number; store: number; you: PlayerView; players: PlayerView[];
  coins: number; bag: number; machines: Record<string, DollSpot[]>; queues?: string[][]; plays: Record<string, string>; // queues: 옛 줄 — 5단계 Task 5에서 지움
};
export type Join = { t: 'join'; p: PlayerView };
export type Move = { t: 'move'; id: string; x: number; z: number; dx: number; dz: number };
export type Correct = { t: 'correct'; x: number; z: number };
export type Leave = { t: 'leave'; id: string };
export type QueueMsg = { t: 'queue'; c: number; ids: string[] };
export type QueueNo = { t: 'queue_no'; c: number; why: string };
export type Coins = { t: 'coins'; n: number; got: number };
export type PlayOk = { t: 'play_ok'; m: string; coins: number; limit: number };
export type PlayNo = { t: 'play_no'; m: string; why: 'busy' | 'coins' | 'far' | 'playing' };
export type Play = { t: 'play'; m: string; id: string };
export type Outcome = 'win' | 'slip' | 'miss';
export type Result = {
  t: 'result'; m: string; id: string; x: number; z: number; o: Outcome; part: 'head' | 'body' | 'arm' | 'none'; k: string | null;
  i?: number | null; // 잡은 인형이 기계 속 배치에서 몇 번째인지 (빈 곳이면 null)
  c?: number | null; rv?: string | null; // 그 인형의 색·희귀 (당첨 이름)
};
export type MachineMsg = { t: 'machine'; m: string; dolls: DollSpot[] };
export type Free = { t: 'free'; m: string };
export type Bag = { t: 'bag'; n: number };
export type Spawn = { t: 'spawn'; m: string; k: string; rv: string }; // 희귀·황금이 채워졌다
export type Stock = { t: 'stock'; in: number | null }; // 다음 채울 때까지 남은 초 (가득이면 null)
export type ServerMsg = Welcome | Join | Move | Correct | Leave | QueueMsg | QueueNo | Coins | PlayOk | PlayNo | Play | Result | MachineMsg | Free | Bag
  | Spawn | Stock;

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

const isSpot = (v: unknown) => Array.isArray(v) && v.length === 10 && str(v[0]) && num(v[1]) && num(v[2]) && num(v[3]) && num(v[4])
  && num(v[5]) && ['n', 'c', 's'].includes(v[6]) && num(v[7]) && str(v[8]) && num(v[9]);
const isMachines = (v: unknown) => !!v && typeof v === 'object' && Object.values(v).every((spots) => Array.isArray(spots) && spots.every(isSpot));

export function decode(raw: string): ServerMsg | null {
  let m: Record<string, unknown>;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  switch (m.t) {
    case 'welcome': return m.v === PROTOCOL && num(m.store) && isPlayer(m.you) && Array.isArray(m.players) && m.players.every(isPlayer)
      && num(m.coins) && num(m.bag) && isMachines(m.machines) && !!m.plays && typeof m.plays === 'object' ? (m as Welcome) : null;
    case 'join': return isPlayer(m.p) ? (m as Join) : null;
    case 'move': return str(m.id) && pose(m) ? (m as Move) : null;
    case 'correct': return num(m.x) && num(m.z) ? (m as Correct) : null;
    case 'leave': return str(m.id) ? (m as Leave) : null;
    case 'queue': return num(m.c) && Array.isArray(m.ids) && m.ids.every(str) ? (m as QueueMsg) : null;
    case 'queue_no': return num(m.c) && str(m.why) ? (m as QueueNo) : null;
    case 'coins': return num(m.n) && num(m.got) ? (m as Coins) : null;
    case 'play_ok': return str(m.m) && num(m.coins) && num(m.limit) ? (m as PlayOk) : null;
    case 'play_no': return str(m.m) && str(m.why) ? (m as PlayNo) : null;
    case 'play': return str(m.m) && str(m.id) ? (m as Play) : null;
    case 'result': return str(m.m) && str(m.id) && num(m.x) && num(m.z) && ['win', 'slip', 'miss'].includes(m.o as string)
      && str(m.part) && (m.k === null || str(m.k)) ? (m as Result) : null;
    case 'machine': return str(m.m) && Array.isArray(m.dolls) && m.dolls.every(isSpot) ? (m as MachineMsg) : null;
    case 'free': return str(m.m) ? (m as Free) : null;
    case 'bag': return num(m.n) ? (m as Bag) : null;
    case 'spawn': return str(m.m) && str(m.k) && str(m.rv) ? (m as Spawn) : null;
    case 'stock': return m.in === null || num(m.in) ? (m as Stock) : null;
    default: return null;
  }
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

export function encodeMove(p: Vec2, d: Vec2): string {
  return JSON.stringify({ t: 'move', x: round(p.x, 2), z: round(p.z, 2), dx: round(d.x, 3), dz: round(d.z, 3) });
}

export const encodeQueue = (c: number) => JSON.stringify({ t: 'queue', c });
export const encodeUnqueue = () => JSON.stringify({ t: 'unqueue' });
export const encodeTake = (c = 0) => JSON.stringify({ t: 'take', c }); // 5단계 Task 5·7에서 교환소 번호를 꼭 넘기게
export const encodePlay = (m: string) => JSON.stringify({ t: 'play', m });
export const encodeDrop = (x: number, z: number) => JSON.stringify({ t: 'drop', x: round(x, 3), z: round(z, 3) });
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
