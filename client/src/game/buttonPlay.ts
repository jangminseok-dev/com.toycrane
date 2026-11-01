import type * as THREE from 'three';

// 버튼으로 하는 기계(피규어·고리·미는 뽑기)의 한 판 — main.ts가 기계 종류와 상관없이 같은 길로 부른다(설계 2026-11-02 §8)
export type ButtonSession = { readonly machineId: string; remaining(now: number): number };

export interface ButtonPlay {
  readonly session: ButtonSession | null; // 버튼 단계
  readonly hint: string; // 판을 시작할 때 3초 안내
  handles(id: string): boolean;
  start(id: string, limit: number, now: number): void;
  pick(ray: THREE.Raycaster): 1 | 2 | null;
  press(button: 1 | 2): boolean;
  release(button: 1 | 2, now: number): void;
  frame(dt: number, now: number): void;
  cycling(): boolean; // 내 판의 결과를 그리는 중(캐릭터는 제자리)
  resulted(id: string): void; // 결과를 받았다 — 결과 기다리기 끝
  refused(id: string): void; // 서버가 거절(done_no)
  finished(id: string): Promise<void>; // result를 받은 그 자리에서 부른다 — 뒤따르는 결과 그리기(찌르기·밀기)가 끝나면 풀림, 당첨 카드는 그 뒤에
  readonly prizeWord: string; // 경품 이름 끝말(키링·미니 인형) — 피규어는 상자 까기라 따로
  end(): void;
  cameraPose(id: string, now: number, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 };
  buttonAt(button: 1 | 2, camera: THREE.Camera): { x: number; y: number } | null;
}

// 결과 그리기 기다리기(고리·미는 뽑기): 서버는 result 다음에 그리기 메시지(ring·pusher)를 보낸다. result를 받을 때 wait하면
// 그 뒤에 오는 메시지(번호 = 지금까지 받은 수 + 1)의 그리기가 끝날 때 풀린다 — 앞 판 그리기가 끝나도, 앞 기다림의 대비 시계가 울려도 풀리지 않는다.
// 메시지가 끝내 안 오면 대비 시계(fallbackMs)로 풀린다
export class FinishWaits {
  private received = new Map<string, number>();
  private waits = new Map<string, { want: number; done(): void }[]>();
  constructor(private fallbackMs: number) {}

  arrived(id: string): number {
    const seq = (this.received.get(id) ?? 0) + 1;
    this.received.set(id, seq);
    return seq;
  }

  wait(id: string): Promise<void> {
    return new Promise((resolve) => {
      const list = this.waits.get(id) ?? [];
      const w = { want: (this.received.get(id) ?? 0) + 1, done: () => { clearTimeout(timer); this.drop(id, w); resolve(); } };
      const timer = setTimeout(w.done, this.fallbackMs);
      list.push(w); this.waits.set(id, list);
    });
  }

  finished(id: string, seq: number): void {
    for (const w of [...(this.waits.get(id) ?? [])]) if (w.want <= seq) w.done();
  }

  private drop(id: string, w: { want: number; done(): void }): void {
    const list = (this.waits.get(id) ?? []).filter((x) => x !== w);
    if (list.length) this.waits.set(id, list); else this.waits.delete(id);
  }
}
