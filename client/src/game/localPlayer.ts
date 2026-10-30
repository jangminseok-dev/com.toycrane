import { step, type Vec2 } from './movement';

// 내 캐릭터 위치는 화면이 먼저 움직이고(바로 반응), 서버가 보정(correct)하면 따른다
export class LocalPlayer {
  pos: Vec2;
  dir: Vec2 = { x: 0, z: 0 };

  constructor(pos: Vec2) {
    this.pos = { ...pos };
  }

  tick(dt: number): void {
    this.pos = step(this.pos, this.dir, dt);
  }

  correct(p: Vec2): void {
    this.pos = { ...p };
  }
}
