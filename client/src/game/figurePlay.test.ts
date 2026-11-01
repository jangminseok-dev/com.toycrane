import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { FIGURE, FIGURES, variantOf } from '../data/figures';
import type { BoxWire, Pose } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { buildFigureZone } from '../world/figureZone';
import { FigurePlay } from './figurePlay';

beforeAll(stubCanvas);
const LYING = FIGURE.bars.y + FIGURE.bars.radius + variantOf('long').box.d / 2;
const SAVED: BoxWire = [0.01, LYING, -0.02, 0, 0, 0, 1]; // 서버가 저장한 상자
const F1 = FIGURES[0];
const make = () => {
  const zone = buildFigureZone(new THREE.Scene());
  const play = new FigurePlay(new THREE.Scene(), zone, { send: () => {}, rapier: () => null, onDrop: () => {}, onOverdue: () => {} });
  play.setBoxes({ [F1.id]: SAVED });
  return { zone, play };
};

// 판이 figure 메시지 없이 끝나면(하던 사람이 나감 → free) 구경하던 화면의 상자는 서버가 가진 자리로 돌아간다 —
// 중계로 본 마지막 자리(기울거나 이미 빠진 상자)가 남아 다음 판의 시작이 되면 하지도 않은 당첨이 난다 (최종 리뷰 I1)
test('stopping a watch puts the box back where the server keeps it', () => {
  const { zone, play } = make();
  play.watch(F1.id, { x: F1.x, z: F1.z });
  const pose: Pose = { t: 'pose', m: F1.id, id: 'p', c: [0, 1.5, 0, 1], d: [[0, 0.02, 0.8, 0.05, 0.2, 0, 0, 0.98]] };
  play.onPose(pose, 0); play.onPose({ ...pose, c: [0, 1.4, 0, 1] }, 0.1);
  play.frame(0.016, 0.3);
  expect(zone.boxOf(F1.id)[1]).toBeCloseTo(0.8);
  play.stopWatch(F1.id);
  expect(zone.boxOf(F1.id)).toEqual(SAVED);
});

// 내 판도 결과 없이 끝나면(결과를 못 받음·기계가 풀림) 화면 상자는 서버 자리로
test('ending my play without a figure message restores the saved box', () => {
  const { zone, play } = make();
  play.start(F1.id, 20, 0);
  zone.setBox(F1.id, [0.03, 0.8, 0.1, 0.3, 0, 0, 0.95]); // 물리 한 바퀴가 그린 자리
  play.end();
  expect(zone.boxOf(F1.id)).toEqual(SAVED);
});
