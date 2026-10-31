import type { Coins } from '../net/protocol';

// 코인 수(coins 메시지)를 언제 어떻게 보일지 (교환소 개편 설계 §4.2·§4.4, 최종 리뷰 I3)
// - 내 교환소 조르기가 오가는 동안(누름 → 3초 조르기 → 결과)은 코인 수와 안내를 잡아 두었다가 끝날 때 함께 보인다
// - 누가 준 코인은 '○○ 님이 코인 N개를 줬어요'가 떠 있으니 '🪙 +N'으로 덮지 않는다
export class CoinShow {
  private begging = false;
  private held: Coins | null = null;
  private note: string | null = null;
  private quiet = false;

  // 교환소 조르기를 눌렀다 — 이미 오가는 중이면 false (다시 보내지 않는다)
  startBeg(): boolean {
    if (this.begging) return false;
    this.begging = true;
    return true;
  }

  // 누가 내게 줬다 — 바로 뒤에 오는 coins는 알림 없이
  gaveMe(): void {
    this.quiet = true;
  }

  // coins가 왔다: 지금 보일 것(잡아 두면 null)과 '+N' 알림을 띄울지
  coins(m: Coins): { show: Coins | null; toast: boolean } {
    const quiet = this.quiet;
    this.quiet = false;
    if (this.begging) {
      this.held = m;
      return { show: null, toast: false };
    }
    return { show: m, toast: m.got > 0 && !quiet };
  }

  // 조르기 결과 안내('N분 뒤에 다시 와요')는 조르는 모션이 끝난 뒤에
  holdNote(text: string): void {
    this.note = text;
  }

  // 조르는 모션이 끝났다(또는 모션 없이 거절됐다): 잡아 둔 코인 수와 안내를 돌려주고 풀린다
  endBeg(): { coins: Coins | null; note: string | null } {
    const out = { coins: this.held, note: this.note };
    this.reset();
    return out;
  }

  reset(): void {
    this.begging = false;
    this.held = null;
    this.note = null;
    this.quiet = false;
  }
}
