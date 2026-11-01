# 고리 걸기 · 미는 뽑기 다시 만들기 · 인형 부위 고침 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 북쪽의 고리(R-1~R-10)·미는 뽑기(P-1~P-4)를 진짜 가게 기계처럼 물리로 다시 만들고, 인형 부위(왕관·팔다리) 떨어짐을 고치고, 피규어 뒤 진열을 2단 6개로 바꾼다.

**Architecture:**
- **고리 걸기**는 피규어 기계의 길을 쓴다.
  - 같은 집게(`FigureClaw`)와 한 바퀴(`FigureCycleRunner`)를 그대로 쓴다.
  - 막대 대신 평평한 선반 + 앞 출구 + 고리 판 붙은 상자 세계(`HookWorld`)를 둔다.
  - 판 보고·상자 저장·상자 까기는 피규어와 같다.
- **미는 뽑기**는 인형 기계의 길을 쓴다.
  - 같은 레버·잡기·집게(`ClawBody`·`CycleRunner`)를 쓴다.
  - 인형 기계 세계를 넓힌 `PusherWorld`를 둔다: 수북한 칸 + 턱 + 늘 오가는 미는 판 + 턱 끝 출구.
  - 같은 판 보고·중계·저장 길을 쓰고, 기계 종류별 수치(`craneSpec(id)`)만 다르다.
- 계획 11의 서버 판정 고리·미는 뽑기(`act`)는 없앤다. 규약 13.

**Tech Stack:** three.js/TS, Rapier(deterministic-compat), vitest, Python Workers(DO, D1), pytest, import-linter.

**Spec:** `docs/superpowers/specs/2026-11-02-toycrane-ring-hook-and-pusher-crane-design.md`

## Global Constraints

- 무료 요금제 안. 배포는 사용자 허락이 필요하다. 이번 묶음은 사용자가 "다 하고 배포까지"를 미리 허락했다.
- 진짜 기계에 없는 동작을 지어내지 않는다. 설계의 사진 설명과 공략 글이 근거다.
- 화면 일본어 금지, 문장을 가운데 점(·)으로 잇지 않음, 털 표현 금지, 남의 캐릭터·상표 금지, 도는 작은 점 효과 금지.
- 경품은 우리 24종(`shared/catalog.json`), 희귀 3%·황금 0.5%. 미는 뽑기는 한 기계에 24종이 섞인다.
- 휴대폰 관문:
  - 걷기 그리기 호출 400 이하, 기계 앞 160 이하, 걷기 삼각형 180만 이하
  - 물리 프레임당 시간은 인형 기계 수준(휴대폰 흉내 1ms 안팎)
- 같은 입력이면 같은 결과(결정성).
- 커밋 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 고리에 걸린 상자가 물리 풀이에서 튀어 날아가거나 선반·벽을 뚫음 → 상자 속도 상한, 기계 안에 머묾(Task 5 시험).
2. 미는 판·턱에서 인형이 판 속에 끼거나 벽 밖으로 빠짐 → 무작위 100판 뒤에도 모두 기계 안·판 밖(Task 8 시험).
3. 화면이 거짓 당첨을 보고함 → 서버가 거절하고 상자·인형·가방이 그대로:
   - 고리: 상자가 선반 위인데 당첨
   - 미는 뽑기: 없는 uid, 너무 많은 당첨
   - (Task 7·9 시험)
4. 섞인 미니 인형 채우기가 상한(기계당 개수, 희귀 1·황금 1, 매장 황금 3)을 넘김(Task 9 시험).
5. 남이 고리·미는 뽑기를 할 때 근처 화면이 예외로 멈춤(지금 `startWatch`가 인형 기계만 앎) → 두 종류 모두 구경 e2e(Task 6·10).

---

### Task 1: 인형 부위가 몸에 붙게 — 왕관·팔·다리·꼬리
- **Files:**
  - `client/src/world/plush/index.ts`(왕관 자리), `plush/kit.ts`(표면 재기 도우미), 동글이형 부품을 둔 `plush/water.ts`·`dream.ts`·`forest.ts`
  - 필요하면 `plush/parts.ts`
  - 시험 `client/src/world/plush/attach.test.ts`
- **원인** (조사):
  - 왕관은 '충돌 공 맨 위 + 0.02'에 놓인다. 동글이형은 공이 실제 머리보다 높아서 0.08~0.16 떠 있다. 뿔·물줄기는 왕관을 더 띄운다.
  - 동글이형 팔·발·꼬리는 고정 좌표라 몸 표면에 점으로만 닿는다(몸 안 0~9%). 외곽선이 둘레를 그어 떨어져 보인다.
- **고침:**
  - 왕관: 합친 몸 그물(mesh)을 왕관 테 둘레 몇 점에서 아래로 쏘아 머리 표면 높이를 잰다. 테 아래가 표면보다 0.01~0.03 묻히게 놓는다.
  - 동글이형 팔·발·꼬리:
    - 몸 표면을 재서(`nub`처럼) 붙인다.
    - 부품 크기의 25~40%가 몸 안에 묻히게 한다.
    - 개구리 앞발(100% 묻혀 안 보임)은 보이게 꺼낸다.
- **Interfaces:**
  - Produces: `surfaceY(meshes, x, z): number` (kit), 부품별 묻힘 비율을 재는 시험 도우미 `buriedShare(part, body): number`.
- **시험:**
  - `'every limb of every doll is attached to its body'`: 24종 × (보통, lite), 팔·앞발·발·꼬리·날개마다 `buriedShare` ≥ 0.15이고 ≤ 0.9.
  - `'crowns sit on the head'`: 24종 × ('gold', 효과 1개). 왕관 테 아래와 머리 표면 사이 틈 ≤ 0.01, 묻힘 ≤ 0.04.
  - 기존 `plush/variants.test.ts`·`dolls.test.ts` 통과.
- **확인:** `node client/e2e/dogam-shot.mjs`로 도감 24종(보통)과 `?kind=<id>&look=variants` 24장을 고치기 전·후 찍는다. 떠 있거나 떨어진 부위가 없는지 눈으로 본다.
- **커밋:** `fix: 인형 왕관·팔다리가 몸에 붙게 — 표면을 재서 놓음`

### Task 2: 피규어 뒤 진열 2단 6개
- **Files:** `client/src/world/figureMachine.ts:136-141`, 시험 `figureZone.test.ts`
- 지금 단(`tier`) 위에 같은 단을 하나 더 올리고, 단마다 3개씩 상자를 둔다. 위 단은 상자 키만큼 위에 둔다.
- 진열 상자 메시 이름은 `figure-display`.
- **시험:** `'the figure machine shows six display boxes in two tiers'` — `makeFigureMachineParts` 결과에서:
  - `figure-display`가 6개
  - y가 서로 다른 두 값
- 그리기 호출은 늘지 않는다(굽기에 포함).
- **커밋:** `feat: 피규어 기계 뒤 진열 2단 6개`

### Task 3: 계획 11의 서버 판정 고리·미는 뽑기 없애기 (규약 13)
- **없앨 것** (조사 목록 그대로):
  - 서버:
    - `domain/ring.py`·`pusher.py`
    - `act_interactor`·`act_dto`·`act_use_case`·`act_handler`·`act_schema`·`act_provider`, `ws_router`의 `act`
    - `do_storage_rings`·`do_storage_pushers`와 포트, `rings.py`·`pushers.py`
    - enter·snapshot의 rings/pushers
    - `report_lock`의 `ActCommand`
    - `connections_port`·`ws_connections_adapter`·`server_messages`의 ring/pusher, welcome rings/pushers
    - `shared_data` RING/PUSHER, `gen_shared` ring·pusher
    - `shared/ring.json`·`shared/pusher.json`(Task 8이 새 pusher.json을 씀)
    - fixtures와 해당 시험들
  - 화면:
    - `ringZone`·`ringPlay`·`pusherZone`·`pusherPlay`와 시험, `FinishWaits`와 시험
    - `protocol.ts`의 act·ring·pusher·Welcome rings/pushers
    - `copy.ts`의 RING_·PUSHER_·ringHint·pusherHint
    - `main.ts` 연결(`showPrizeResult` 포함)
    - e2e `ring.mjs`·`pusher.mjs`
- **남길 것:**
  - `store_layout.json` rings·pushers 자리와 장애물, 서버 `layout.py` RINGS·PUSHERS, `nav.mjs`
  - `data/rings.ts`·`data/pushers.ts`의 자리·`isRing`·`isPusher`·`nearest*`. 자리만 쓰도록 줄인다.
  - `thumbs.ts`, 지도·가방의 구역 이름
- `main.ts:305`의 `play` 처리에서 `startWatch`는 인형 기계 id일 때만 부른다(`isDollMachine`). 다른 id면 그 기계의 play 객체가 구경을 맡는다(Review Focus 5).
- PROTOCOL 12 → 13(양쪽, fixtures).
- **시험:**
  - 양쪽 전체 통과
  - `'welcome has no rings or pushers fields'`
  - `'a play on a non-doll machine does not start a doll watch'`: main의 판단 함수를 `game/watchRoute.ts`의 `watchKind(id): 'doll' | 'box' | 'pusher' | null`로 빼서 시험
- **커밋:** `refactor: 서버 판정 고리·미는 뽑기 걷어냄, 규약 13`

### Task 4: 상자 기계 일반화 — 피규어 길을 고리 걸기도 쓰게 (동작 그대로)
- **Files:** `physics/figureWorld.ts`·`figureClaw.ts`·`figureCycle.ts`, `game/figurePlay.ts`, `world/figureZone.ts`, `main.ts`; 서버 `figure_done_interactor.py`·`figure_done_provider.py`·`done_handler.py`
- **Produces:**
  - `interface BoxWorld`(`physics/boxWorld.ts`):
    ```ts
    { R; world: RAPIER.World; box: RAPIER.RigidBody; dims: {w,d,h}; power: Power; clawScale: number; floorY: number;
      step(dt): void; boxPose(): BoxWire; fallen(): boolean; still(): boolean; slipRule: 'corners' | 'none' }
    ```
    `FigureWorld`가 이것을 구현한다. `FigureClaw(R, bw: BoxWorld, x, z)`, `FigureCycleRunner(bw, claw, ...)`. `checkSlip`은 `slipRule === 'corners'`일 때만.
  - `type BoxZone = FigureZone`(같은 API: `setBox`, `boxOf`, `worldOf`, `setClaw`, `hideControls`, `occluders`).
  - `type BoxMachine = { spots: {id,x,z,ry}[]; isMine(id): boolean; makeWorld(R, box: BoxWire, id): BoxWorld; labels: ButtonLabels; hint: string }`.
  - `new FigurePlay(scene, zone: BoxZone, deps, machine: BoxMachine)`.
  - 서버: `FigureDoneInteractor(..., rules: BoxRules, zone: str)`. `BoxRules`는 `start_box(rng, id) / check_report(box, won, id) / after_play(state, box, won, rng, id)`를 가진 프로토콜이다. 피규어 규칙은 `domain/figure.py`를 감싼 `FIGURE_RULES`, zone `'figure'`. `done_handler`는 `box_rules_for(machine_id)`로 고른다.
- **시험:**
  - 기존 피규어 시험·시뮬(`sim/figure.test.ts` 200상자 smart 50%선 7) 그대로 통과
  - 서버 `'figure done uses the figure rules and zone'`
- **커밋:** `refactor: 피규어 길을 상자 기계 일반으로 — 고리 걸기 준비`

### Task 5: 고리 걸기 물리 — 평평한 선반, 고리 판 상자, 걸기
- **Files:**
  - `shared/hook.json`(gen_shared가 서버로 복사)
  - `client/src/data/hooks.ts`, `client/src/physics/hookWorld.ts`
  - 시험 `hookWorld.test.ts`, 시뮬 `client/sim/hook.test.ts`
- **hook.json 시작값** (시뮬로 다듬음):
  ```json
  {"shelf": {"y": 0.98, "half_x": 0.4, "back_z": -0.3, "front_z": 0.12}, "exit": {"front_z": 0.32},
   "box": {"w": 0.18, "d": 0.14, "h": 0.24, "mass": 0.45, "com": 0},
   "ring": {"w": 0.12, "d": 0.09, "t": 0.004, "hole": 0.05, "overhang": 0.025},
   "claw_scale": 1.5, "power": {"grip": 1.0, "lift": 1.0, "carry": 0.6},
   "play_half": [0.4, 0.3], "odds": {"rare": 0.03, "gold": 0.005},
   "stuck": {"plays": 8, "move": 0.004, "turn": 0.035}}
  ```
- **HookWorld** (`BoxWorld` 구현):
  - 평평한 선반 cuboid(마찰 0.5), 앞 출구(선반 앞 끝 ~ `exit.front_z`), 옆·뒤 벽, 받는 바닥.
  - 상자 = cuboid + 고리 판. 고리 판은 같은 몸에 붙은 얇은 cuboid 4개로, 네모 구멍(`hole`)을 둘러싼다. 판은 윗면에 놓이고, 구멍 가운데가 상자 옆면에서 `overhang`만큼 바깥이다.
  - 어느 쪽 옆으로 튀어나오는지는 `ringSide: 'left' | 'right' | 'back'`이다. 기계 id로 정하고, 상자를 새로 놓을 때마다 바뀌어도 된다.
  - `slipRule 'none'`: 걸림은 모양으로 정해진다. 상자 속도 상한 2 m/s.
  - `fallen()`: 상자가 출구로 선반 아래 `h`만큼 내려감. 출구를 지난 곳(z)도 확인한다.
- **Produces:** `HookWorld(R, start: BoxWire, ringSide)`, `hookStart(rng, id): BoxWire`(화면 시뮬용, 서버와 같은 규칙).
- **시험:**
  - `'an arm tip through the ring lifts that side of the box'`: 구멍 위로 내려 잡으면 고리 쪽 모서리가 2cm 넘게 들림
  - `'a hooked box is dragged toward the exit when the claw goes home'`: z가 앞으로 3cm 넘게
  - `'a claw that misses the ring only nudges the box'`
  - `'the box only wins through the front exit'`: 옆·뒤로는 못 떨어짐
  - `'a hooked box never flies or leaves the machine'`(Review Focus 1): 무작위 200번 걸기에서 속도 ≤ 2, 기계 안
  - `'the same drop gives the same box'`(결정성)
- **시뮬** (`SIM_TRIALS=200`):
  - 영리하게(고리 구멍 가장자리 4~5시·7~8시 겨누기, 팔 번갈아): 50%선 5~7판, 90%선 ≤ 15
  - 아무 데나 누르기: 50%선이 영리하게보다 2배 넘게 김
- **커밋:** `feat: 고리 걸기 물리 — 선반, 고리 판 상자, 팔 끝 걸기`

### Task 6: 고리 걸기 기계 그림·한 판 (화면)
- **Files:**
  - `client/src/world/hookZone.ts`(`BoxZone` 구현), `client/src/world/hookMachine.ts`(기계 부품)
  - `client/src/game/hookPlay.ts`(BoxMachine 설정 → `FigurePlay`)
  - `copy.ts`(HOOK_SIGN '고리 걸기', 버튼 글씨는 피규어와 같음 '오른쪽'·'안쪽', 힌트는 피규어 힌트)
  - `main.ts` 연결, e2e `client/e2e/hook.mjs`
- **기계 안 그림** (사진 180·181·186): 피규어와 같은 몸통. 흰 선반(육각 무늬 텍스처), 앞 출구 'GET!', 상자('?' 무늬, `blindBoxMat` 재사용), 형광 노랑·연두 고리 판(구멍 보임), 투명 팔 두 개 집게.
  - 10대: 줄마다 굽기, 상자·고리·집게·버튼은 인스턴스.
  - 시점은 피규어 정면·옆. 옆 시점에서 옆 기계가 가리면 그 기계를 숨긴다(1.84m 간격).
- 경품: 피규어 상자 까기(`playReveal`) 그대로, 가방 구역 'ring'.
- **시험:**
  - `'ten hook machines draw in a few meshes'`(≤ 60)
  - `'the ring tab is drawn on the side the world uses'`
- **확인:**
  - e2e `hook.mjs`: 한 판 → 관찰자가 result·figure(R-id) 받음 → 화면 상자 = 서버 상자, 콘솔 오류 0
  - 구경 e2e: 두 화면, 한쪽이 R-1에서 하면 다른 쪽 예외 없이 상자가 움직임
  - PC·휴대폰 스크린샷: 정면, 옆, 고리 걸려 들린 순간. 사진 180·186과 나란히 놓고 고리 판·구멍·팔 끝이 같은 모양인지 본다.
- **커밋:** `feat: 고리 걸기 기계 — 선반, 고리 판 상자, 한 판`

### Task 7: 고리 걸기 서버 — 상자 규칙·저장·판 보고
- **Files:**
  - `server/src/toycrane/domain/hook.py`(start_box, check_report, after_play, `HOOK_RULES`)
  - `adapter/outbound/do_storage_hook_boxes.py`(KEY `hooks_v1`)
  - figure_boxes와 같은 `ensure_hooks`
  - provider·`done_handler`(RINGS → 고리 규칙, zone `'ring'`)
  - welcome `figures`에 R-id 상자도 담음(같은 BoxWire)
  - `figure` 메시지 R-id
  - 시험
- **check_report:**
  - 상자가 선반 위(높이 ≥ shelf.y)면 당첨 거절
  - 출구 아래로 내려갔는데 당첨이 아니라고 하면 거절
  - 자리는 선반·벽 안으로 묶음
- **after_play:** 당첨이면 새 상자, 8판 동안 거의 안 움직이면 반듯이 다시 놓기(피규어 규칙).
- **시험:**
  - `'hook win on the shelf is refused'`(Review Focus 3)
  - `'hook win gives a figure prize in zone ring'`
  - `'a stuck hook box is re-seated'`
  - `'welcome carries hook boxes'`
- **커밋:** `feat: 서버 고리 걸기 — 상자 규칙, 저장, 판 보고`

### Task 8: 미는 뽑기 물리 — 수북한 칸, 턱, 늘 오가는 미는 판
- **Files:**
  - `shared/pusher.json`(새 내용)
  - `client/src/data/pushers.ts`(`craneSpec(id)`)
  - `client/src/physics/pusherWorld.ts`
  - `machineWorld.ts`(상자 짓기 `protected buildBox()`, 인형 크기 `dollScale` 인자)
  - `dollBody.ts`(캐시 키에 크기)
  - `clawCycle.ts`(`CycleOptions.carryTo`, `afterRelease?: (dt) => boolean`)
  - 시험 `pusherWorld.test.ts`, 시뮬 `client/sim/pusher.test.ts`
- **pusher.json 시작값** (기계 좌표, 바닥 = DOLL_FLOOR 기준, 시뮬로 다듬음):
  ```json
  {"doll_scale": 0.18, "count": 30, "cap": 40, "on_ledge": 6, "max_wins": 8,
   "ledge": {"x": [-0.44, -0.12], "z": [-0.16, 0.16], "y": 0.10, "lip": 0.025},
   "exit": {"z": [0.16, 0.38]},
   "plate": {"depth": 0.03, "height": 0.07, "stroke": 0.107, "period": 3.0},
   "drop": [-0.28, -0.04], "grip": 1.6, "settle": {"max_periods": 5}}
  ```
  - `stroke`는 턱 깊이(0.32)의 3분의 1이다(사용자).
- **PusherWorld** (MachineWorld 확장):
  - 바닥: 턱을 뺀 칸. 턱: 높이 `ledge.y`의 상자, 옆 낮은 턱 `lip`. 칸 쪽 옆은 굴러떨어질 수 있다.
  - 출구: 턱 앞 끝 아래(`exit.z`) 구멍. 벽, 천장.
  - 미는 판: kinematic cuboid. `rest_z = ledge.z[0]`에서 `stroke`만큼 앞으로, 사인으로 `period`초 주기. 위에 인형이 얹히지 않게 위가 비스듬하다.
  - 판의 위상은 `t = world 시각`으로 정한다. 같은 입력이면 같은 결과다.
  - `fallen()`: 출구로 떨어진 인형(기존 규칙). 턱 옆으로 굴러 칸에 떨어진 인형은 당첨이 아니다.
  - `settleAfterRelease()`: 판이 한 주기 동안 아무것도 안 움직일 때까지, 최대 `max_periods` 주기.
- **CycleRunner:** 미는 뽑기면 `carryTo = drop`, 잡기 힘 × `grip`이다. release 뒤 `afterRelease`(판 정리)가 끝나야 done이다.
- **겨누는 동안:** 미는 뽑기는 판이 시작된 때부터 세계가 돈다. 판이 밀어 떨어진 인형도 그 판의 당첨이다.
- **시험:**
  - `'the plate pushes only a third of the ledge'`
  - `'dolls dropped on the ledge are pushed off the front edge as they pile up'`: 같은 자리에 n개 놓으면 결국 출구로
  - `'a doll that rolls off the ledge side lands in the pile and is not won'`
  - `'after settling the plate touches no doll'`(판 사이 그림이 아무것도 안 건드림)
  - `'no doll ends inside the plate or outside the walls'`(Review Focus 2, 무작위 100판)
  - `'the same play gives the same ledge'`(결정성)
- **시뮬** (`SIM_TRIALS=200`, 영리하게 = 턱 쪽 가까운 인형을 머리 겨냥): 처음 상태에서 50%선 4~6판, 가끔 한 판 여러 개.
- **커밋:** `feat: 미는 뽑기 물리 — 칸, 턱, 3분의 1만 미는 판`

### Task 9: 미는 뽑기 서버 — 섞인 미니 인형 저장·채우기·판 보고
- **Files:**
  - `server/src/toycrane/domain/stock.py`(`generate_mixed_stock(rng)`, `refill_mixed(stock, now, held, gold_in_store, rng)`)
  - 미는 뽑기 기계 자리 규칙(`domain/pusher_crane.py`: 처음 턱 위 `on_ledge`개, 칸 자리, 출구 밖 생성)
  - `report.py`(기계 종류별 한도 `CraneLimits(max_wins, cap, play_half)`)
  - `done_schema`·`pose_schema` 개수 상한을 기계 종류별로
  - `DoStorageMachineContents`에 `key` 인자(미는 뽑기 `pusher_cranes_v1`)
  - `ensure_contents`·`StockInteractor`가 PUSHERS도 채움
  - `done_handler`(PUSHERS → DoneInteractor, zone `'pusher'`)
  - welcome `machines`에 P-id 포함
  - 시험
- **시험:**
  - `'mixed stock uses many kinds'`
  - `'mixed refill keeps the caps'`(Review Focus 4: 기계당 cap, 희귀 1·황금 1, 매장 황금 3)
  - `'pusher report with an unknown uid or too many wins is refused'`(Review Focus 3)
  - `'pusher win goes to the bag in zone pusher'`
  - `'welcome carries pusher machines'`
- **커밋:** `feat: 서버 미는 뽑기 — 섞인 미니 인형, 저장, 판 보고`

### Task 10: 미는 뽑기 기계 그림·한 판 (화면)
- **Files:**
  - `client/src/world/bigZone.ts`(기계 종류: 인형·미는 뽑기)
  - `client/src/world/pusherMachine.ts`(칸·턱·출구·미는 판 부품)
  - `main.ts`(startPlay·sendDrop·runCycleFrame·watch가 `craneSpec(id)`와 세계 만들기 `craneWorld(R, id, contents)`를 씀)
  - `game/playSession.ts`(놀이 범위를 기계 종류별로)
  - `copy.ts`(PUSHER_SIGN '미는 뽑기', PUSHER_WORD '미니 인형')
  - e2e `client/e2e/pusher.mjs`, `bag.mjs` 다시 겨눔
- **bigZone:**
  - 자리 목록이 `MACHINES ∪ PUSHERS`이고, 기계마다 `type`이 있다. 미는 뽑기 줄은 따로 한 줄로 굽는다.
  - 인형 크기는 `craneSpec(id).dollScale`이다. 간판은 '미는 뽑기'(캐릭터 이름 아님).
  - 미는 판은 인스턴스이고, 판 사이에도 시계로 오간다(그림만, Task 8의 '아무것도 안 건드림'에 기댐).
  - 판 중에는 live 모드로 세계의 판 자리를 따른다.
- **main:**
  - 미는 뽑기면 판 시작부터 세계를 돌리고, 겨누는 동안에도 `PoseSender`로 중계한다.
  - 결과는 `showResult`이다. 여러 개면 기존 토스트.
  - 구경은 `watchKind`가 'pusher'면 doll 구경과 같은 길이다(Task 3).
- **시험:**
  - `'four pusher machines draw within the phone budget'`(기계 앞 ≤ 160은 perf에서)
  - `'pusher dolls are small and mixed'`
- **확인:**
  - e2e `pusher.mjs`: 코인 → P-1 → 한 판 → done 보고·result·machine, 화면 칸 = 서버, 콘솔 오류 0
  - `bag.mjs`: 미는 뽑기에서 뽑힐 때까지(15판), 가방 '미는 뽑기'에 이름
  - 구경 e2e
  - PC·휴대폰 스크린샷: 수북한 칸, 턱 위 쌓인 미니 인형, 미는 판. 사진 187·188과 나란히 본다.
- **커밋:** `feat: 미는 뽑기 기계 — 미니 인형 칸, 턱, 미는 판, 한 판`

### Task 11: 연결·확인
- e2e:
  - hook, pusher, bag, sound
  - figure F-1·F-8, figure-run
  - play, run, watch
  - mobile-entry, mobile-joystick
  - determinism(빈 저장소 서버)
- 성능 `perf.mjs`: ring/pusher 측정을 hook/pusher 새 기계로, 관문 확인.
- 전체 시험.
- README: 고리 걸기·미는 뽑기 다시 만들기, 인형 부위 고침, 진열 2단.
- **커밋:** `docs: 고리 걸기·미는 뽑기 다시 만들기 확인 기록`

### Task 12: 최종 리뷰와 배포
- 가장 유능한 모델로 리뷰하고, Critical·Important는 한 번에 고친다.
- 배포: 사용자가 미리 허락했다. 그 뒤 라이브 확인(hook·pusher·figure·play·run·bag), README Version을 적는다.
- 기록을 records로 옮기고, 작업 폴더를 지우고, main 병합 여부를 묻는다.
