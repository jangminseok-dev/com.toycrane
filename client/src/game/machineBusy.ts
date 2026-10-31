// 남이 하는 기계 표시: 그 판이 끝날 시간(제한 + 여유 3초)이 지나면 저절로 풀린 것으로 본다 —
// 버튼을 다시 보여야 서버가 만료된 잠금을 인수하는 길이 열린다 (탭을 내린 채 떠난 사람이 기계를 붙잡지 않게).
// 판이 끝나면 서버가 그 사람이 이어서 할 수 있게 자리를 잡아 두므로(hold) 그 시간 동안도 "하는 중"이다.
// 내린 뒤 집게 한 바퀴와 멈춤 대기(cycleSeconds, 물리 뽑기 설계 §4.4)도 그 판이다
const SLACK = 3;

export class MachineBusy {
  private rows = new Map<string, { who: string; until: number }>();

  constructor(private limit: number, private holdSeconds: number, private cycleSeconds = 0) {}

  set(machineId: string, who: string, now: number): void {
    this.rows.set(machineId, { who, until: now + this.limit + this.cycleSeconds + SLACK });
  }

  // 한 판이 끝났다: 이어서 할 수 있게 잡아 둔 자리
  hold(machineId: string, who: string, now: number): void {
    this.rows.set(machineId, { who, until: now + this.holdSeconds });
  }

  clear(machineId: string): void {
    this.rows.delete(machineId);
  }

  // 나간 사람이 하던 기계들을 풀고 그 기계 id들을 돌려준다
  clearPlayer(who: string): string[] {
    const gone = [...this.rows].filter(([, r]) => r.who === who).map(([m]) => m);
    gone.forEach((m) => this.rows.delete(m));
    return gone;
  }

  reset(): void {
    this.rows.clear();
  }

  who(machineId: string, now: number): string | null {
    const r = this.rows.get(machineId);
    return r && now <= r.until ? r.who : null;
  }
}
