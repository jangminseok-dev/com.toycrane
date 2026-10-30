// 서버와 주고받는 메시지 형식. 견본: shared/protocol_fixtures.json (서버 server_messages.py·move_schema.py와 같은 형식)
import type { Vec2 } from '../game/movement';

export type PlayerView = { id: string; nick: string; color: number; x: number; z: number; dx: number; dz: number };
// 기계 속 인형 한 칸 [id, x, z, 몸 돌림] (기계 안 좌표)
export type DollSpot = [string, number, number, number];
export type Welcome = {
  t: 'welcome'; store: number; you: PlayerView; players: PlayerView[];
  coins: number; bag: number; machines: Record<string, DollSpot[]>; queues: string[][]; plays: Record<string, string>;
};
export type Join = { t: 'join'; p: PlayerView };
export type Move = { t: 'move'; id: string; x: number; z: number; dx: number; dz: number };
export type Correct = { t: 'correct'; x: number; z: number };
export type Leave = { t: 'leave'; id: string };
export type QueueMsg = { t: 'queue'; c: number; ids: string[] };
export type QueueNo = { t: 'queue_no'; c: number; why: string };
export type Coins = { t: 'coins'; n: number; got: number };
export type ServerMsg = Welcome | Join | Move | Correct | Leave | QueueMsg | QueueNo | Coins;

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

const isSpot = (v: unknown) => Array.isArray(v) && v.length === 4 && str(v[0]) && num(v[1]) && num(v[2]) && num(v[3]);
const isMachines = (v: unknown) => !!v && typeof v === 'object' && Object.values(v).every((spots) => Array.isArray(spots) && spots.every(isSpot));

export function decode(raw: string): ServerMsg | null {
  let m: Record<string, unknown>;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  switch (m.t) {
    case 'welcome': return num(m.store) && isPlayer(m.you) && Array.isArray(m.players) && m.players.every(isPlayer)
      && num(m.coins) && num(m.bag) && isMachines(m.machines) && Array.isArray(m.queues) && !!m.plays && typeof m.plays === 'object' ? (m as Welcome) : null;
    case 'join': return isPlayer(m.p) ? (m as Join) : null;
    case 'move': return str(m.id) && pose(m) ? (m as Move) : null;
    case 'correct': return num(m.x) && num(m.z) ? (m as Correct) : null;
    case 'leave': return str(m.id) ? (m as Leave) : null;
    case 'queue': return num(m.c) && Array.isArray(m.ids) && m.ids.every(str) ? (m as QueueMsg) : null;
    case 'queue_no': return num(m.c) && str(m.why) ? (m as QueueNo) : null;
    case 'coins': return num(m.n) && num(m.got) ? (m as Coins) : null;
    default: return null;
  }
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

export function encodeMove(p: Vec2, d: Vec2): string {
  return JSON.stringify({ t: 'move', x: round(p.x, 2), z: round(p.z, 2), dx: round(d.x, 3), dz: round(d.z, 3) });
}

export const encodeQueue = (c: number) => JSON.stringify({ t: 'queue', c });
export const encodeUnqueue = () => JSON.stringify({ t: 'unqueue' });
export const encodeTake = () => JSON.stringify({ t: 'take' });
