// 남이 하는 기계 표시: 그 판이 끝날 시간(제한 + 여유 3초)이 지나면 저절로 풀린 것으로 본다 —
// 버튼을 다시 보여야 서버가 만료된 잠금을 인수하는 길이 열린다 (탭을 내린 채 떠난 사람이 기계를 붙잡지 않게)
const SLACK = 3;

export class MachineBusy {
  private rows = new Map<string, { who: string; since: number }>();

  constructor(private limit: number) {}

  set(machineId: string, who: string, now: number): void {
    this.rows.set(machineId, { who, since: now });
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
    return r && now - r.since <= this.limit + SLACK ? r.who : null;
  }
}
