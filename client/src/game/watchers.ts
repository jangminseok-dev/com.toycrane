// 내 판을 보고 있는 사람(사용자 2026-11-03 '누군가 보고 있다고만 느끼게'): 한 판 하는 동안 다른 사람 캐릭터는 숨기고,
// 내 자리에서 NEAR 안에 선 사람만 화면 구석 얼굴로 알린다. 자기 판을 하는 사람은 빼고, 먼저 온 사람이 앞에(얼굴이 자리를 바꾸지 않게).
// 언저리에 선 사람이 깜빡이지 않게 나갈 땐 LEAVE를 넘어야 빠진다
const NEAR = 3, LEAVE = 3.5;
type Person = { id: string; x: number; z: number };

export function watchersOf(prev: string[], at: { x: number; z: number }, people: Person[], playing: Set<string>): string[] {
  const inside = (p: Person, r: number) => !playing.has(p.id) && Math.hypot(p.x - at.x, p.z - at.z) <= r;
  const stay = prev.filter((id) => people.some((p) => p.id === id && inside(p, LEAVE)));
  return [...stay, ...people.filter((p) => !stay.includes(p.id) && inside(p, NEAR)).map((p) => p.id)];
}
