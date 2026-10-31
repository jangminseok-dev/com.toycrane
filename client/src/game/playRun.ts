// 여러 판 이어 하기 (2026-10-31 사용자 결정): '다섯 판'을 고르면 판 사이에 "한 번 더"를 묻지 않고 이어서 한다.
// 코인은 판을 시작할 때 서버가 1개씩 뺀다 — 중간에 그만하면 남은 코인은 그대로. 코인이 다섯 개가 안 되면 있는 만큼만
const MAX_RUN = 5;
const COUNT = ['', '한', '두', '세', '네', '다섯'];

// 코인으로 이어 할 수 있는 판 수와 버튼 이름 (두 판보다 적으면 없음)
export function runSize(coins: number): { plays: number; name: string } | null {
  const plays = Math.min(MAX_RUN, coins);
  return plays >= 2 ? { plays, name: `${COUNT[plays]} 판` } : null;
}

export class PlayRun {
  private total = 0;
  private played = 0;

  start(plays: number, coins: number): void {
    this.total = Math.min(plays, coins);
    this.played = 0;
  }

  // 한 판이 시작됐다 (play_ok)
  began(): void {
    if (this.played < this.total) this.played++;
  }

  // 판 사이: 묻지 않고 다음 판을 시작할까
  next(coins: number): boolean {
    return this.played < this.total && coins > 0;
  }

  stop(): void {
    this.total = 0;
    this.played = 0;
  }

  // 남은 시간 옆에 보이는 "2/5판" (한 판씩 할 때는 없음). upcoming: 판 사이에 다음 판 번호로
  label(upcoming = false): string | null {
    return this.total > 1 ? `${this.played + (upcoming ? 1 : 0)}/${this.total}판` : null;
  }
}
