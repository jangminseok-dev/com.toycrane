# 상주 직원(NPC)과 기계 전부 다시 놓기 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 구역마다 한 명씩 서 있는 직원이, 판 사이에 '직원 부르기'를 누른 손님의 기계까지 걸어가 기계 안을 전부 다시 놓고 돌아온다. 매장 사람 모두가 같은 장면을 본다.

**구조:** 서버는 부를 때 직원 일정(출발, 도착, 다시 놓기, 끝, 돌아옴 시각)과 다시 놓은 결과를 한 번에 정해 저장하고 모두에게 보낸다(`staff_plan`). 서버는 그 뒤 깨어날 필요가 없다. 화면은 일정과 같은 길찾기(`routeTo`)로 직원을 그리고, '다시 놓기' 시각에 받아 둔 결과를 기존 `machine`과 `figure` 처리 길로 그린다. 부른 손님 화면은 직원이 오는 동안 카메라가 살짝 뒤로 빠진다.

**기술:** Python Workers + Durable Object(서버, pytest, `uv run`), TypeScript + three.js(화면, vitest), 공용 JSON(`shared/` → `scripts/gen_shared.py`).

**설계:** `docs/superpowers/specs/2026-11-24-toycrane-store-staff-design.md`

## 지켜야 할 것 (모든 작업)

- 화면 글에 가운데 점(·) 금지. 버튼엔 행동만, 상태는 버튼 위 작은 글(`setInfo` 등 기존 자리).
- 직원은 걷기, 정리 손짓, 꾸벅 인사만 한다. 몸 흔들기, 뒤돌아보기 금지. 기계 유리와 조작대를 가리지 않는다.
- 기존 자동 정리(인형 못 닿는 인형, 미는 뽑기 턱 정리와 15판 보장, 피규어와 고리 다시 세우기)는 바꾸지 않는다.
- 진행 안내와 커밋은 한국어. 실패하는 시험은 넘기지 않는다. 마지막에 서버, 화면, 타입, 빌드, 시뮬 전부.
- 브라우저 시험 뒤 탭을 닫는다. 배포는 하지 않는다(사용자가 `!`로).
- 메시지 형식 버전 17 → 18(서버 `server_messages.PROTOCOL`, 화면 `protocol.ts PROTOCOL`, `shared/protocol_fixtures.json`의 welcome `v`).

## 리뷰 때 볼 것

1. 부른 손님이 직원이 오기 전에 그만하기를 누르거나 연결이 끊긴다 → 직원은 그대로 와서 다시 놓고, 그 사이 아무도 그 기계를 시작하지 못하며, 새 인형 채우기도 끼어들지 않는다(작업 4 시험).
2. 같은 구역에서 셋이 연달아 부른다 → 둘째는 첫째 기계 옆에서 곧장 걸어가고, 넷째(기다리는 일 둘이 찬 뒤)는 `busy`로 거절되며 5판 세기에 들어가지 않는다(작업 2, 4 시험).
3. 직원이 걷는 중에 새로 들어온 손님 → welcome의 일정으로 직원이 지금 있을 자리에 바로 나타난다(작업 6 시험).
4. 다시 놓기 시각 전에 그 기계 `machine`이나 `figure`가 다른 이유로 온다 → 서버가 그런 메시지를 보내지 않는다(잠금과 채우기 막기). 화면은 다시 놓기 시각에 일정의 결과를 그린다(작업 4, 7).
5. 휴대폰 세로 화면 → 뒤로 빠진 카메라에서 직원과 기계 유리가 함께 보이고 직원이 유리를 가리지 않는다(작업 9 스크린샷).

---

### Task 1: 공용 직원 설정과 자리 계산

**파일:**
- 만들기: `shared/staff.json`, `client/src/data/staff.ts`, `client/src/data/staff.test.ts`, `server/src/toycrane/domain/staff.py`(자리 부분), `server/tests/domain/test_staff.py`
- 고치기: `server/scripts/gen_shared.py`(STAFF 추가), `server/src/toycrane/domain/shared_data.py`(생성), `server/tests/domain/test_shared_data.py`(STAFF 일치)

**인터페이스:**
- 만드는 것:
  - `shared/staff.json`: `{"posts": {"doll": [x, z], "figure": [x, z], "hook": [x, z], "pusher": [x, z]}, "side": 0.9, "speed": 3.2, "route_factor": 1.3, "walk_min": 1.0, "walk_max": 5.0, "work": 2.0, "bow": 0.8, "queue_max": 2, "calls_every": 5}`. 대기 자리 좌표는 이 작업에서 정한다.
  - 서버 `staff.zone_of(machine_id: str) -> str | None`('doll' MACHINES, 'pusher' PUSHERS, 'figure' FIGURES, 'hook' RINGS), `staff.side_spot(machine_id) -> tuple[float, float]`(기계 앞자리 `front_spot`에서 기계를 바라보는 손님 기준 왼쪽으로 `side` m), `staff.walk_seconds(a, b) -> float`(직선 거리 × `route_factor` / `speed`, `walk_min`~`walk_max`로 자름).
  - 화면 `data/staff.ts`: 같은 이름의 `zoneOf`, `sideSpot`, `STAFF`(설정), `postOf(zone)`.

- [ ] **1단계: 실패하는 시험.**
  - `test_staff.py::test_every_machine_has_a_zone_and_a_side_spot`: 모든 기계 id가 넷 중 한 구역이고, 옆 자리가 장애물(`LAYOUT["obstacles"]`, 여유 0.2m) 밖이며 앞자리에서 `side` m.
  - `test_staff.py::test_walk_seconds_is_clamped`: 0m → `walk_min`, 100m → `walk_max`.
  - `staff.test.ts` `'every machine side spot is reachable from its zone post within the walk time'`: 모든 기계에 대해 `routeTo(post, side)` 길 길이 / `walk_seconds` ≤ `speed × 1.35`(걷는 속도가 손님보다 너무 빠르지 않음) 그리고 걷는 시간 ≤ 5초. 대기 자리는 장애물 밖.
  - `staff.test.ts` `'zoneOf and sideSpot match the server'`: 화면과 서버가 같은 공식을 쓰는지 기계 몇 대의 숫자를 고정해 비교(서버 시험에도 같은 숫자).
- [ ] **2단계: 실패 확인.** `cd server && uv run pytest tests/domain/test_staff.py -q`, `cd client && npx vitest run src/data/staff.test.ts`
- [ ] **3단계: 구현.** 대기 자리 네 곳은 각 구역 기계들의 가운데쯤 걷는 길에서 고르고, 시험이 통과하게 다듬는다.
- [ ] **4단계: 생성과 통과.** `uv run python scripts/gen_shared.py`, 서버 시험 전체와 `npx vitest run src` 통과.
- [ ] **5단계: 커밋** `직원: 구역별 대기 자리와 기계 옆 자리, 걷는 시간(공용 설정)`

### Task 2: 서버 도메인 — 일정, 줄, 5판 세기

**파일:**
- 고치기: `server/src/toycrane/domain/staff.py`
- 시험: `server/tests/domain/test_staff.py`

**인터페이스:**
- 사용하는 것: 작업 1의 `zone_of`, `side_spot`, `walk_seconds`, `STAFF`
- 만드는 것:
  - `@dataclass(frozen=True) class StaffJob: machine: str; depart: float; arrive: float; put: float; end: float`(`put = arrive + work`, `end = put + bow`)
  - `@dataclass(frozen=True) class StaffBoard: jobs: dict[str, tuple[StaffJob, ...]]; calls: dict[str, dict[str, int]]`(구역 → 일 목록, 기계 → 손님 → 부른 뒤 한 판 수)
  - `back_at(jobs, zone) -> float | None`: 마지막 일 `end` + 그 기계 옆 → 대기 자리 걷는 시간
  - `prune(board, now) -> StaffBoard`: 돌아오기까지 끝난 구역의 일을 지운다
  - `plan_call(board, machine, guest, now) -> tuple[StaffBoard, StaffJob] | str`: 거절 이유 `"wait"`(부른 뒤 `calls_every`판 안 됨), `"busy"`(그 구역 `end > now`인 일 중 아직 시작 안 한 일이 `queue_max`개), `"again"`(그 기계에 끝나지 않은 일이 이미 있음). 받으면 앞 일이 있으면 `depart = 앞 일 end`, 출발지는 앞 기계 옆, 없으면 `depart = now`, 출발지는 대기 자리. `calls[machine][guest] = 0`.
  - `count_play(board, machine, guest) -> StaffBoard`: 그 손님 기록이 있으면 +1(기계마다 최근 40명만)
  - `pending(board, machine, now) -> StaffJob | None`: 그 기계의 `put > now`인 일
  - `calls_left(board, machine, guest) -> int`: 다시 부를 수 있을 때까지 남은 판(0이면 지금 가능)

- [ ] **1단계: 실패하는 시험** (각 하나씩):
  - `test_first_call_walks_from_the_post_now`: 빈 보드, now=100 → depart 100, arrive = 100 + walk(post, side), put = arrive + work, end = put + bow.
  - `test_a_second_call_in_the_zone_starts_when_the_first_ends_from_its_side`: 다른 기계 → depart = 첫 일 end, arrive = depart + walk(첫 옆, 둘째 옆).
  - `test_the_queue_holds_two_waiting_jobs`: 같은 구역 네 번째 부르기 → `"busy"`, 보드 그대로.
  - `test_calls_every_five_plays`: 부른 뒤 `count_play` 4번 → `"wait"`, 5번 → 받아짐. 처음 부르는 손님은 바로 받아짐.
  - `test_a_machine_with_an_unfinished_job_refuses_another_call`: `"again"`.
  - `test_prune_drops_jobs_after_the_walk_back`.
  - `test_pending_is_until_put`.
- [ ] **2단계: 실패 확인.** `uv run pytest tests/domain/test_staff.py -q`
- [ ] **3단계: 구현.**
- [ ] **4단계: 통과.** 서버 시험 전체.
- [ ] **5단계: 커밋** `직원: 부르기 일정, 구역 줄(기다림 둘), 5판에 한 번`

### Task 3: 서버 도메인 — 기계별 전부 다시 놓기

**파일:**
- 고치기: `server/src/toycrane/domain/reposition.py`(인형 기계), `server/src/toycrane/domain/pusher_crane.py`(미는 뽑기)
- 시험: `server/tests/domain/test_reposition.py`, `server/tests/domain/test_pusher_crane.py`

**인터페이스:**
- 만드는 것:
  - `reposition.redrop_all(stock: MachineStock, rng) -> MachineStock`: 모든 인형을 `spawn_spot`(기본 `DROP_HALF`)에 하나씩(앞서 놓은 인형을 피해) 안 앉은 채, 곧게. `stuck` 지움. 종류, 색, 희귀, 번호, `misses`, `next_at`, `next_uid`는 그대로.
  - `pusher_crane.redrop_mixed(stock, rng) -> MachineStock`: 턱 위(`d.x < LEDGE.x1`) 인형은 z를 `[z0 + 0.04, z1 - 0.04]`로 자른 그대로 두고 x만 `[x0 + 0.08, x1 - 0.06]`에서 서로 12cm 넘게 다시 고른다(못 찾으면 16→0cm처럼 물러섬). 칸 인형은 `pile_spot`. 모두 안 앉은 채, 곧게. `stuck` 지움.
  - 피규어와 고리 걸기는 기존 `start_box`를 그대로 쓴다(작업 4).

- [ ] **1단계: 실패하는 시험.**
  - `test_redrop_all_moves_every_doll_unsettled_and_keeps_who_they_are`: 9개 → 모두 `y is None`, `q` 곧게, 닿는 범위(`DROP_HALF`) 안, 구멍 밖, (kind, color, rare, uid) 집합 그대로, `stuck == {}`.
  - `test_redrop_mixed_keeps_ledge_dolls_on_the_ledge_at_their_depth`: 턱 위 인형의 z는 그대로(잘린 범위 안), x는 턱 안, 서로 12cm 넘게(가능할 때). 칸 인형은 칸 안. 모두 안 앉음.
  - `test_redrop_mixed_does_not_move_ledge_dolls_forward_on_average`: 시드 50개로 턱 위 인형 z 평균이 다시 놓기 전후 같다(±1mm, 자른 경우 제외).
- [ ] **2단계: 실패 확인.**
- [ ] **3단계: 구현.**
- [ ] **4단계: 통과.** 서버 시험 전체.
- [ ] **5단계: 커밋** `직원: 기계 안 전부 다시 놓기(인형 기계, 미는 뽑기 턱 위는 깊이 그대로)`

### Task 4: 서버 — 직원 부르기 슬라이스, 저장, 잠금, 메시지

**파일:**
- 만들기: `app/ports/output/staff_board_port.py`, `adapter/outbound/do_storage_staff_board.py`(키 `"staff_v1"`, JSON), `tests/fakes.py`의 `FakeStaffBoard`
- 다시 쓰기: `app/use_cases/staff_interactor.py`, `dependencies/staff_provider.py`, `tests/app/use_cases/test_staff_interactor.py`
- 고치기: `app/use_cases/play_start_interactor.py`(+시험), `app/use_cases/stock_interactor.py`(+시험), `app/use_cases/enter_interactor.py`와 `app/dtos/store_snapshot.py`(welcome에 직원), `app/ports/output/connections_port.py`, `adapter/outbound/ws_connections_adapter.py`, `adapter/inbound/ws/schemas/server_messages.py`(+시험, `PROTOCOL = 18`), `shared/protocol_fixtures.json`, 해당 provider들(새 포트 주입)

**인터페이스:**
- 사용하는 것: 작업 2의 `plan_call`, `prune`, `pending`, `count_play`, 작업 3의 `redrop_all`, `redrop_mixed`, 기존 `figure.start_box`, `hook.start_box`, `ensure_contents`, `ensure_figures`
- 만드는 것:
  - `StaffBoardPort.load() -> StaffBoard`, `save(board)`
  - 받는 메시지 그대로 `{"t":"staff","m":id}`. `send_staffed`와 `server_messages.staffed`는 없앤다.
  - 모두에게 `staff_plan`: `{"t":"staff_plan","now":서버시각,"z":구역,"jobs":[{"m","dep","arr","put","end"}...],"back":돌아옴시각,"m":이번 기계,"dolls":[...]|"box":[...]}`(이번 일의 다시 놓은 결과; 인형 기계와 미는 뽑기는 `dolls`, 피규어와 고리는 `box`). 시각은 소수 셋째 자리.
  - 부른 사람에게 `staff_no`: `{"t":"staff_no","m":id,"why":"wait"|"busy"|"again"|"seat","left":n}`(`left`는 `wait`일 때 남은 판).
  - welcome에 `"staff": {구역: {"jobs":[...],"back":t}}`(끝난 구역은 빼고)와 `"now"`.
  - `play_no`의 새 이유 `"staff"`: 그 기계에 `pending` 일이 있으면 누구든 시작 못 함.
  - 시작이 받아지면 `count_play`(그 손님 기록이 있을 때만 +1).

- [ ] **1단계: 실패하는 시험.**
  - `test_staff_call_plans_a_job_redrops_and_tells_everyone`(인형 기계): 판 사이 자리 잡은 손님 → 저장된 기계가 `redrop_all` 결과, 보드 저장, `staff_plan` 한 번(모두에게), 부른 사람 자리 시각 = `put`(판 사이 자리가 put 뒤 20초까지).
  - 같은 시험을 미는 뽑기(`dolls`), 피규어(`box`, 상자 저장소 still 0), 고리 걸기(`HOOK_KEY` 저장소)로 하나씩.
  - `test_staff_call_refused_tells_why`: `wait`(left 포함), `busy`, `again`, 자리 없음과 자리 시간 지남(`seat`) — 저장과 방송 없음.
  - `test_nobody_starts_a_machine_while_staff_is_on_the_way`(play_start): 다른 손님과 부른 손님 모두 `play_no "staff"`, put 뒤엔 시작됨.
  - `test_a_play_start_counts_toward_the_next_call`(play_start): 부른 기록이 있는 손님이 시작하면 +1.
  - `test_refill_waits_for_a_pending_staff_job`(stock): 그 기계는 잠금이 없어도 채우지 않고 시계를 미룬다.
  - `test_welcome_carries_staff_plans_and_server_now`(enter, server_messages, fixture).
  - `test_protocol_is_eighteen`, `staff_plan`/`staff_no` 형식 시험.
- [ ] **2단계: 실패 확인.** `uv run pytest -q`
- [ ] **3단계: 구현.** 부르기 순서: 기계 종류 확인 → 자리 확인(`lock_of`, `is_between`, `hold_over` 아님, 아니면 `seat`) → `prune` → `plan_call`(거절이면 `staff_no`) → 다시 놓기 계산·저장 → 보드 저장 → `locks.hold(conn, m, job.put)` → `staff_plan` 방송.
- [ ] **4단계: 서버 시험 전체와 계층 계약.** `uv run pytest -q`, `PYTHONPATH=src uv run lint-imports`
- [ ] **5단계: 커밋** `직원 부르기 서버: 일정 저장, 전부 다시 놓기, 잠금과 채우기 막기, welcome(규약 18)`

### Task 5: 화면 — 메시지

**파일:**
- 고치기: `client/src/net/protocol.ts`(+`protocol.test.ts`), `client/src/world/copy.ts`

**인터페이스:**
- 만드는 것: `PROTOCOL = 18`; 타입 `StaffJobWire = { m: string; dep: number; arr: number; put: number; end: number }`, `StaffPlan = { t: 'staff_plan'; now: number; z: string; jobs: StaffJobWire[]; back: number; m: string; dolls?: DollSpot[]; box?: BoxWire }`, `StaffNo = { t: 'staff_no'; m: string; why: 'wait' | 'busy' | 'again' | 'seat'; left?: number }`; `Welcome`에 `staff?: Record<string, { jobs: StaffJobWire[]; back: number }>`와 `now?: number`. `Staffed`와 `case 'staffed'`는 없앤다. `UI.staffComing`('직원이 오고 있어요'), `UI.staffSoon`('직원이 곧 와요'), `UI.staffBusy`('직원이 바빠요, 조금 뒤에 불러 주세요'), `UI.staffWait(n)`('직원 부르기까지 n판'), `UI.staffName`('직원'). `UI.staffNone`은 없앤다.
- [ ] **1단계: 실패하는 시험.** fixture의 `server_staff_plan`, `server_staff_no`가 해석된다. 필드가 빠지면 `null`. `PROTOCOL === 18`.
- [ ] **2단계: 실패 확인.** `npx vitest run src/net/protocol.test.ts`
- [ ] **3단계: 구현.** (`main.ts`의 `case 'staffed'`는 지우고 컴파일되게만.)
- [ ] **4단계: 통과와 타입.** `npx tsc --noEmit`
- [ ] **5단계: 커밋** `화면: 직원 일정 메시지(규약 18)`

### Task 6: 화면 — 직원 일정 → 자리와 동작(순수 로직)

**파일:**
- 만들기: `client/src/game/staffSchedule.ts`, `client/src/game/staffSchedule.test.ts`

**인터페이스:**
- 사용하는 것: 작업 1의 `postOf`, `sideSpot`, `STAFF`, `autoWalk.routeTo`, 작업 5의 `StaffJobWire`
- 만드는 것: `staffPose(zone: string, plan: { jobs: StaffJobWire[]; back: number } | null, t: number): { x: number; z: number; face: number; phase: 'idle' | 'walk' | 'work' | 'bow'; k: number }`. 구간: 대기 → (dep~arr 걷기, 첫 일은 대기 자리에서, 다음 일은 앞 기계 옆에서) → (arr~put 정리, 기계를 봄) → (put~end 인사) → 다음 일 또는 (end~back 대기 자리로 걷기) → 대기. 걷기는 `routeTo` 길을 시간 비율대로 따라간다(길은 (from, to)마다 기억). `face`는 걷는 방향, 일할 땐 기계 쪽. `k`는 그 구간 진행 0~1.
- [ ] **1단계: 실패하는 시험.** 일정 없음 → 대기 자리, idle. dep 직후 → 대기 자리 근처, walk. arr~put 가운데 → 옆 자리, work, 기계를 봄. 일 둘 → 둘째 걷기는 첫 기계 옆에서 시작. back 뒤 → 대기 자리. 같은 입력 같은 출력.
- [ ] **2단계: 실패 확인.**
- [ ] **3단계: 구현.**
- [ ] **4단계: 통과.** `npx vitest run src`
- [ ] **5단계: 커밋** `화면: 직원 일정에서 자리와 동작 구하기`

### Task 7: 화면 — 직원 캐릭터와 매장 연결

**파일:**
- 만들기: `client/src/world/staffAvatar.ts`(생김새: `client/dev/staff.ts`의 `ct`를 옮김 — 청록 몸(색 7), 청록 야구모자, 분홍 목줄, 흰 명찰, 가방 숨김, 이름표 `UI.staffName`), `client/src/game/staffNpcs.ts`
- 고치기: `client/src/main.ts`
- 지우기: `client/dev/staff.html`, `client/dev/staff.ts`

**인터페이스:**
- 사용하는 것: 작업 6의 `staffPose`, 작업 5의 메시지
- 만드는 것: `class StaffNpcs { constructor(scene); setClock(serverNow: number, localNow: number); setPlan(zone, plan | null); update(localNow: number): void; sideOf(machine) }` — 네 명을 늘 그린다(`remotes.hideAll`과 상관없이 보임). 동작: walk는 `setWalking(true)`, work는 두 손을 기계 쪽으로 앞뒤로(`rig.handL/handR`), bow는 `bob`과 머리를 앞으로 잠깐 숙임.
- `main.ts`:
  - welcome: `staff.setClock(m.now, now)`, 구역마다 `setPlan`.
  - `staff_plan`: `setPlan(z, {jobs, back})`. 받아 둔 결과를 `put` 시각에 그린다(인형 기계와 미는 뽑기는 `onMessage({t:'machine', m, dolls})`와 같은 길, 피규어와 고리는 `figure` 길, `nudged: false`). 시각이 이미 지났으면 바로.
  - `staff_no`: `busy` → `toast(UI.staffBusy)`, `wait` → 판 사이 버튼 위 `UI.staffWait(left)`, 나머지는 조용히.
- [ ] **1단계: 시험.** `staffAvatar`가 가방을 숨기고 이름표가 '직원'인지(`dogam`/`avatar` 시험 방식처럼 캔버스 스텁으로). 나머지 배선은 작업 9 스크린샷으로 확인.
- [ ] **2단계: 구현과 타입.** `npx tsc --noEmit`, `npx vitest run src`
- [ ] **3단계: 커밋** `화면: 매장 직원 네 명을 일정대로 그리기, 다시 놓기 결과를 그 시각에`

### Task 8: 화면 — 판 사이 버튼 흐름과 카메라 빠지기

**파일:**
- 만들기: `client/src/game/staffCamera.ts`, `client/src/game/staffCamera.test.ts`
- 고치기: `client/src/main.ts`, `client/src/ui/playControls.ts`

**인터페이스:**
- 만드는 것: `staffCameraPose(base: { pos: Vector3; look: Vector3 }, side: { x: number; z: number }, machine: { x: number; z: number }, aspect: number): { pos; look }` — 기계 앞 카메라를 기계에서 멀어지는 쪽으로 빼고 조금 높여, 기계 유리와 옆 자리(직원 키 1.7m)가 모두 화면 안에 들게 한다(세로 화면은 더 뺀다).
- 판 사이 흐름(`main.ts`): 직원 부르기 버튼은 모든 기계 판 사이에 보인다(인형, 미는 뽑기, 피규어, 고리 — `seated` 기계면). 누르면 `encodeStaff`(3초 연타 막기 그대로). 내 기계의 `staff_plan`을 받으면 `staffVisit = {m, dep, put, end}`; 그동안 '한 판 더', '다섯 판 더', '직원 부르기'를 숨기고 '그만하기'만, 상태 글은 `dep` 전 `UI.staffSoon`, 걷는 동안 `UI.staffComing`. 카메라: `dep`부터 `end`까지 `staffCameraPose`로 부드럽게(기존 lerp), 끝나면 원래 자세로. `end`가 지나면 버튼을 다시 보인다. 그만하기를 누르면 `staffVisit`도 지운다.
- 남은 판 표시: 서버 `staff_no wait`의 `left`를 기억했다가 판이 시작될 때마다 1씩 줄여 버튼 위에 `UI.staffWait(n)`. 0이면 숨김(버튼만).
- [ ] **1단계: 실패하는 시험** `staffCamera.test.ts`: PC(16:9)와 휴대폰(9:19.5) 모두, 몇 개 기계(인형 A-1, 미는 뽑기 P-1, 피규어 F-1, 고리 R-1)에 대해 빠진 카메라로 사영했을 때 옆 자리의 머리(높이 1.5m)와 발, 기계 유리 네 모서리가 화면 안(|x|,|y| ≤ 0.95)이고, 옆 자리 사람이 유리 가운데를 가리지 않는다(사영한 사람 상자가 유리 가운데 점을 포함하지 않음).
- [ ] **2단계: 실패 확인.**
- [ ] **3단계: 구현.**
- [ ] **4단계: 통과와 타입.**
- [ ] **5단계: 커밋** `화면: 직원이 오는 동안 판 사이 버튼과 카메라 빠지기, 모든 기계에 직원 부르기`

### Task 9: 전체 확인

- [ ] **1단계: 서버.** `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`
- [ ] **2단계: 화면.** `cd client && npx tsc --noEmit && npx vitest run src && npm run build`
- [ ] **3단계: 시뮬 전부.** `cd client && npm run sim`(미는 뽑기 시뮬이 바뀌면 왜인지 보고).
- [ ] **4단계: 실제 화면(로컬).** 로컬 서버와 헤드리스 크롬으로, 인형 기계, 미는 뽑기, 피규어, 고리 걸기에서 한 판 뒤 직원 부르기 → 직원이 걸어옴(카메라 빠짐), 옆에 섬, 다시 놓기, 인사, 돌아감을 PC와 휴대폰 세로 스크린샷으로. 관찰자 화면에서도 직원이 걷는 모습. 같은 구역 두 사람이 연달아 부를 때 줄. 5판 안에 다시 누르면 남은 판 글. 콘솔 오류 0. 끝나면 탭 닫기.
- [ ] **5단계: 배포 기록.** `docs/DEPLOY_LOG.md`에 '상주 직원(배포 대기, 규약 18)'을 덧붙이고 커밋.
