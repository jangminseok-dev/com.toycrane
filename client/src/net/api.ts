// 서버 HTTP API (같은 주소). 형식: docs/superpowers/plans/2026-10-30-toycrane-plan1-walk-together.md "메시지 형식"
export type Guest = { guestId: string; nickname: string; color: number };

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function createGuest(nickname: string): Promise<Guest | 'bad_nickname'> {
  const res = await post('/api/guest', { nickname });
  if (res.status === 400) return 'bad_nickname';
  if (!res.ok) throw new Error(`guest ${res.status}`);
  return res.json();
}

export async function getGuest(id: string): Promise<Guest | null> {
  const res = await fetch(`/api/guest/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`guest ${res.status}`);
  return res.json();
}

export async function admit(guestId: string): Promise<{ store: number } | { full: true } | 'unknown_guest'> {
  const res = await post('/api/admission', { guestId });
  if (res.status === 404) return 'unknown_guest';
  if (!res.ok) throw new Error(`admission ${res.status}`);
  return res.json();
}

// 가방 보기(설계 2026-11-02 §5): 뽑은 것 목록, 처음 뽑은 때가 늦은 것부터
export type BagEntry = { doll: string; color: number; rare: string; zone: string; count: number; first_at: number };
export async function getBag(guestId: string): Promise<BagEntry[]> {
  const res = await fetch(`/api/bag/${encodeURIComponent(guestId)}`);
  if (!res.ok) throw new Error(`bag ${res.status}`);
  return (await res.json()).items;
}
