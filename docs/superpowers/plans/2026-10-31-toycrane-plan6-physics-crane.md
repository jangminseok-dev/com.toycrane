# 물리 뽑기(A) 구현 계획 — Plan 6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버 주사위 대신 브라우저 물리(Rapier)로 집게가 인형을 쥐고 들고 옮기고 놓게 하고, 기계 안 모양(자리·돌림)이 판을 넘어 쌓이게 한다.

**Architecture:** 판을 하는 브라우저가 Rapier로 기계 속을 계산하고(`client/src/physics/`), 집게는 kinematic 몸 + 끊어지는 쥠 관절로 인형을 든다. 끝나면 `done`으로 결과와 멈춘 인형 자리·돌림을 서버에 보내고, 서버(`done` 슬라이스)는 상식만 확인해 저장·중계한다. 구경꾼은 `pose` 중계를 보간해 본다. 채우기는 서버가 (x, z)만 찍고 화면들이 같은 물리로 앉힌다(결정성).

**Tech Stack:** three.js 0.169 + `@dimforge/rapier3d-compat` 0.21 (WASM, 결정성 빌드), TypeScript/vitest; Python Workers + DO 저장소, pytest; `shared/*.json` → `scripts/gen_shared.py`.

**Spec:** `docs/superpowers/specs/2026-10-31-toycrane-physics-crane-design.md` (§9의 7개 판단 포함). 기존 설계 `2026-10-30-toycrane-design.md`, 채우기 설계 `2026-10-31-toycrane-machine-stock-design.md`.

## Global Constraints

- 무료 요금제만. 서버에서 물리를 돌리지 않는다. 타이머·알람으로 DO를 깨우지 않는다.
- 서버는 판정하지 않고 기록·중계만 한다 (스펙 §4.5). 확인은 치명 규칙만: 잠근 사람이 아님 / 인형 수 불일치 / 뽑힌 인형이 **3**을 넘음 / 번호가 기계에 없음 (§9.7). 자리는 상자 안으로 잘라 받는다.
- 집게는 판마다 똑같다: F = `base_force` × `claw_strength(x, z)`(구멍 가장자리 0.75 ~ 가장 먼 모서리 1.25) × 쥠의 질(셋 1.0 / 둘 0.6) × 희귀 배율(희귀 0.5 / 황금 0.3). 숫자는 `shared/claw.json` 하나에 둔다.
- 확률 목표(스펙 §8.1, 시뮬레이션): 보통 인형 머리 겨냥 성공 30~40%, 몸통(중심에서 8cm 옆) 13~22%, 희귀 13~22%, 황금 8~15%, 구멍 가까운 쪽 < 먼 쪽. 머리 확률이 우선.
- 규약 `PROTOCOL` 3 → 4. 인형 한 칸 = `[캐릭터, x, y|null, z, qx, qy, qz, qw, 색, 체형, 표정, 희귀, 번호]` (13칸). y가 `null`이면 "x, z 위 천장에서 떨어뜨린, 아직 안 앉은 인형"이고 qx~qw는 0,0,0,1.
- 물리는 고정 간격 1/120초, 프레임당 최대 4번. 내 판 동안과 채우기 앉히기(기계당 한 번, 1초 안)에만 돈다.
- 구멍: 34cm × 34cm 네모, 턱 6cm. 아무도 하지 않을 때는 물리 뚜껑으로 덮인다. 내 판 중 구멍에 빠진 인형은 모두 내 것(최대 3).
- 그리기 호출 예산: 휴대폰 기계 앞 153 그대로(`client/e2e/perf.mjs`). 기계 속 인형은 가벼운 모양(lite) 그대로.
- 화면 문구에 일본어 금지, 가운데 점(·)으로 문장을 잇지 않는다. 헥사고날 1:1 슬라이스, import-linter 2 계약 유지.
- 배포는 사용자 허락을 받고 한다. D1 변경은 없다(DO 저장소 키만 v3 → v4).

## Review Focus

1. **판 도중 탭을 닫아 `done`이 안 온다** — 잠금 시간이 지나면 기계는 판 시작 전 상태 그대로이고 다음 사람이 할 수 있어야 한다. (Task 4 `test_no_report_leaves_the_machine_as_it_was`)
2. **잠근 사람이 아닌 화면이 `pose`나 `done`을 보낸다** — 무시해야 한다. (Task 5 `test_pose_from_someone_else_is_dropped`, Task 4 `test_done_from_someone_else_is_refused`)
3. **채우기로 떨어진 인형이 구멍 쪽으로 구른다** — 뚜껑이 덮여 있어 상자 안에 남아야 한다. (Task 6 `a refill doll rolling onto the hole stays in the box`)
4. **느린 휴대폰에서 한 프레임이 0.5초 걸린다** — 물리가 한 번에 4번까지만 돌아 터지지 않고, 다음 프레임에 이어 간다. (Task 6 `a long frame steps at most four times`)
5. **정직한 보고가 자리 몇 mm 때문에 거절된다** — 상자 밖 자리는 잘라서 받고, 4개 당첨만 거절한다. (Task 4 `test_positions_outside_the_box_are_clamped_not_refused`, `test_four_wins_are_refused`)

---

## 파일 구조

```
shared/claw.json                         기본 힘·거리 배율·쥠의 질·희귀 배율·구멍 치수·최대 당첨 수
scripts/gen_shared.py                    (수정) claw.json → domain/shared_data.py, client/src/data/claw.ts
client/src/data/claw.ts                  (생성) CLAW 상수 + clawStrength(x, z)
client/src/physics/rapier.ts             (생성) loadRapier() 지연 로딩, rapierReady()
client/src/physics/machineWorld.ts       (생성) MachineWorld: 상자·구멍·뚜껑·인형 몸, step, settle, poses, fallen
client/src/physics/dollBody.ts           (생성) dollColliders(spot) — dollHits → 콜라이더, 무게
client/src/physics/clawBody.ts           (생성) ClawBody: kinematic 허브·손가락, 쥠 관절(최대 힘·끊김)
client/src/physics/clawCycle.ts          (생성) runCycle(world, claw, x, z, hooks) — 한 바퀴(내려감→쥠→올림→구멍→놓음→멈춤 대기)
client/src/physics/relay.ts              (생성) 움직이는 인형만 골라 pose 메시지 만들기 / 받은 pose 보간
client/sim/world.ts                      (생성) 시뮬레이션용 기계 상태 만들기(채우기 흉내), 겹침 세기
client/sim/odds.test.ts                  (생성) 확률 맞추기 (느림 — 따로 돌림)
client/sim/scenes.test.ts                (생성) 탑 쌓고 끌어오기·뒤집어 넣기·떨어뜨려 걸치기
client/src/net/protocol.ts               (수정) v4, DollSpot 13칸, Done/DoneNo/Pose
client/src/world/dollPose.ts             (수정) 자리·쿼터니언에서 자세, 안 앉은 인형의 임시 자세
client/src/world/machine.ts              (수정) 구멍 34cm 네모·턱 6cm, HOLE 상수
client/src/world/bigZone.ts              (수정) 새 자세, live 모드(기계 하나의 인형을 따로 그리기), 앉히기 걸기
client/src/world/clawShow.ts             (수정) 물리 결과를 그리는 쪽으로: 내 판(runCycle 훅) · 남의 판(중계)
client/src/game/playSession.ts           (수정) 내리기 뒤 단계(cycle) 포함
client/src/game/machineBusy.ts           (수정) 잠금 시간 = play + cycle
client/src/main.ts                       (수정) 판 흐름·done·pose·채우기 앉히기·Rapier 준비 중
client/e2e/perf.mjs, client/e2e/determinism.mjs  (수정/생성)

server/src/toycrane/domain/crane.py      (수정) DollSpot 13칸, spawn_spot, 상자 치수; judge·sway·drop_nearby·settle·rest_height·place_new 삭제
server/src/toycrane/domain/report.py     (생성) check_report(stock, report) → 새 MachineStock | 거절 이유
server/src/toycrane/domain/stock.py      (수정) 안 앉은 인형으로 채우기
server/src/toycrane/domain/play_rules.py (수정) CYCLE_SECONDS, expired
server/src/toycrane/app/{dtos,ports/input,use_cases}/done_*  (생성) done 슬라이스 (drop 슬라이스 대체)
server/src/toycrane/app/{dtos,ports/input,use_cases}/pose_*  (생성) pose 중계 슬라이스
server/src/toycrane/adapter/inbound/ws/{handlers,schemas}/{done,pose}_* (생성), drop_* 삭제
server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py (수정) machine 13칸, result(won), done_no, pose
server/src/toycrane/adapter/outbound/do_storage_machine_contents.py (수정) machines_v4 + v3 이주
server/src/toycrane/dependencies/{done,pose}_provider.py (생성)
```

---

### Task 1: 집게 성격표 `shared/claw.json`과 양쪽 `clawStrength`

**Files:**
- Create: `shared/claw.json`
- Modify: `scripts/gen_shared.py`, `server/src/toycrane/domain/shared_data.py`(생성 결과), `server/src/toycrane/domain/crane.py:claw_strength`
- Create: `client/src/data/claw.ts`
- Test: `server/tests/domain/test_crane.py`, `client/src/data/claw.test.ts`

**Interfaces:**
- Produces: `shared/claw.json` = `{"base_force": 6.0, "spread": 0.25, "quality": {"three": 1.0, "two": 0.6}, "rare": {"rare": 0.5, "gold": 0.3}, "hole": {"size": 0.34, "lip": 0.06}, "max_wins": 3, "cycle_seconds": 12, "settle_seconds": 3}` (`base_force`는 Task 8이 맞춘 값으로 바뀐다, 단위 N).
- Produces (client): `export const CLAW: {...위와 같은 형태}`; `export function clawStrength(x: number, z: number): number` (구멍 가장자리 0.75, 가장 먼 모서리 1.25; `MACHINE_SPEC.hole`·`play_half` 기준).
- Produces (server): `shared_data.CLAW` dict; `crane.claw_strength`는 `CLAW["spread"]`를 읽는다(지금 상수 `STRENGTH_SPREAD` 삭제).

- [ ] **Step 1: 실패 테스트 — 화면 쪽**

```ts
// client/src/data/claw.test.ts
import { expect, test } from 'vitest';
import { CLAW, clawStrength } from './claw';
import { MACHINE_SPEC } from './storeLayout';

test('claw strength grows from the hole edge to the far corner', () => {
  const [hx, hz, hr] = MACHINE_SPEC.hole, [w, d] = MACHINE_SPEC.play_half;
  expect(clawStrength(hx + hr, hz)).toBeCloseTo(0.75);
  expect(clawStrength(w, -d)).toBeCloseTo(1.25);
  expect(clawStrength(0, 0)).toBeGreaterThan(0.75);
});
test('claw table carries the spec numbers', () => {
  expect(CLAW.quality).toEqual({ three: 1, two: 0.6 });
  expect(CLAW.rare).toEqual({ rare: 0.5, gold: 0.3 });
  expect(CLAW.hole).toEqual({ size: 0.34, lip: 0.06 });
  expect(CLAW.max_wins).toBe(3);
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run src/data/claw.test.ts` — Expected: FAIL "Cannot find module './claw'"
- [ ] **Step 3: `shared/claw.json`을 Interfaces대로 만들고 `scripts/gen_shared.py`에 claw.json → `CLAW`(파이썬 dict) · `client/src/data/claw.ts`(`CLAW` 상수 + `clawStrength`) 생성을 더한다.** `storeLayout.ts`가 만들어지는 방식을 그대로 따른다.
- [ ] **Step 4: 서버 `claw_strength`가 `CLAW["spread"]`를 쓰게 바꾸고 `test_crane.py::test_claw_strength_grows_with_distance_from_the_hole`이 그대로 통과하는지 본다.** Run: `cd server && uv run pytest -q tests/domain/test_crane.py` — Expected: pass
- [ ] **Step 5: 통과 확인** — Run: `cd client && npx vitest run src/data/claw.test.ts && npx tsc --noEmit -p .` — Expected: PASS
- [ ] **Step 6: Commit** — `git add shared/claw.json scripts/gen_shared.py server/src/toycrane/domain client/src/data && git commit -m "feat: 집게 성격표 shared/claw.json — 기본 힘·거리 배율·쥠의 질·희귀 배율·구멍 치수"`

---

### Task 2: 규약 v4 — 인형 13칸, `done`·`done_no`·`pose`

**Files:**
- Modify: `shared/protocol_fixtures.json`, `client/src/net/protocol.ts`, `client/src/net/protocol.test.ts`, `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`, `server/tests/adapter/test_server_messages.py`(있으면; 없으면 `server/tests/adapter/test_protocol_fixtures.py`를 찾아 같은 방식)

**Interfaces:**
- Produces (fixtures): `server_machine` dolls = `[["bear", 0.2, 0.0, 0.1, 0, 0, 0, 1, 3, "s", 4, "", 7], ["bear", -0.1, null, 0.3, 0, 0, 0, 1, 1, "n", 0, "", 8]]`; `server_result` = `{"t":"result","m":"A-3","id":"p1","won":[["bunny",2,"",0]]}`(won 항목 = [캐릭터, 색, 희귀, 기계 속 번호 uid]); `client_done` = `{"t":"done","m":"A-3","won":[7],"dolls":[[7,0.2,0.0,0.1,0,0,0,1]]}`(dolls 항목 = [uid, x, y, z, qx, qy, qz, qw]); `server_done_no` = `{"t":"done_no","m":"A-3","why":"count"}`; `client_pose` = `{"t":"pose","m":"A-3","c":[0.1,1.6,0.2,0.4],"d":[[7,0.2,0.3,0.1,0,0,0,1]]}`(c = 집게 x, y, z, 벌림 0~1; d = 움직이는 인형들); `server_pose` = client_pose에 `"id":"p1"`을 더한 것. `server_welcome.v` = 4. `server_play_ok.limit` 그대로.
- Produces (client types): `DollSpot = [kind, x, y: number | null, z, qx, qy, qz, qw, color, body, face, rare, uid]`; `lookOf(s)` = `{color: s[8], body: s[9], face: s[10], rare: s[11]}`; `uidOf(s) = s[12]`; `type Result = {t:'result'; m; id; won: [string, number, string, number][]}`; `type DoneNo`, `type Pose = {t:'pose'; m; id; c: [number,number,number,number]; d: [number,...7][]}`; `encodeDone(m, won: number[], dolls: DollPose[])`, `encodePose(m, c, d)`; `DollPose = {uid: number; p: [number,number,number]; q: [number,number,number,number]}`. `encodeDrop` 삭제. `PROTOCOL = 4`.
- Produces (server): `server_messages.machine(machine_id, spots)` 13칸, `result(machine_id, player_id, won: list[tuple[str,int,str,int]])`, `done_no(machine_id, why)`, `pose(player_id, machine_id, c, d)`; `_spots`가 y None을 `null`로.

- [ ] **Step 1: 견본을 Interfaces대로 바꾸고 양쪽 실패 테스트** — 화면: `decodes every server fixture`에 `server_done_no`·`server_pose`를 더하고 `old 10-field dolls are no longer understood`(10칸 거부, 13칸 수용, y null 허용), `encodeDone/encodePose match client fixtures`, `PROTOCOL is 4`. 서버: 기존 견본 테스트가 새 `machine`·`result`·`done_no`·`pose` 함수를 견본과 비교.
- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run src/net && cd ../server && uv run pytest -q tests/adapter` — Expected: 둘 다 FAIL(모양 불일치)
- [ ] **Step 3: 화면 `protocol.ts`와 서버 `server_messages.py`를 Interfaces대로 고친다.** 서버 `DollSpot` 자체는 Task 3에서 바뀌므로 여기서는 `_spots`가 Task 3의 필드 이름(`x, y, z, q`)을 쓰도록 쓰고, Task 3 전까지는 서버 테스트 중 `test_server_messages` 쪽만 통과시킨다(규약 견본 테스트는 Task 3 끝에 초록).
- [ ] **Step 4: 통과 확인** — Run: `cd client && npx vitest run src/net && npx tsc --noEmit -p .` — Expected: PASS (`main.ts`가 `encodeDrop`·`Result.x`를 써서 tsc가 깨지면 그 줄들만 `// TODO Task 11`로 임시 주석 — Task 11이 되살린다)
- [ ] **Step 5: Commit** — `git commit -m "feat: 규약 v4 — 인형 자리·돌림 13칸, done·done_no·pose 메시지"`

---

### Task 3: 서버 도메인 — 자리·돌림 인형, 안 앉은 채우기, 저장소 v4

**Files:**
- Modify: `server/src/toycrane/domain/crane.py`, `server/src/toycrane/domain/stock.py`, `server/src/toycrane/adapter/outbound/do_storage_machine_contents.py`, `server/tests/domain/test_crane.py`, `server/tests/domain/test_stock.py`, `server/tests/adapter/test_do_storage_machine_contents.py`(있으면), `server/tests/fakes.py`

**Interfaces:**
- Produces: `DollSpot(kind, x, y: float | None, z, q: tuple[float,float,float,float] = (0,0,0,1), color, body, face, rare, uid)` — frozen dataclass, `settled` property (`y is not None`).
- `spawn_spot(spots: list[DollSpot], rng) -> tuple[float, float]`: 구멍 네모(중심 `MACHINE_SPEC.hole[0:2]`, 반폭 `CLAW["hole"]["size"]/2 + 0.05`) 밖, 다른 인형과 0.22m 넘게, 400번 안에 못 찾으면 0.16m.
- `generate_stock(kind, rng)`: 9개 모두 `y=None`. `refill(...)`: 새 인형 `y=None`. `on_taken(stock, uids: list[int], now)`: 번호 목록으로 뺀다.
- `crane.py`에서 삭제: `ODDS, TIER_WIN, BODY_REACH, BODY_SLIP, PART_RADII, SWAY_MAX, FLOOR_DOLLS, MIN_GAP, VALLEY_MAX, DOLL_H, DOLL_W, SINK, Grab, judge, sway, clamp_claw, drop_nearby, settle, rest_height, take_out, place_new, _supports, _in_area`. 남는 것: `DollSpot, spawn_spot, claw_strength, BODY_W`.
- 저장소: 키 `machines_v4`; `load()`가 `machines_v4`가 없고 `machines_v3`가 있으면 v3의 (kind, x, z, r, y, …)를 `DollSpot(kind, x, None, z, (0,0,0,1), …)`로 읽는다(모두 안 앉은 인형 — 스펙 §6의 "첫 화면이 내려앉힌다"를 이렇게 푼다). `save()`는 13칸(`[kind, x, y, z, qx, qy, qz, qw, color, body, face, rare, uid]`).

- [ ] **Step 1: 실패 테스트** — `test_crane.py`: 옛 판정 테스트(`test_head_odds`, `test_rare_and_gold_win_less`, 체형, `aim_rate` 계열, `sway`, `clamp`, `drop_nearby`, `settle`, `take_out`)를 지우고 `test_spawn_spot_avoids_the_hole_and_other_dolls`(400번 뽑아 모두 구멍 네모 밖·22cm 넘게)·`test_claw_strength_grows_with_distance_from_the_hole` 유지. `test_stock.py`: `test_new_stock_is_nine_unsettled_dolls`(y None, uid 1..9), `test_refill_adds_unsettled_dolls`, `test_on_taken_removes_by_uid`. 저장소 테스트: `test_v3_contents_are_read_as_unsettled_v4`(FakeStorage에 `machines_v3` JSON을 넣고 load → y None, 같은 uid·색), `test_save_writes_thirteen_fields`.
- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest -q tests/domain tests/adapter` — Expected: FAIL (속성 없음)
- [ ] **Step 3: Interfaces대로 구현한다.** `test_drop_interactor.py`는 Task 4에서 `test_done_interactor.py`로 바뀌므로 이 Task에서는 삭제하고, `drop_interactor.py`·`drop_provider.py`·`drop_handler.py`·`drop_schema.py`·`drop_dto.py`·`drop_use_case.py`와 `ws_router.HANDLERS["drop"]`도 지운다(서버가 임시로 내리기 메시지를 무시하는 상태 — Task 4가 `done`으로 채움). `fakes.py`의 `stocks_with_empty`·`player` 등 DollSpot을 만드는 곳을 새 생성자로.
- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports` — Expected: 전체 PASS, 계약 2 kept
- [ ] **Step 5: Commit** — `git commit -m "feat: 서버 인형은 자리·돌림으로, 새 인형은 안 앉은 채로 — 판정·흔들림·자리 계산 삭제, 저장소 v4"`

---

### Task 4: `done` 슬라이스 — 보고 확인·저장·중계 (drop 대체)

**Files:**
- Create: `server/src/toycrane/domain/report.py`, `server/src/toycrane/app/dtos/done_dto.py`, `server/src/toycrane/app/ports/input/done_use_case.py`, `server/src/toycrane/app/use_cases/done_interactor.py`, `server/src/toycrane/adapter/inbound/ws/schemas/done_schema.py`, `server/src/toycrane/adapter/inbound/ws/handlers/done_handler.py`, `server/src/toycrane/dependencies/done_provider.py`
- Modify: `server/src/toycrane/domain/play_rules.py`, `server/src/toycrane/app/ports/output/connections_port.py`(`broadcast_result(machine_id, player_id, won)`, `send_done_no(conn_id, machine_id, why)`), `ws_connections_adapter.py`, `ws_router.py`, `server/tests/fakes.py`(FakeConnections)
- Test: `server/tests/domain/test_report.py`, `server/tests/app/use_cases/test_done_interactor.py`, `server/tests/adapter/test_done_schema.py`

**Interfaces:**
- `report.py`: `@dataclass(frozen=True) class Report: won: tuple[int, ...]; dolls: tuple[DollPose, ...]` with `DollPose(uid, x, y, z, q)`. `check_report(stock: MachineStock, report: Report, now: float) -> MachineStock | str`: 거절 이유 문자열 `"count"`(dolls 번호 집합 ≠ stock 번호 집합 − won), `"wins"`(len(won) > `CLAW["max_wins"]`), `"unknown"`(won이나 dolls에 기계에 없는 번호). 통과하면 자리를 상자 안으로 자른다: x ∈ [−play_half.x−0.1, +], z ∈ [−play_half.z−0.1, +], y ∈ [0, 1.2]; 쿼터니언은 길이 1로 정규화. 결과는 `on_taken(stock, won, now)`에 자리를 입힌 `MachineStock`.
- `play_rules.py`: `CYCLE_SECONDS = CLAW["cycle_seconds"] + CLAW["settle_seconds"]`(15); `expired(started, now)` = `now > started + PLAY_SECONDS + CYCLE_SECONDS + DROP_SLACK`.
- `DoneCommand(conn_id, machine_id, report: Report, now)`. `DoneInteractor.done(cmd)`: 잠금이 `(machine_id, started)`이고 판 사이가 아니며 `expired` 아님 → `check_report`; 거절이면 `send_done_no` + 잠금은 `hold`로(판 사이) + 기계는 그대로(판 시작 전); 통과면 `hold`, 저장, `broadcast_stock`(채우기 시각), 당첨마다 `bag.add`(마지막 `send_bag` 한 번), `broadcast_result(machine_id, player_id, won_views)`, `broadcast_machine`. `won_views` = `[(kind, color, rare, uid)]`.
- `done_schema.parse(data) -> Report | None`: `won` 정수 목록(0~3개), `dolls` 8칸 숫자 목록(유한, 소수 3자리로 반올림), 아니면 None.

- [ ] **Step 1: 실패 테스트**

```python
# test_report.py
def test_positions_outside_the_box_are_clamped_not_refused(): ...  # x=0.9 → play_half.x+0.1, 쿼터니언 (0,0,0,2) → (0,0,0,1)
def test_four_wins_are_refused(): assert check_report(stock, Report((1,2,3,4), ...), 0.0) == "wins"
def test_missing_or_extra_dolls_are_refused(): ... == "count"
def test_unknown_uid_is_refused(): ... == "unknown"
def test_won_dolls_leave_and_the_rest_keep_reported_poses(): ...
# test_done_interactor.py
async def test_done_saves_poses_bags_every_win_and_tells_everyone(): ...  # won=[7, 8] → bag.added 2개, result won 2개, machine 7개
async def test_done_from_someone_else_is_refused(): ...  # 잠금 없는 conn → 아무 메시지 없음, 저장 없음
async def test_refused_report_keeps_the_machine_and_sends_done_no(): ...  # count → done_no, contents.saves == 0, 판 사이 자리
async def test_no_report_leaves_the_machine_as_it_was(): ...  # 잠금만 있고 done 없이 expired → play_start가 풀고 free, contents 그대로 (play_start 테스트에 둬도 됨)
async def test_done_after_the_lock_expired_is_ignored(): ...
```

- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest -q tests/domain/test_report.py tests/app/use_cases/test_done_interactor.py` — Expected: FAIL (모듈 없음)
- [ ] **Step 3: Interfaces대로 구현.** 핸들러는 `drop_handler`가 하던 틀(ctx, env, ws, data → provider → interactor)을 따른다. `ws_router.HANDLERS["done"]`.
- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports` — Expected: 전체 PASS(규약 견본 테스트 포함), 계약 2 kept
- [ ] **Step 5: Commit** — `git commit -m "feat: done 슬라이스 — 판 보고를 상식만 확인해 저장·중계, 당첨은 모두 가방에"`

---

### Task 5: `pose` 중계 슬라이스

**Files:**
- Create: `pose_dto.py`, `pose_use_case.py`, `pose_interactor.py`, `pose_schema.py`, `pose_handler.py`, `pose_provider.py` (Task 4와 같은 자리들)
- Modify: `connections_port.py`(`broadcast_pose(except_conn, player_id, machine_id, c, d)`), `ws_connections_adapter.py`, `ws_router.py`, `fakes.py`
- Test: `server/tests/app/use_cases/test_pose_interactor.py`, `server/tests/adapter/test_pose_schema.py`

**Interfaces:**
- `PoseCommand(conn_id, machine_id, c: tuple[float,float,float,float], d: tuple[tuple[float,...], ...], now)`. `PoseInteractor.relay(cmd)`: 잠금이 그 기계이고 판 사이가 아닐 때만 `broadcast_pose(cmd.conn_id, me.player_id, ...)`. 저장 없음, 채우기도 건드리지 않음.
- `pose_schema.parse(data)`: `c` 4칸 유한 숫자, `d` 최대 9개 × 8칸, 소수 2자리 반올림; 아니면 None.

- [ ] **Step 1: 실패 테스트** — `test_pose_is_relayed_to_everyone_else`, `test_pose_from_someone_else_is_dropped`(잠금 없음·다른 기계·판 사이 → broadcasts 비어 있음), 스키마: 10개 인형은 None.
- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest -q tests/app/use_cases/test_pose_interactor.py` — Expected: FAIL
- [ ] **Step 3: 구현.** `ws_router`에서 `pose`는 채우기(`refill`) 호출 없이 바로 핸들러로(초당 10번 오는 메시지가 저장소 `due_at`을 읽지 않게 — 메모리 캐시라 읽기는 없지만 코드 경로를 분명히).
- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run pytest -q` — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: pose 중계 — 판을 하는 사람의 집게·인형 자리를 매장에 그대로 뿌린다"`

---

### Task 6: Rapier 로딩과 `MachineWorld` — 상자·구멍·뚜껑·인형 몸·앉히기

**Files:**
- Modify: `client/package.json`(`"@dimforge/rapier3d-compat": "^0.21.0"`)
- Create: `client/src/physics/rapier.ts`, `client/src/physics/dollBody.ts`, `client/src/physics/machineWorld.ts`
- Test: `client/src/physics/machineWorld.test.ts`

**Interfaces:**
- `rapier.ts`: `loadRapier(): Promise<typeof import('@dimforge/rapier3d-compat')>`(한 번만 `init()`, 이후 같은 약속), `rapierReady(): boolean`.
- `dollBody.ts`: `dollColliders(spot: DollSpot): { shapes: {kind: 'ball'; r: number; at: [number,number,number]}[]; mass: number }` — `dollHits(kind, body, rare).solid`(귀 제외)에 `DOLL_SCALE`을 곱한 공들, 무게 = 0.25kg × `BODY_W[body]`²(보통 0.25, 뚱뚱 ≈0.33, 마른 ≈0.19). 콜라이더 마찰 0.8, 반발 0.05, 몸 angular damping 2.0, linear damping 0.2. `dollHits`에 넣는 희귀 왕관 공은 뺀다(콜라이더는 겉모습 기준).
- `machineWorld.ts`: `class MachineWorld { constructor(R, spots: DollSpot[]); step(dt: number): void /* 1/120 고정, 최대 4번, 남은 시간은 다음으로 */; settle(maxSeconds = 3): number /* 모두 잠들거나 시간이 다할 때까지 step, 쓴 초 반환 */; poses(): DollPose[]; movingPoses(): DollPose[] /* 깨어 있는 몸만 */; setHoleOpen(open: boolean): void; fallen(): number[] /* 구멍 네모 안에서 y < DOLL_FLOOR − 0.15 */; remove(uid: number): void; bodyOf(uid): RigidBody; dispose(): void }`. 좌표는 기계 안 좌표(`dollPose`와 같음: 바닥 y = `DOLL_FLOOR`). 상자: 바닥(구멍 네모 뺀 4장), 벽 4장(`play_half` + 0.15), 천장 y 2.2, 구멍 턱 4장(높이 `CLAW.hole.lip`), 뚜껑(구멍 네모, `setHoleOpen(false)`일 때만 있음). 안 앉은 인형(`y === null`)은 (x, 1.9, z)에서 `uid` 순서로 0.25초 간격을 두고 떨어뜨린다(결정성: 같은 입력 → 같은 결과).

- [ ] **Step 1: 실패 테스트**

```ts
// machineWorld.test.ts (vitest, node에서 rapier3d-compat 동작)
test('unsettled dolls fall and come to rest inside the box', async () => { /* 9개 y null → settle(3) 뒤 모두 y ≥ DOLL_FLOOR−0.01, |x| ≤ play_half.x+0.15, 잠듦 */ });
test('a refill doll rolling onto the hole stays in the box', async () => { /* 구멍 바로 옆 (x=hole.x+0.05) 위에서 떨어뜨림, 뚜껑 닫힘 → fallen() 비어 있음, y ≥ DOLL_FLOOR−0.01 */ });
test('with the hole open a doll over it falls through and is reported', async () => { /* setHoleOpen(true), 구멍 가운데 위에서 떨어뜨림 → fallen() == [uid] */ });
test('a long frame steps at most four times', () => { /* step(0.5) 뒤 world 시간이 4/120초만 흐름 */ });
test('settling is deterministic', async () => { /* 같은 spots로 두 번 → poses 동일(toEqual) */ });
test('stacked dolls do not interpenetrate', async () => { /* settle 뒤 공들 쌍마다 거리 ≥ r1+r2−0.01 (sim/world.ts의 overlaps 사용 — Task 8 전엔 테스트 안에 간단히) */ });
```

- [ ] **Step 2: 실패 확인** — Run: `cd client && npm i && npx vitest run src/physics` — Expected: FAIL (모듈 없음)
- [ ] **Step 3: Interfaces대로 구현.**
- [ ] **Step 4: 통과 확인** — Run: `cd client && npx vitest run src/physics && npx tsc --noEmit -p .` — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: Rapier 기계 상자 — 인형 몸, 구멍 뚜껑, 고정 간격, 결정적 앉히기"`

---

### Task 7: 집게 몸과 쥠 관절, 한 바퀴 `runCycle`

**Files:**
- Create: `client/src/physics/clawBody.ts`, `client/src/physics/clawCycle.ts`
- Test: `client/src/physics/clawBody.test.ts`, `client/src/physics/clawCycle.test.ts`

**Interfaces:**
- `clawBody.ts`: `class ClawBody { constructor(R, world: MachineWorld); setPose(x, y, z, open: number): void /* kinematic 다음 자리 — 허브 공 r0.06 + 손가락 끝 공 3개 r0.02 (world/claw.ts FINGER 치수·OPEN_MIN/MAX 각도로 끝 위치 계산) */; touching(): Map<uid, number> /* 인형별 닿은 손가락 수 */; grip(uid, quality: 'three' | 'two'): void /* 허브↔인형 spring joint, 붙는 점 = 닿은 손가락 끝들의 가운데, maxForce = CLAW.base_force × clawStrength(x,z) × CLAW.quality[quality] × (희귀면 CLAW.rare[...]) */; held(): uid | null; update(): void /* 관절 힘이 maxForce를 넘으면 끊고 held=null */; release(): void }`.
- `clawCycle.ts`: `runCycle(world, claw, x, z, hooks: { frame(claw: {x,y,z,open}, moving: DollPose[]): void; phase(name: 'descend'|'close'|'lift'|'carry'|'release'|'settle'): void }, R): CycleResult` — 동기, 고정 간격으로 끝까지 돈다(시뮬레이션·테스트용) / `runCycleAsync(..., frameBudget)`는 Task 11이 같은 함수를 프레임마다 나눠 부르는 방식으로 쓴다(`CycleRunner` 클래스: `advance(dt): boolean(끝)`). 단계: 내려감(0.35m/s, `planGrip`이 준 높이 또는 손가락이 인형에 닿아 멈출 때까지) → 오므림(0.6초, 닿은 손가락 ≥2이면 grip) → 올림(0.25m/s, `CLAW_REST.y`까지) → 구멍 위로 옮김(0.35m/s, `clawPath`) → 놓음(관절 release, 손가락 벌림) → 멈춤 대기(`world.settle(CLAW.settle_seconds)`). `CycleResult = { won: number[]; poses: DollPose[]; held: uid | null /* 쥐었던 인형 */; slipped: boolean }`.

- [ ] **Step 1: 실패 테스트**

```ts
// clawBody.test.ts
test('three fingertips on one doll make a full grip, two make a weak one', ...);   // touching()·quality
test('a grip breaks when the load exceeds its max force', ...);                      // 무거운 몸(10kg) → update() 뒤 held null
// clawCycle.test.ts
test('a head grip on a normal doll with full strength lifts it into the hole', ...);  // base_force 넉넉히 → won == [uid]
test('a grip on the lower body hangs the doll tilted', ...);                          // lift 단계 frame에서 인형 쿼터니언 기울기 > 30°
test('a weak grip drops the doll on the way and it rests back inside the box', ...);  // base_force 작게 → won [], slipped true, poses 상자 안
test('an empty spot is a miss', ...);                                                 // held null, won []
test('the cycle is deterministic', ...);                                              // 두 번 돌려 poses·won 동일
```

- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run src/physics` — Expected: FAIL
- [ ] **Step 3: 구현.** 관절은 Rapier `SpringImpulseJoint`(또는 `FixedImpulseJoint` + 힘 측정) 중 테스트 둘을 통과시키는 쪽; `update()`는 `joint` 양 끝 몸의 상대 가속도로 걸린 힘을 재거나 `world.impulseJoints`의 impulse 읽기 — [빌더]. 손가락 끝 자리는 `world/claw.ts`의 `FINGER`·경첩 각에서 계산(한 곳에 두고 둘이 쓰게 `claw.ts`에서 `fingerTips(open): Vector3[]`를 export).
- [ ] **Step 4: 통과 확인** — Run: `cd client && npx vitest run src/physics && npx tsc --noEmit -p .` — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 집게 몸과 쥠 관절 — 최대 힘을 넘으면 끊어지고, 한 바퀴를 결정적으로 돈다"`

---

### Task 8: 확률 맞추기 시뮬레이션 — `base_force`

**Files:**
- Create: `client/sim/world.ts`, `client/sim/odds.test.ts`, `client/vitest.sim.config.ts`
- Modify: `shared/claw.json`(`base_force`), `client/package.json`(`"sim": "vitest run --config vitest.sim.config.ts"`)

**Interfaces:**
- `sim/world.ts`: `fillMachine(kind, rng: () => number): DollSpot[]` — 서버 `spawn_spot`과 같은 규칙으로 9개(안 앉은 채) → `MachineWorld.settle`로 앉힌 spots; `overlaps(world): number`(공 쌍 겹침 수); `aimRate(opts: {trials; aimOff; look?; strength?: 'near'|'far'}, seed): number` — 위가 막히지 않은 보통 인형 하나를 골라 머리 위(또는 aimOff만큼 옆)로 `runCycle`, 성공률. `seededRandom(seed)`(mulberry32).

- [ ] **Step 1: 실패 테스트 — `sim/odds.test.ts`(`SIM_TRIALS` 환경변수, 기본 300; 맞출 때 3000)**

```ts
test('head aim wins three or four in ten', () => expect(aimRate({ trials, aimOff: 0 }, 7)).toBeWithin(0.30, 0.40));
test('body aim wins about half as often', () => expect(aimRate({ trials, aimOff: 0.08 }, 7)).toBeWithin(0.13, 0.22));
test('rare and gold are harder', () => { rare 0.13~0.22; gold 0.08~0.15 });
test('far dolls win more than near ones', () => expect(far).toBeGreaterThan(near));
test('no interpenetration after settling', () => expect(overlaps(world)).toBe(0));
```

- [ ] **Step 2: 실패 확인** — Run: `cd client && SIM_TRIALS=300 npm run sim` — Expected: 적어도 머리 확률이 범위 밖(기본 힘 6.0은 임시값)
- [ ] **Step 3: `base_force`를 맞춘다.** 스크립트로 4~5개 값을 돌려 머리 34%에 가장 가까운 값을 `shared/claw.json`에 쓰고 `gen_shared.py`를 돌린다. 몸통·희귀·황금이 범위 밖이면 `CLAW.quality.two`·`CLAW.rare`를 조정(머리가 우선, 스펙 §9.4). 결과 표를 커밋 메시지에 남긴다.
- [ ] **Step 4: 통과 확인** — Run: `cd client && SIM_TRIALS=3000 npm run sim` — Expected: 5개 PASS (수 분 걸림)
- [ ] **Step 5: Commit** — `git commit -m "feat: 집게 기본 힘 맞춤 — 머리 N%·몸통 N%·희귀 N%·황금 N%, 가까운 쪽 N% < 먼 쪽 N%"`

---

### Task 9: 장면 재현 — 탑 쌓고 끌어오기, 뒤집어 넣기, 떨어뜨려 걸치기

**Files:**
- Create: `client/sim/scenes.test.ts`

- [ ] **Step 1: 실패 테스트(각 장면은 손으로 짠 `DollSpot[]`에서 시작)**

```ts
test('a doll resting on a tower beside the hole goes in with a small lift', ...);   // 구멍 옆 두 개 쌓고 그 위에 하나 걸침 → 머리 겨냥 cycle → won
test('grabbing the lower body of a doll standing beside the hole tips it in', ...);  // 다리 쪽(중심 −10cm 아래 쪽 옆)을 겨냥 → won
test('a far doll dropped mid-carry lands on the tower and stays', ...);             // 약한 힘으로 멀리 것 → slipped, 멈춘 자리가 탑 근처(구멍에서 0.4m 안) & 높이 > 바닥
test('towers survive a play that does not touch them', ...);                         // 다른 쪽을 겨냥 → 탑 인형들 자리 변화 < 1cm
```

- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run --config vitest.sim.config.ts sim/scenes.test.ts` — Expected: 적어도 하나 FAIL (장면이 안 됨) 또는 모두 PASS면 그대로 Step 5로 가고 ledger에 "scenes passed first run"을 적는다
- [ ] **Step 3: 안 되는 장면이 있으면 원인을 좁혀 고친다** — 보통 턱 높이(`CLAW.hole.lip`), 붙는 점 계산, 관절 끊김 기준. `base_force`는 바꾸지 않는다(바꾸면 Task 8 다시).
- [ ] **Step 4: 통과 확인** — Run: `cd client && npm run sim` — Expected: odds + scenes 모두 PASS
- [ ] **Step 5: Commit** — `git commit -m "test: 고수의 두 장면이 물리로 된다 — 탑 위 걸침, 아랫부분 잡아 뒤집기, 떨어뜨려 걸치기"`

---

### Task 10: 화면 세계 — 자리·돌림 자세, 구멍 턱, live 모드, 앉히기

**Files:**
- Modify: `client/src/world/dollPose.ts`, `client/src/world/machine.ts`, `client/src/world/bigZone.ts`, `client/src/game/aim.ts`(구멍 반경 0.2는 `shared/store_layout.json`의 `hole` 셋째 값을 0.2로), `shared/store_layout.json`, `client/src/world/plush.ts`(`pushAway` 삭제), `client/src/world/clawShow.ts`(옛 `runClaw` 삭제 — Task 11이 새로 씀), `client/src/game/gripPlan.ts`(`planGrip`은 남김)
- Test: `client/src/world/dollPose.test.ts`, `client/src/world/bigZone.test.ts`, `client/src/world/machine.test.ts`

**Interfaces:**
- `dollPose(spot): {position, quaternion, provisional: boolean}` — 앉은 인형: position = (x, y, z), quaternion = q; 안 앉은 인형: `provisionalPose(spot, others)` = 바닥 위 서 있는 자세(y = DOLL_FLOOR, 세로축 돌림 uid×1.7rad), 다른 앉은 인형 머리 위 0.26m 안에 있으면 그 위에.
- `machine.ts`: `export const HOLE = { size: CLAW.hole.size, lip: CLAW.hole.lip }`; 구멍 평면 0.34, 아크릴 상자 `BoxGeometry(0.34, 0.06, 0.34)` y = DOLL_FLOOR + 0.03.
- `bigZone.ts` 추가: `live(machineId): LiveDolls` — 그 기계 인형들을 무더기에서 빼고 `makeDoll(kind, look, lite=true)` 개별 메시로 그린다; `LiveDolls = { set(uid, p, q): void; remove(uid): void; dispose(): void /* 무더기로 되돌림 */ }`. `unsettled(machineId): DollSpot[]`; `settleWith(machineId, poses: DollPose[]): void`(안 앉은 인형에 자리를 입혀 `setContents`); 떨어지는 연출(`falling`)은 이제 물리 `pose`로 대체 — `FALL_*` 삭제.
- 그리기 예산: live 모드는 내 판·구경하는 판 한 기계에만(인형 9개 × 메시 ≤ 2) → 휴대폰 기계 앞 호출 ≤ 153 + 18 안에서 `perf.mjs`가 잰다(Task 13).

- [ ] **Step 1: 실패 테스트** — `dollPose`: 앉은/안 앉은 자세, 임시 자세가 겹치지 않게 머리 위에; `bigZone`: `live()` 뒤 `pileOf`에 그 기계 번호가 없고 `dispose()` 뒤 돌아옴, `settleWith`가 `contentsOf`의 y를 채움; `machine`: 아크릴 높이 0.06, 구멍 평면 0.34.
- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run src/world` — Expected: FAIL
- [ ] **Step 3: 구현.** `clawShow.ts`·`plush.ts pushAway`·`softEars` 호출을 지우고 tsc가 깨지는 `main.ts` 줄은 Task 11을 위해 `// TODO Task 11` 주석으로.
- [ ] **Step 4: 통과 확인** — Run: `cd client && npx vitest run && npx tsc --noEmit -p .` — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 기계 속 인형을 자리·돌림으로 그리고, 구멍 턱을 6cm로, 한 기계를 따로 그리는 live 모드"`

---

### Task 11: 내 판 — 물리로 돌리고 `done` 보고

**Files:**
- Modify: `client/src/game/playSession.ts`, `client/src/game/machineBusy.ts`, `client/src/main.ts`, `client/src/world/clawShow.ts`(새로: `drawCycle` 훅 — 집게 rig·live 인형에 물리 자세 입히기), `client/src/ui/copy.ts`(`UI.physicsLoading = '준비 중'`, `UI.saveFailed = '결과를 저장하지 못했어요'`)
- Test: `client/src/game/playSession.test.ts`, `client/src/game/machineBusy.test.ts`, `client/src/world/copy.test.ts`

**Interfaces:**
- `PlaySession`: `requestDrop()` 뒤 상태 `'cycle'`; `update()`는 cycle 동안 레버를 무시. `machineBusy` 잠금 길이 = `play_seconds + CLAW.cycle_seconds + CLAW.settle_seconds`.
- `main.ts` 흐름: `welcome` 뒤 `requestIdleCallback(loadRapier)`(없으면 setTimeout 2초). 기계 앞 버튼: `rapierReady()`가 아니면 `setAction(UI.playOne, …, {dim: true, status: UI.physicsLoading})`. `play_ok` → `MachineWorld(R, contentsOf(m))`, `setHoleOpen(true)`, `ClawBody`, `bigZone.live(m)`, 집게 rig 활성. 내리기 → `CycleRunner.advance(dt)`를 프레임마다; 훅 `frame`은 rig 자세·live 인형 자세 입히고 Task 12의 중계를 부른다. 끝나면 `encodeDone(m, won, poses)` 전송, `awaiting = m`. `result`(내 것) → 당첨 카드·가방 연출은 지금 코드(`showResult`의 win 부분)로, `machine` → `live.dispose()` + `setContents`. `done_no` → toast `UI.saveFailed`, `live.dispose()`, 판 시작 전 contents로 되돌림(`machine`이 안 오므로 `before`를 들고 있다가 `setContents`). 결과를 8초 안에 못 받으면 지금처럼 `endPlay`.
- 채우기 앉히기: `frame`마다 `bigZone.unsettled(id)`가 있고 그 기계가 내 위치 8m 안이고 `rapierReady()`면 `MachineWorld(R, contents).settle(3)` → `settleWith(id, poses)`(기계당 한 번, 1초 안에 끝나는 동기 계산 — 느리면 `settle(1)`로).

- [ ] **Step 1: 실패 테스트** — `playSession`: 내린 뒤 `phase === 'cycle'`이고 레버 입력이 집게를 안 움직임; `machineBusy`: 잠금 길이; `copy.test`: 새 문구 규칙(일본어·가운데 점 없음).
- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run src/game src/world/copy.test.ts` — Expected: FAIL
- [ ] **Step 3: 구현.** `main.ts`의 `// TODO Task 11` 자리를 모두 되살린다.
- [ ] **Step 4: 통과 확인** — Run: `cd client && npx vitest run && npx tsc --noEmit -p . && npm run build` — Expected: PASS, 빌드 OK
- [ ] **Step 5: 로컬 e2e(헤드리스 크롬 9461, `uv run pywrangler dev`)** — `client/e2e/play.mjs`(생성): 봇이 코인 받기 → 기계 앞 → 한 판 → 레버 → 잡기 → `done`이 서버에 가고 `result`·`machine`이 돌아오는지, 13칸 인형에 y가 채워졌는지. Expected: 출력에 `done sent`, `machine dolls settled 9`
- [ ] **Step 6: Commit** — `git commit -m "feat: 내 판을 브라우저 물리로 — 집게 한 바퀴, done 보고, 채우기 앉히기, 물리 준비 중 표시"`

---

### Task 12: 구경꾼 — `pose` 중계 보내기·받기·보간

**Files:**
- Create: `client/src/physics/relay.ts`
- Modify: `client/src/main.ts`, `client/src/world/clawShow.ts`(`watchCycle`)
- Test: `client/src/physics/relay.test.ts`

**Interfaces:**
- `relay.ts`: `class PoseSender { constructor(send: (msg: string) => void, hz = 10); frame(m, claw: {x,y,z,open}, moving: DollPose[], now: number): void /* 1/hz마다 encodePose, 소수 2자리 */ }`; `class PoseReceiver { push(msg: Pose, now): void; sample(now): { claw; dolls: Map<uid, {p, q}> } /* 받은 두 자리 사이를 시간에 맞춰 보간(shown 방식, 100ms 지연) */ }`.
- `main.ts`: `play`(남의 판 시작) → `bigZone.live(m)` + `PoseReceiver`; `pose` → receiver.push; 매 프레임 `sample`로 rig·live 인형 자세; `machine` → `live.dispose()` + `setContents`; `result`(남의 것) → 지금 당첨 연출(캐릭터가 번쩍 등). 내 판이면 `PoseSender.frame`을 `CycleRunner` 훅에서 부른다.

- [ ] **Step 1: 실패 테스트** — `sender sends at most ten times a second and only moving dolls`, `receiver interpolates between two poses`.
- [ ] **Step 2: 실패 확인** — Run: `cd client && npx vitest run src/physics/relay.test.ts` — Expected: FAIL
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — Run: `cd client && npx vitest run && npx tsc --noEmit -p .` — Expected: PASS
- [ ] **Step 5: 로컬 e2e** — `client/e2e/watch.mjs`(생성): 봇 A가 판을 하고 화면 B가 구경 → B가 `pose`를 ≥ 20개 받고, 끝에 B의 인형 자리와 서버 `machine`이 1cm 안에서 같다. Expected: `watch ok`
- [ ] **Step 6: Commit** — `git commit -m "feat: 구경꾼 중계 — 집게와 움직이는 인형 자리를 초당 10번, 받는 쪽은 보간"`

---

### Task 13: 성능·결정성·휴대폰 확인, README

**Files:**
- Modify: `client/e2e/perf.mjs`(판 중 측정 추가), `README.md`
- Create: `client/e2e/determinism.mjs`

- [ ] **Step 1: 그리기 호출** — Run: `node client/e2e/perf.mjs 9461 http://localhost:8787 client/e2e/perf-physics.json` — Expected: 휴대폰 기계 앞 ≤ 160(153 + live 모드), 걷기 ≤ 370, PC는 기준의 ±5%
- [ ] **Step 2: 물리 시간** — `perf.mjs`에 판 중 `MachineWorld.step` 평균 ms(`window.__toycrane.physicsMs`)를 더해 잰다. Expected: 휴대폰 흉내(CPU 4배 느리게, `Emulation.setCPUThrottlingRate`) ≤ 1ms/프레임, 60fps
- [ ] **Step 3: 결정성** — `determinism.mjs`: 같은 `machine` 상태(안 앉은 인형 9개)를 두 탭이 각각 앉히고 `contentsOf`를 비교. Expected: 모든 인형 자리·돌림 동일. 다르면 ledger에 기록하고 스펙 §4.6의 되돌림(첫 화면이 보고)을 Task 14 전에 적용한다.
- [ ] **Step 4: 모바일 e2e** — Run: `node client/e2e/mobile-entry.mjs 9461 http://localhost:8787 && node client/e2e/mobile-joystick.mjs 9461 http://localhost:8787` — Expected: PASS PASS
- [ ] **Step 5: README 확인 기록에 6단계 줄 추가, Commit** — `git commit -m "test: 물리 뽑기 성능·결정성·휴대폰 확인"`

---

### Task 14: 배포 (사용자 허락 뒤)

- [ ] **Step 1: 사용자에게 배포 허락을 받는다.** D1 변경 없음. DO 저장소는 `machines_v3`를 읽어 v4로 이주(모두 안 앉은 인형 → 첫 화면이 앉힘). 규약 4라 열린 화면은 새로 고침된다.
- [ ] **Step 2: 배포** — Run: `cd server && CI=1 uv run pywrangler deploy` — Expected: `Deployed toycrane`
- [ ] **Step 3: 라이브 확인** — `node client/e2e/play.mjs 9461 https://toycrane.toycrane.workers.dev`, `watch.mjs` 같은 주소. Expected: 둘 다 ok. 사용자에게 스크린샷과 함께 §1의 두 장면을 직접 해 보도록 안내.
- [ ] **Step 4: README 라이브 확인 줄, Commit.**

---

## 자기 검토 메모

- 스펙 커버: §3.1~3.6(결정) → T1·T7·T8·T9·T11; §4.1 → T6·T11; §4.2 → T6; §4.3 → T7; §4.4 → T11; §4.5 → T2·T4·T5; §4.6 → T6·T11·T13; §4.7 → T13; §5 → T8; §6 → T3; §9.1 → T4·T6; §9.2 → T11; §9.3 → T10; §9.4 → T8; §9.5 → T7; §9.6 → T6(dollHits 그대로); §9.7 → T4·T11; §8 확인 → T8·T9·T12·T13.
- 비목표(점원·응원·몰아 넣기, 인형 겉모습)는 어느 Task에도 없다.
- 이름 일치: `DollPose = {uid, p, q}`(T2)를 T6·T7·T10·T11·T12가 쓴다. `CLAW`(T1)를 T6~T11이 쓴다. `MachineWorld`(T6) → T7·T8·T11. `CycleRunner`(T7) → T11·T12. `LiveDolls`(T10) → T11·T12.
