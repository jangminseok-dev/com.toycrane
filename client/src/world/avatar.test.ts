import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { makeAvatar } from './avatar';

beforeAll(stubCanvas);

// 기계를 하는 동안 내 이름표가 카메라 바로 앞에서 화면을 가리지 않게 숨긴다
test('label can be hidden and shown again', () => {
  const a = makeAvatar(0, '토끼');
  const label = a.root.children.find((o) => (o as { isSprite?: boolean }).isSprite)!;
  a.setLabelVisible(false); expect(label.visible).toBe(false);
  a.setLabelVisible(true); expect(label.visible).toBe(true);
});
