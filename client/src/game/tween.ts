// 짧은 움직임(모션·연출)을 시간에 맞춰 돌리는 트윈 (시제품 spike-arcade-big-v3.html 922~927행)
export type Ease = (k: number) => number;
export const ease = {
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out: (k: number) => 1 - (1 - k) ** 3,
  in: (k: number) => k * k * k,
  back: (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
  lin: (k: number) => k,
};

type Running = { t: number; dur: number; fn: (k: number) => void; e: Ease; res: () => void };

export class Tweens {
  private list: Running[] = [];

  tween(dur: number, fn: (k: number) => void, e: Ease = ease.inOut): Promise<void> {
    return new Promise((res) => this.list.push({ t: 0, dur, fn, e, res }));
  }

  wait(seconds: number): Promise<void> {
    return this.tween(seconds, () => {});
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.fn(tw.e(k));
      if (k >= 1) { this.list.splice(i, 1); tw.res(); }
    }
  }
}
