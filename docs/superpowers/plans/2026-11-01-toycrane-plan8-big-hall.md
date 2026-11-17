# 큰 홀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매장을 약 44m × 44m 광장형 큰 홀로 키우고(인형 24대 서쪽 이전, 피규어·고리·미는 뽑기 '준비 중' 자리, 광장 진열탑·광고판), 광장에서 카메라가 높이 빠지며, 휴대폰 성능을 지킨다.

**Architecture:** 매장 치수(`hall`)·기계 자리·장애물·장식을 `shared/store_layout.json` 하나에 두고 화면·서버가 같이 읽는다. 화면은 기계 줄을 배치 데이터에서 만들고(지금 'wall'·'island' 고정), 광장 진열탑·광고판·장식을 새로 그리며, 걷기 카메라는 광장 거리로 섞는다. 먼 기계 묶음은 가벼운 인형(far)으로 바꿔 그린다.

**Tech Stack:** three.js + TypeScript(client, vitest), Python Cloudflare Workers + Durable Objects(server, pytest, import-linter), `server/scripts/gen_shared.py`.

**Spec:** `docs/superpowers/specs/2026-11-01-toycrane-big-hall-design.md`

## Global Constraints

- 무료로만(유료 상품 금지). 배포는 매번 사용자 허락 뒤.
- 한 매장 정원 `STORE_CAPACITY = 50` 그대로.
- 화면 문구: 한국어만, 일본어 없음, 가운데 점(·)으로 문장 잇지 않기.
- 인형 기계 번호(A-1…A-13, C-1…C-11)·기계마다 캐릭터(kind)·저장 키 `machines_v5`·기계 속 인형 배치는 그대로. 메시지 규약은 6 → 7.
- 휴대폰 기계 앞 그리기 호출 ≤ 160(`client/e2e/perf.mjs` phone `machine_phone`).
- 시제품은 스크린샷으로 먼저 확인한 뒤 사용자에게 보인다.
- 커밋 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 새 장애물 사이에 갇히거나 기계 앞자리·교환소 창구에 못 가는 자리 → 스폰에서 모든 인형 기계 앞자리와 교환소 창구까지 0.25m 격자 길이 있다 (Task 1 `every machine front and counter window is reachable from spawn`).
2. 화면과 서버의 걸을 수 있는 범위가 어긋나 서버가 위치를 되돌림 → 둘 다 `shared/store_layout.json`의 `hall`에서 읽는다 (Task 1, 서버 `test_hall_values_come_from_shared_layout`).
3. 배포 직후 열려 있던 옛 화면이 옛 배치로 걸음 → 규약 7 (Task 9).
4. 광장에서 카메라가 빠져 한꺼번에 보이는 게 늘어 휴대폰이 버벅임 → 휴대폰 광장 걷기 그리기 호출 ≤ 400·삼각형 ≤ 180만 (Task 7·9 측정 관문).
5. 기계를 옮기며 번호·캐릭터가 섞여 저장된 인형이 다른 기계에 나타남 → 기계 번호·캐릭터 짝이 옛 배치와 같다 (Task 1 `machine ids and kinds are unchanged`).

---

### Task 1: 홀 배치 데이터 (공용)

**Files:**
- Modify: `shared/store_layout.json`, `client/src/data/storeLayout.ts`, `client/src/world/layout.ts`, `client/src/world/layout.test.ts`, `server/src/toycrane/domain/store_rules.py`, `server/src/toycrane/domain/shared_data.py`(gen_shared로)
- Create: `client/src/data/storeLayout.test.ts`
- Test: `server/tests/domain/test_store_rules.py`(있는 파일에 더함)

**Interfaces:**
- Produces: `shared/store_layout.json` 맨 위 `"hall": {"room_half": 22, "map_half": 21.6, "tower_half": 1.6, "spawn_radius": 3.6, "plaza_radius": 8.5}`. 화면 `layout.ts`의 `ROOM_HALF·MAP_HALF·TOWER_HALF·SPAWN_RADIUS·PLAZA_RADIUS`(값은 JSON에서). `MachineSpot.row: string`. `DecorSpot.kind: 'figure' | 'ring' | 'pusher' | 'shelf' | 'bench'`. `Zone = 'doll' | 'figure' | 'north' | 'plaza' | 'rest' | 'path'`, `zoneAt(x, z): Zone`. 서버 `store_rules.MAP_HALF·TOWER_HALF·SPAWN_RADIUS`(값은 `LAYOUT["hall"]`에서). `HUB_HALF`는 지운다.

배치 값(시제품 관문 Task 7에서 사용자 승인 전까지 조정 가능):
- 인형 24대: 줄 `d1` = A-1…A-8, `d2` = A-9…A-13·C-1…C-3, `d3` = C-4…C-11. 줄 x = −20.2, −16.4, −12.6, 줄마다 z = −7 + 2i (i = 0…7), `ry = 1.570796`(동쪽, 광장을 봄). 장애물은 줄마다 `[x−0.75, −7.85, x+0.75, 7.85]`.
- 탑 장애물 `[−1.6, −1.6, 1.6, 1.6]`.
- 교환소 4곳: (−10, −10.5)·(10, −10.5) `ry 0`, (−10, 10.5)·(10, 10.5) `ry 3.141593`, 창구는 `ry` 쪽으로 0.85m. 장애물 `[x±0.65, z±0.35]`.
- 장식(장애물이기도 함, 벽 쪽 변은 벽 너머 ±23까지): 피규어 두 줄 `ry −1.570796` x = 13.2·18.2(7대씩, z −7.8…7.8), 고리 두 줄 `ry 0` z = −20.3(x −11…−3.4, 3.4…11, 5대씩), 미는 뽑기 한 줄 `ry 0` z = −16.6(x −4.2…4.2, 4대), 벤치 남쪽 두 모서리, 진열장 두 개(쉼터 벽 쪽).

- [ ] **Step 1: Write the failing tests** — `client/src/data/storeLayout.test.ts`:

```ts
test('machine ids and kinds are unchanged', () => {
  expect(MACHINES.map((m) => `${m.id}:${m.kind}`)).toEqual(OLD_PAIRS); // OLD_PAIRS: 옛 배치의 24쌍을 시험 파일에 그대로 적는다(A-1:bunny … C-11:unicorn)
});
test('doll machines stand in the west wing facing the plaza', () => {
  for (const m of MACHINES) { expect(m.x).toBeLessThan(-PLAZA_RADIUS); expect(m.ry).toBeCloseTo(Math.PI / 2); }
  expect(new Set(MACHINES.map((m) => m.row)).size).toBe(3);
});
test('every machine front and counter window is reachable from spawn', () => {
  // 0.25m 격자, 장애물 0.35m 여유(e2e route와 같은 규칙), 스폰 (SPAWN_RADIUS, 0)에서 BFS
  for (const m of MACHINES) expect(reachable(frontSpot(m)), m.id).toBe(true);
  for (const c of COUNTERS) expect(reachable({ x: c.window[0], z: c.window[1] }), `counter ${c.id}`).toBe(true);
});
test('no two obstacles of machines, counters and decor overlap', () => { /* 사각형 쌍마다 겹침 넓이 0 */ });
test('from the nearest counter every doll machine is a short walk', () => {
  for (const m of MACHINES) expect(Math.min(...COUNTERS.map((c) => routeLength({ x: c.window[0], z: c.window[1] }, frontSpot(m)))), m.id).toBeLessThan(20); // m, 같은 격자 길
});
```

`layout.test.ts`: `zoneAt(0,0)='plaza'`, `(-16,0)='doll'`, `(16,0)='figure'`, `(0,-18)='north'`, `(-17,18)='rest'`, `(0,15)='path'`.
서버 `test_store_rules.py`: `test_hall_values_come_from_shared_layout` — `MAP_HALF == LAYOUT["hall"]["map_half"]` 등 셋, `test_spawn_ring_clears_the_tower` — 여러 seed의 스폰이 탑 장애물 밖이고 `clamp_to_floor`로 안 바뀐다.

- [ ] **Step 2: Run** `cd client && npx vitest run src/data src/world/layout.test.ts` · `cd server && uv run pytest -q tests/domain` — Expected: FAIL(새 값·새 zone·hall 키 없음).
- [ ] **Step 3: Implement** JSON 값(위 배치 값), 화면 상수·타입·`zoneAt`, 서버 상수를 `LAYOUT["hall"]`에서, `uv run python scripts/gen_shared.py`.
- [ ] **Step 4: Run** 위 두 명령 + `cd client && npx tsc --noEmit -p .` — Expected: PASS. (다른 화면 시험의 실패는 Task 2~6이 맞춘다 — 이 Task는 `src/data src/world/layout.test.ts`·서버만 초록.)
- [ ] **Step 5: Commit** `feat: 큰 홀 — 공용 홀 치수, 인형 24대 서쪽 이전, 교환소·장식 자리`

### Task 2: 기계 줄을 배치에서 만들기

**Files:**
- Modify: `client/src/world/bigZone.ts`, `client/src/world/bigZone.test.ts`

**Interfaces:**
- Consumes: Task 1 `MachineSpot.row: string`.
- Produces: `buildBigZone`의 줄 = `MACHINES`에 나오는 순서대로의 서로 다른 `row` 값(지금 `['wall','island']` 고정을 없앤다). 묶음 이름 `dolls-big-${row}-${i}`.

- [ ] **Step 1: Write the failing test** — `test('rows come from the layout, three doll rows of at most six per block')`: 장면의 `dolls-` 묶음 이름에서 줄 이름 집합이 `{'d1','d2','d3'}`, 묶음 수 6.
- [ ] **Step 2: Run** `npx vitest run src/world/bigZone.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** 줄 목록을 배치에서. `occluders`·`controlRows`·`bulbRows`·`markRows`는 그대로 줄마다.
- [ ] **Step 4: Run** `npx vitest run src/world/bigZone.test.ts` — Expected: PASS(옛 시험 중 'groups.length 5'는 6으로 고치고 Ruling).
- [ ] **Step 5: Commit** `feat: 큰 홀 — 기계 줄을 배치 데이터에서`

### Task 3: 큰 방, 진열탑, 구역 바닥

**Files:**
- Modify: `client/src/world/storeScene.ts`, `client/src/world/storeScene.test.ts`

**Interfaces:**
- Consumes: Task 1 상수·`zoneAt`.
- Produces: `buildStore(scene): HubTower` 그대로(타입 그대로: `box`, `setOpacity`, `showMessage`). 탑 메시 이름 `display-tower`. 남쪽 벽 가운데 입구 장식 이름 `entrance`.

진열탑: 바닥 3.2m 네모, 3단(아래가 넓음), 높이 4.5m 이하. 단마다 큰 인형(`makeDoll(id, PLAIN, true)`, 크기 0.55~0.8)과 **피규어 상자**(카드보드 색 상자 + 앞면 투명 창 안에 작은 인형 0.25) — 피규어 모델은 만들지 않는다. 지금 4면 전광판을 탑 꼭대기에. 벽 광고 간판 10장은 새 벽 네 면에 고르게(한 메시 그대로).

- [ ] **Step 1: Write the failing tests** — `test('the display tower stands in the plaza with the four-sided board on top')`: `display-tower` 있음, 상자 높이 ≤ 4.5, 전광판 4면이 탑 꼭대기 근처(y ≥ 3), `box`가 `TOWER_HALF`와 같다. `test('the walls enclose the big hall')`: 벽 메시들의 범위가 `±ROOM_HALF`. 옛 'ten ad signs …' 시험은 그대로 통과해야 한다.
- [ ] **Step 2: Run** `npx vitest run src/world/storeScene.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** 방 크기·바닥·벽(`ROOM_HALF`), 구역 바닥 칠(`zoneAt`의 새 구역), 진열탑, 입구.
- [ ] **Step 4: Run** `npx vitest run src/world/storeScene.test.ts src/world/layout.test.ts` — Expected: PASS, 'the store stays a handful of draw calls' 기준 그대로.
- [ ] **Step 5: Commit** `feat: 큰 홀 — 큰 방, 광장 진열탑, 구역 바닥`

### Task 4: 광장 광고판과 광고 설정 파일

**Files:**
- Create: `shared/ads.json`, `client/src/world/ads.ts`, `client/src/world/ads.test.ts`
- Modify: `client/src/world/copy.ts`(AD_SIGNS를 ads.json에서), `client/src/world/signs.ts`, `client/src/world/storeScene.ts`, `client/src/main.ts`(탑 갱신 호출)

**Interfaces:**
- Produces: `shared/ads.json` = `{"slots": [{"id": 1, "text": "광고문의1", "image": null}, … {"id": 14, "text": "광고문의14", "image": null}]}` — 1~10 벽 간판, 11~14 광장 광고판. `image`가 문자열이면 같은 출처의 그림 경로(예: `/ads/1.png`), 있으면 글 대신 그림. `ads.ts`: `export const AD_SLOTS: AdSlot[]`, `export type AdSlot = { id: number; text: string; image: string | null }`. `HubTower`에 `update(t: number): void` 추가 — 알림이 없을 때 8초마다 다음 광고 문구를 전광판에 띄운다.

광장 광고판: 양면 세움판 4개(약 2.4m × 1.4m, 기둥), 면은 ±z(카메라가 늘 북쪽을 보므로 남쪽 면이 보임), 자리 (±5.6, ±6.4), 장애물로 더한다(Task 1의 경로 시험이 여전히 통과).

- [ ] **Step 1: Write the failing tests** — `ads.test.ts`: `AD_SLOTS`가 14개, id 1~14, 글 '광고문의N'. `storeScene.test.ts`: `test('four plaza ad boards show slots 11 to 14')` — 이름 `plaza-ads` 메시 하나, 그림 칸 4개가 슬롯 11~14 문구로 그려짐(캔버스 스텁의 fillText 기록으로), `test('the tower board shows an ad when idle')` — `update(0)`·`update(8.1)`에서 전광판 문구가 슬롯 문구로 바뀌고, `showMessage` 중에는 바뀌지 않는다.
- [ ] **Step 2: Run** `npx vitest run src/world/ads.test.ts src/world/storeScene.test.ts src/world/copy.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** 위 인터페이스대로. `main.ts`의 프레임에서 `tower.update(t)`.
- [ ] **Step 4: Run** 같은 명령 + `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: 큰 홀 — 광장 광고판, 광고 설정 파일, 탑 전광판 광고`

### Task 5: '준비 중' 장식 — 피규어·고리·미는 뽑기·벤치

**Files:**
- Modify: `client/src/world/decor.ts`, `client/src/world/decor.test.ts`

**Interfaces:**
- Consumes: Task 1 `DecorSpot.kind`.
- Produces: `buildDecor(scene): Occluder[]` 그대로. 'mini' 모양은 'ring'(작은 덮인 기계)으로, 'pusher'는 2.2m × 2.0m 덮인 큰 기계, 'bench'는 벤치. 덮개에는 지금처럼 '준비 중' 카드.

- [ ] **Step 1: Write the failing test** — `test('every planned zone has covered machines: 14 figure, 10 ring, 4 pusher')`: 장식 칸 수를 종류별로 센다(장식이 칸마다 표지 이름 `decor-<kind>`를 남기게). 옛 'decor stays a few merged meshes …'는 그대로.
- [ ] **Step 2: Run** `npx vitest run src/world/decor.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npx vitest run src/world` — Expected: PASS(이 Task부터 `src/world` 전체 초록).
- [ ] **Step 5: Commit** `feat: 큰 홀 — 준비 중 기계(피규어·고리·미는 뽑기)와 쉼터`

### Task 6: 광장에서 높이 빠지는 카메라

**Files:**
- Modify: `client/src/game/followCamera.ts`
- Test: `client/src/game/followCamera.test.ts`

**Interfaces:**
- Produces: `followCamera(camera, at, dt)` 그대로. 내부 `export function plazaBlend(at: Vec2): number` — 광장 가운데에서 거리 ≤ `PLAZA_RADIUS`이면 1, ≥ `PLAZA_RADIUS + 3`이면 0, 사이는 smoothstep. 오프셋 = NEAR(지금 `WIDE`·`TALL`)와 FAR(`WIDE_FAR`, `TALL_FAR`)를 이 값으로 섞음. 시작값 `WIDE_FAR = (0, 15, 14)`, `TALL_FAR = (0, 24, 15)`(시험이 통과하는 값으로 조정).

- [ ] **Step 1: Write the failing tests**:

```ts
test('in the plaza the PC camera sees the front rows of both side zones', () => {
  const cam = settledCamera({ x: 0, z: 0 }, 1280 / 800); // followCamera를 dt 1로 여러 번
  for (const p of [[-11.45, 0, 0], [12.3, 0, 0]]) { const n = new THREE.Vector3(...p).project(cam); expect(Math.abs(n.x)).toBeLessThan(1); expect(Math.abs(n.y)).toBeLessThan(1); }
});
test('in the plaza the phone camera shows at least 10m of floor across the player', () => {
  const cam = settledCamera({ x: 0, z: 0 }, 390 / 844);
  expect(floorWidthAt(cam, { x: 0, z: 0 })).toBeGreaterThanOrEqual(10); // 내 자리 높이 0의 화면 가로 폭(m)
});
test('next to a machine row the camera is as close as before', () => {
  expect(settledCamera({ x: -11.45, z: 0 }, 1.6).position.y).toBeCloseTo(CAMERA_OFFSETS.WIDE.y, 1);
});
```

- [ ] **Step 2: Run** `npx vitest run src/game/followCamera.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npx vitest run src/game` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: 큰 홀 — 광장에서 높이 빠지는 걷기 카메라`

### Task 7: 시제품 관문 (사용자 승인)

- [ ] **Step 1:** `npm run build`, 로컬 서버에서 `node client/e2e/shot.mjs`로 PC·휴대폰 캡처: 입구 쪽 광장, 광장 한가운데(진열탑·광고판), 인형 구역, 피규어 구역, 북쪽 구역, 인형 기계 앞(한 판 화면). 먼저 내가 보고 어색한 것(겹침·떠 있음·가림·글자 잘림)을 고친다.
- [ ] **Step 2:** `node client/e2e/perf.mjs`로 걷기(광장 한가운데)·기계 앞 그리기 호출·삼각형을 잰다. 휴대폰 기계 앞 ≤ 160이 아니면 고친다.
- [ ] **Step 3:** 사용자에게 스크린샷과 수치를 보이고 배치·진열탑·광고판 승인을 받는다(여기서 멈춤). 바꿔 달라는 것은 Task 1~6의 값으로 고치고 다시 캡처.
- [ ] **Step 4: Commit** 승인 뒤 고친 값이 있으면 `fix: 큰 홀 — 시제품 피드백 반영`.

### Task 8: 먼 기계는 가벼운 인형으로

**Files:**
- Modify: `client/src/world/plush/kit.ts`, `client/src/world/plush/index.ts`, `client/src/world/dolls.ts`, `client/src/world/bigZone.ts`, `client/src/main.ts`
- Test: `client/src/world/dolls.test.ts`, `client/src/world/bigZone.test.ts`

**Interfaces:**
- Produces: `PlushBuilder` 옵션 `{ lite: boolean; far?: boolean }` — far: 공 [8,6](작은 공 [6,4]), 관 [8,5], 관 끝 [6,4], 돌림체 12×8, **외곽선 껍질 없음, 수놓은 실 없음**, 얼굴 그림은 남김. `makePlush(id, look, lite, far = false)`, `makeDoll(id, look = PLAIN, lite = false, far = false)`. `BigZone.setFocus(x: number, z: number): void` — 묶음 가운데가 초점에서 `FAR_DIST = 18`m 넘으면 far 덩어리, 안이면 lite 덩어리(경계 1m 여유로 깜빡임 없게). 두 덩어리는 묶음을 합칠 때 같이 만든다(바꿀 때 다시 합치지 않음). 위에서 보는 화면(TOP_LAYER)은 lite.

- [ ] **Step 1: Write the failing tests** — `dolls.test.ts`: `test('far dolls are a small fraction of pile dolls and keep their faces')` — 24종 far 평균 삼각형 ≤ 2,500, 종마다 얼굴(FACE_MAT) 메시 있음, 외곽선(PLUSH_OUTLINE) 없음. `bigZone.test.ts`: `test('blocks far from the focus draw far dolls and switch back when near')` — `setFocus(30, 0)` 뒤 서쪽 묶음은 far 보임·lite 숨김, `setFocus(-16, 0)` 뒤 반대.
- [ ] **Step 2: Run** `npx vitest run src/world/dolls.test.ts src/world/bigZone.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** 위 인터페이스대로, `main.ts` 프레임에서 `bigZone.setFocus(me.pos.x, me.pos.z)`. far 겉모습 캐시는 lite와 따로(같은 한도 `LITE_CACHE_MAX`), 새 겉모습 짓기는 지금의 프레임당 시간 안에서.
- [ ] **Step 4: Run** `npx vitest run src/world` + `node client/e2e/perf.mjs` — Expected: 시험 PASS, 휴대폰 광장 걷기 그리기 호출 ≤ 400·삼각형 ≤ 180만, 휴대폰 기계 앞 ≤ 160.
- [ ] **Step 5: Commit** `perf: 큰 홀 — 먼 기계는 가벼운 인형으로`

### Task 9: e2e 길 찾기, 규약 7, 기록, 리뷰 뒤 배포

**Files:**
- Create: `client/e2e/nav.mjs`
- Modify: `client/e2e/play.mjs`, `watch.mjs`, `run.mjs`, `determinism.mjs`, `perf.mjs`, `shot.mjs`, `client/src/net/protocol.ts`, `client/src/net/protocol.test.ts`, `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`, `shared/protocol_fixtures.json`, `docs/DEPLOY_LOG.md`

**Interfaces:**
- Produces: `client/e2e/nav.mjs` — `export const LAYOUT`, `export const HALF`(= `hall.map_half`), `export function route(from, to)`(0.25m 격자, 장애물 0.35m 여유 — 지금 스크립트마다 복사된 것을 한 곳으로), `export function frontOf(id)`(`ry`를 쓴 앞자리). 스크립트의 `{ x: 0, z: -5.4 }`·`FRONT_C6`는 `frontOf('C-6')`로. determinism은 두 화면 모두 들어간 뒤 `frontOf('C-6')` 근처로 걸어가 같은 기계들을 앉힌다.

- [ ] **Step 1:** 규약 시험을 7로(화면 `PROTOCOL` 시험, fixtures `v: 7`) → `npx vitest run src/net`·`uv run pytest -q` FAIL 확인 → 화면·서버 `PROTOCOL = 7` → PASS.
- [ ] **Step 2:** `nav.mjs`를 만들고 스크립트들을 옮긴다. 로컬 e2e: play·watch·run·mobile-entry·mobile-joystick PASS, determinism은 빈 저장소 서버(`uv run pywrangler dev --port 8799 --persist-to <빈 폴더>`, 먼저 `npx wrangler d1 migrations apply toycrane --local --persist-to <같은 폴더>`)에서 PASS(비교 2대 이상, 어긋남 0).
- [ ] **Step 3:** 전체: `cd client && npx vitest run src && npx tsc --noEmit -p . && npm run build`, `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`, 장면 시뮬 `npx vitest run --config vitest.sim.config.ts sim/scenes.test.ts` — PASS. `perf.mjs` 결과를 `client/e2e/perf-hall.json`에.
- [ ] **Step 4:** docs/DEPLOY_LOG.md 확인 기록에 8단계 큰 홀 줄(배치, 성능 수치, e2e). 커밋 `feat: 큰 홀 — 규약 7, e2e 길 찾기, 기록`.
- [ ] **Step 5:** 전체 브랜치 리뷰(가장 유능한 모델) → Critical·Important 한 번에 고치기 → 사용자에게 배포 허락(알릴 것: 매장이 바뀌어 열린 화면은 새로 고침, 기계 속 인형은 그대로) → 배포 → 라이브 play·run·determinism·콘솔 오류·스크린샷 → docs/DEPLOY_LOG.md에 Version.
