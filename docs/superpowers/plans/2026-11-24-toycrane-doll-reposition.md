# 인형 기계 재배치 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 인형 기계에서 집게가 못 닿는 유리 쪽 인형을 직원이 닿는 자리로 옮긴다. 판 끝 자동(가)과 "직원 부르기" 버튼(나) 두 길로 하고, 새 인형은 처음부터 닿는 범위에만 떨어뜨린다.

**구조:** 서버 도메인에 '닿는 범위' 판정과 옮기기를 두고(`domain/crane.py`, `domain/reposition.py`), 판 보고(`DoneInteractor`)와 새 `staff` 슬라이스가 그것을 쓴다. 화면은 판 사이 버튼과 알림만 더한다. 기준값은 `shared/claw.json`에 두어 서버와 화면이 같이 쓴다.

**기술:** Python Workers(서버, pytest, `uv run`), TypeScript + three.js + Rapier(화면, vitest), 공용 JSON → `scripts/gen_shared.py`.

**설계:** `docs/superpowers/specs/2026-11-24-toycrane-doll-reposition-design.md`

## 지켜야 할 것 (모든 작업)

- 화면 글에 가운데 점(·) 금지. 버튼엔 행동만, 상태는 버튼 위 작은 글.
- 진행 안내와 커밋 메시지는 한국어.
- 실패하는 시험을 '기존 문제'로 넘기지 않는다. 마지막에 서버 시험, 화면 시험, 타입 검사, 시뮬 전부.
- 미는 뽑기, 피규어, 고리 걸기 동작은 바꾸지 않는다.
- 브라우저로 시험했으면 탭을 닫는다(남으면 시험 캐릭터가 실제 매장에 서 있다).
- 배포는 하지 않는다. 사용자가 `!`로 한다.

## 리뷰 때 볼 것

1. 판 사이에 버튼을 눌렀는데 그사이 다른 사람이 자리를 가져갔다 → 서버는 무시하고, 화면은 `free`로 이미 판 사이를 끝냈어야 한다(작업 4 시험: 잡지 않은 사람의 staff는 무시).
2. 버튼을 연달아 두 번 눌렀다 → 둘째 응답이 n=0이어도 괜찮지만, 화면은 응답을 받기 전엔 다시 보내지 않는다(작업 6).
3. 옮긴 인형이 아직 안 앉았다(`y` None) → 다음 직원 호출과 자동 정리 모두 안 앉은 인형은 건드리지 않는다(작업 2 시험).
4. 기계가 꽉 차서 닿는 범위에 22cm 빈자리가 없다 → `spawn_spot`의 16cm, 0cm 물러서기로 결국 자리를 찾는다(작업 2 시험).
5. 미는 뽑기에서 `staff`를 보냈다 → 무시한다(작업 4 시험).

---

### Task 1: 기준값 재기와 공용 값

**파일:**
- 만들기: `client/sim/reach.test.ts`
- 고치기: `shared/claw.json`, `server/src/toycrane/domain/shared_data.py`(생성), `client/src/data/claw.ts`(타입), `client/src/game/playSession.ts:10`(`CLAW_EDGE`를 공용 값에서)

**인터페이스:**
- 만드는 것: `CLAW.reposition = { edge: 0.07, out: <잰 값>, plays: 3, move: 0.01 }` (서버 `CLAW["reposition"]`, 화면 `CLAW.reposition`)

- [ ] **1단계: 손으로 돌리는 시뮬 `client/sim/reach.test.ts` 작성.** `sim/world.ts`의 `aimRate`와 같은 틀로, 기계를 앉힌 뒤 인형 하나를 유리 쪽으로 옮겨 놓는다. 가운데가 '집게 가운데 범위(`play_half − 0.07`)'를 바깥으로 `o`만큼 벗어나게 하고, `o = 0, 0.02, 0.04, 0.06, 0.08`마다 그 인형의 머리를 겨냥한다. 겨냥은 실제 판처럼 `play_half − 0.07`로 자른다. 띠마다 잡히는 비율을 `SWEEP_OUT` 파일과 콘솔에 찍는다. `sweep.test.ts`처럼 `test.runIf(!!process.env.REACH)`로 평소엔 건너뛴다.
- [ ] **2단계: 돌리기.** `cd client && REACH=1 SIM_TRIALS=120 SWEEP_OUT=/tmp/claude-501/reach.txt npx vitest run --config vitest.sim.config.ts sim/reach.test.ts`. 띠별 비율을 기록한다.
- [ ] **3단계: `out` 정하기.** 잡히는 비율이 범위 안 인형 머리 겨냥(약 46~53%)의 절반 아래로 떨어지는 가장 작은 `o`로 한다. 어디서도 안 떨어지면 0.03으로 하고 그 사실을 보고한다.
- [ ] **4단계: `shared/claw.json`에 `"reposition": { "edge": 0.07, "out": <값>, "plays": 3, "move": 0.01 }` 추가.** `claw.ts`의 `ClawTable`에 같은 모양과 한 줄 주석을 더한다. `playSession.ts`의 `CLAW_EDGE`는 `CLAW.reposition.edge`에서 가져온다(값 그대로 0.07, export 이름 유지).
- [ ] **5단계: 생성.** `cd server && uv run python scripts/gen_shared.py && uv run pytest tests/domain/test_shared_data.py -q` → 통과. `cd client && npx tsc --noEmit` → 오류 없음.
- [ ] **6단계: 커밋** `인형 기계 재배치: 못 닿는 자리 기준값(시뮬로 잼)`

### Task 2: 서버 도메인 — 닿는 범위, 새 인형 자리, 옮기기

**파일:**
- 고치기: `server/src/toycrane/domain/crane.py`
- 만들기: `server/src/toycrane/domain/reposition.py`
- 시험: `server/tests/domain/test_crane.py`, 만들기 `server/tests/domain/test_reposition.py`

**인터페이스:**
- 사용하는 것: 작업 1의 `CLAW["reposition"]`
- 만드는 것:
  - `crane.REACH_HALF: tuple[float, float]` = `play_half − edge` (±0.39, ±0.33)
  - `crane.unreachable(d: DollSpot) -> bool`: 앉은 인형(`d.settled`)이고 `abs(d.x) > REACH_HALF[0] + out` 또는 `abs(d.z) > REACH_HALF[1] + out`
  - `crane.spawn_spot(spots, rng)`: 고르는 범위를 `REACH_HALF`로 좁힌다(나머지 규칙 그대로)
  - `reposition.move_unreachable(stock: MachineStock, rng) -> tuple[MachineStock, list[int]]`: 못 닿는 인형을 모두 `spawn_spot`(옮기는 인형 빼고 나머지 인형 기준) 자리로, `y=None`, `q=UPRIGHT`. 옮긴 번호는 `stuck`에서 지운다.
  - `reposition.tidy_unreachable(before: MachineStock, after: MachineStock, rng) -> tuple[MachineStock, list[int]]`: `pusher_crane.tidy_stuck`과 같은 틀이다. 판 전후 둘 다 못 닿는 자리이고 `move`(1cm) 미만으로 움직인 인형의 판 수를 `stuck`에 센다. `plays`(3)판째면 옮긴다.

- [ ] **1단계: 실패하는 시험 작성.**
  - `test_crane.py::test_spawn_spot_stays_where_the_claw_reaches`: 시드 여러 개로 200번 → 모두 `abs(x) <= REACH_HALF[0]` 그리고 `abs(z) <= REACH_HALF[1]`, 구멍 밖.
  - `test_crane.py::test_spawn_spot_still_finds_a_spot_in_a_full_machine`: 닿는 범위를 촘촘히 채운 30개 옆에서도 예외 없이 자리를 돌려준다.
  - `test_reposition.py::test_unreachable_is_only_settled_dolls_past_the_band`: `x = REACH_HALF[0] + out + 0.01, y=0.1` → True, `out − 0.01` → False, `y=None` → False, z쪽도 같게.
  - `test_reposition.py::test_move_unreachable_moves_every_stuck_doll_inside`: 못 닿는 2개와 닿는 3개 → 옮긴 번호 2개, 옮긴 인형은 `y is None`, 닿는 범위 안, 구멍 밖. 나머지 3개는 그대로.
  - `test_reposition.py::test_move_unreachable_with_nothing_to_move_keeps_the_stock`: 돌려준 stock이 입력과 같고 목록이 빈다.
  - `test_reposition.py::test_tidy_unreachable_moves_on_the_third_still_play`: 같은 자리 못 닿는 인형으로 세 번 → 1·2번째는 `stuck`이 1·2, 3번째에 옮겨지고 `stuck`에서 빠진다.
  - `test_reposition.py::test_tidy_unreachable_resets_when_the_doll_moves`: 2판 센 뒤 2cm 움직이면 `stuck`에서 빠진다.
- [ ] **2단계: 돌려 실패 확인.** `cd server && uv run pytest tests/domain/test_crane.py tests/domain/test_reposition.py -q` → import 오류 또는 범위 단언 실패.
- [ ] **3단계: 위 인터페이스대로 구현.**
- [ ] **4단계: 서버 시험 전체.** `cd server && uv run pytest -q` → 전부 통과. 기존 `spawn_spot` 범위를 가정한 시험이 깨지면 그 시험의 기대를 새 범위로 고친다(동작이 바뀐 것이므로).
- [ ] **5단계: 커밋** `인형 기계: 새 인형은 집게 닿는 곳에, 못 닿는 인형 옮기기 규칙`

### Task 3: 가 — 판 끝 자동 정리

**파일:**
- 고치기: `server/src/toycrane/app/use_cases/done_interactor.py`(인형 기계 분기)
- 시험: `server/tests/app/use_cases/test_done_interactor.py`

**인터페이스:**
- 사용하는 것: `reposition.tidy_unreachable`
- 만드는 것: 인형 기계 결과의 `tidied`가 옮긴 수(기존 `broadcast_result(..., tidied=...)`를 그대로 쓴다)

- [ ] **1단계: 실패하는 시험** `test_a_stuck_glass_doll_is_tidied_after_the_third_doll_play`. `test_a_stuck_ledge_doll_is_tidied_after_a_pusher_play`의 틀을 따른다. 인형 기계에서 못 닿는 자리 인형을 그대로 둔 보고를 3판 → 3판째 결과의 `tidied == 1`, 저장된 그 인형 `y is None`이고 닿는 범위 안, `machine` 방송에 그 자리.
- [ ] **2단계: 돌려 실패 확인.** `uv run pytest tests/app/use_cases/test_done_interactor.py -q`
- [ ] **3단계: 구현.** `count_miss` 다음 줄에 `after, tidied = tidy_unreachable(before, after, self._rng)`.
- [ ] **4단계: 통과 확인.** 같은 파일 전체 통과.
- [ ] **5단계: 커밋** `인형 기계: 못 닿는 자리에서 3판 안 움직인 인형은 판 끝에 직원이 옮김`

### Task 4: 나 — 직원 부르기 서버 슬라이스

**파일:**
- 만들기: `server/src/toycrane/app/dtos/staff_dto.py`, `app/ports/input/staff_use_case.py`, `app/use_cases/staff_interactor.py`, `dependencies/staff_provider.py`, `adapter/inbound/ws/staff_handler.py`
- 고치기: `adapter/inbound/ws/ws_router.py`(`"staff"` 등록), `app/ports/output/connections_port.py`(`send_staffed`), `adapter/outbound/ws_connections_adapter.py`, `adapter/inbound/ws/schemas/server_messages.py`(`staffed`, `PROTOCOL = 17`), `tests/fakes.py`(FakeConnections)
- 시험: 만들기 `tests/app/use_cases/test_staff_interactor.py`, 고치기 `tests/adapter/test_server_messages.py`, `tests/adapter/test_ws_router.py`

**인터페이스:**
- 사용하는 것: `reposition.move_unreachable`, `PlayLockPort.lock_of / is_between / hold`, `MachineContentsPort`(`ensure_contents`, `save`), `ConnectionsPort.broadcast_machine`
- 만드는 것:
  - 받는 메시지 `{"t": "staff", "m": "<인형 기계 id>"}`
  - `StaffCommand(conn_id: str, machine_id: str, now: float)`
  - `ConnectionsPort.send_staffed(conn_id: str, machine_id: str, n: int) -> None` → `{"t": "staffed", "m": id, "n": n}`
  - 규칙: `machine_id in MACHINES`(미는 뽑기 아님), `lock_of(conn)[0] == machine_id`, `is_between(conn)`일 때만. 아니면 아무것도 안 보낸다. 받으면 옮기고, n>0이면 저장 후 `broadcast_machine`. 어느 경우든 `locks.hold(conn, m, now)`로 자리 시간을 새로 잡고 `send_staffed(conn, m, n)`.

- [ ] **1단계: 실패하는 시험.**
  - `test_staff_moves_unreachable_dolls_for_the_seated_player`: 판 사이 자리를 잡은 사람, 못 닿는 2개 → 저장됨, `machine` 방송 1번, `staffed n=2`, hold 시각이 `now`.
  - `test_staff_with_nothing_to_move_says_zero`: `staffed n=0`, 저장과 `machine` 방송 없음.
  - `test_staff_from_someone_not_seated_is_ignored`: 잠금 없음, 다른 기계 잠금, 한 판 도중(between 아님) 세 경우 → 보낸 것 없음, 저장 없음.
  - `test_staff_on_a_pusher_is_ignored`: 미는 뽑기 id → 보낸 것 없음.
  - `test_server_messages.py`: `staffed("A-1", 2) == {"t": "staffed", "m": "A-1", "n": 2}`, `PROTOCOL == 17`.
  - `test_ws_router.py`: `"staff"`가 `HANDLERS`에 있다.
- [ ] **2단계: 돌려 실패 확인.** `uv run pytest tests/app/use_cases/test_staff_interactor.py tests/adapter -q`
- [ ] **3단계: 구현.** `stand` 슬라이스(`stand_handler.py`, `stand_provider.py`, `StandInteractor`)와 같은 모양. handler는 `data.get("m")`이 문자열일 때만 넘긴다.
- [ ] **4단계: 서버 시험 전체 통과.** `uv run pytest -q`(`test_architecture.py` 포함).
- [ ] **5단계: 커밋** `직원 부르기: 판 사이에 못 닿는 인형을 바로 옮기는 서버 메시지(규약 17)`

### Task 5: 화면 — 메시지와 글

**파일:**
- 고치기: `client/src/net/protocol.ts`(`PROTOCOL = 17`, `encodeStaff`, `Staffed` 타입과 `decode`), `client/src/world/copy.ts`(`UI`)
- 시험: `client/src/net/protocol.test.ts`

**인터페이스:**
- 만드는 것: `encodeStaff(m: string): string` → `{"t":"staff","m":m}`. `type Staffed = { t: 'staffed'; m: string; n: number }`를 `ServerMsg`에 더한다. `UI.staffCall = '직원 부르기'`, `UI.staffMoved = '직원이 인형을 옮겼어요'`, `UI.staffNone = '옮길 인형이 없어요'`.

- [ ] **1단계: 실패하는 시험.** `encodeStaff('A-1')`의 JSON, `decode('{"t":"staffed","m":"A-1","n":2}')`가 그 객체, `n`이 없으면 `null`, `PROTOCOL === 17`.
- [ ] **2단계: 돌려 실패 확인.** `cd client && npx vitest run src/net/protocol.test.ts`
- [ ] **3단계: 구현.**
- [ ] **4단계: 통과와 타입 검사.** 같은 시험 통과, `npx tsc --noEmit` 오류 없음(새 `ServerMsg` 종류 때문에 `main.ts` switch가 깨지면 작업 6에서 처리하도록 일단 `case 'staffed': break;`).
- [ ] **5단계: 커밋** `화면: 직원 부르기 메시지와 글(규약 17)`

### Task 6: 화면 — 판 사이 버튼과 알림

**파일:**
- 고치기: `client/src/ui/playControls.ts`(`showSeatControls`에 직원 버튼), `client/src/main.ts`(`showSeat`, `onMessage` `staffed`, 결과 알림)

**인터페이스:**
- 사용하는 것: `encodeStaff`, `Staffed`, `UI.staffCall / staffMoved / staffNone`
- 만드는 것: `showSeatControls(again, more, stand, noCoins, staff: (() => void) | null = null)`. staff가 있으면 '그만하기' 위 칸에 유리 알약 버튼 `UI.staffCall`, 없으면 숨김. `showRunPause`와 `hideSeatControls`도 숨긴다.

- [ ] **1단계: 버튼.** `playControls.ts`에 `staffBtn`을 `pillButton('glass', ...)`로 만들고 `placeButton` 순서는 아래에서부터 '한 판 더', ('다섯 판 더'), '직원 부르기', '그만하기'.
- [ ] **2단계: `main.ts` 연결.**
  - `showSeat()`에서 `seated`가 인형 기계일 때만(`MACHINES`에 있고 `!isPusher(id)`, `!playFor(id)`) staff 콜백을 넘긴다. 콜백은 `staffWaiting`이 아니면 `staffWaiting = id`로 두고 `socket?.send(encodeStaff(id))`.
  - `case 'staffed'`: `staffWaiting = null`. `m.n > 0`이면 `toast(UI.staffMoved)`, 아니면 `toast(UI.staffNone)`.
  - `endPlay()`와 `welcome`에서 `staffWaiting = null`.
  - 결과 알림(`showResult`의 win과 fail)에서 `m.tidied`일 때 미는 뽑기는 기존 `UI.staffTidy`, 인형 기계는 `UI.staffMoved`.
- [ ] **3단계: 화면 시험과 타입.** `cd client && npx vitest run && npx tsc --noEmit` → 전부 통과.
- [ ] **4단계: 커밋** `화면: 판 사이 '직원 부르기' 버튼과 직원 정리 알림`

### Task 7: 전체 확인

- [ ] **1단계: 서버.** `cd server && uv run pytest -q` → 전부 통과.
- [ ] **2단계: 화면.** `cd client && npx vitest run && npm run build` → 통과.
- [ ] **3단계: 시뮬 전부.** `cd client && npm run sim` → 전부 통과. 새 인형 자리가 좁아져 인형 기계 성공률 시뮬이 바뀌면, 수치를 고치기 전에 무엇이 왜 바뀌었는지 보고한다.
- [ ] **4단계: 실제 화면.** 로컬로 띄워(`run` 스킬 또는 프로젝트 e2e 방식, 크롬 플래그) 인형 기계 한 판 → 판 사이에 '직원 부르기'가 보이는지, 누르면 알림이 뜨는지 휴대폰 크기와 PC 크기 스크린샷으로 확인한다. 끝나면 탭을 닫는다.
- [ ] **5단계: README 기록.** 배포 기록 양식에 '인형 기계 재배치(직원 정리, 직원 부르기), 규약 17, 배포 대기'를 더하고 커밋한다.
