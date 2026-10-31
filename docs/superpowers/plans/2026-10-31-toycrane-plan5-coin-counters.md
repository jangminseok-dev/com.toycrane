# toycrane 5단계 — 교환소 개편·조르기·코인 주기·광고 간판·화면 문구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 작은 교환소 4곳에서 줄 없이 '코인 받기'·'조르기'를 하고, 맵에서 조르는 사람에게 다른 사람이 원하는 만큼 코인을 주며, 화면 문구·희귀 표시·앞 가림을 깔끔하게 고친다.

**Architecture:**
- 코인은 서버가 정한다. 교환소 받기·조르기·주기는 각각 슬라이스(handler·schema·dto·port·interactor·provider·test)로 만든다.
- 조르기 쿨타임과 주기 이동은 D1 SQL 한 문장으로 조건과 변경을 함께 해서, 탭 여러 개·동시 요청에도 지갑이 틀어지지 않게 한다.
- 맵 조르기 상태는 플레이어 attachment에 두고 방송한다.
- 화면은 문구를 `copy.ts` 한 곳에 모으고, 상태 줄·코인 배지가 있는 행동 버튼으로 바꾼다.

**Tech Stack:** 4단계와 같음 — Python 3.14(Pyodide)·uv·pytest·import-linter, Cloudflare Workers/Durable Objects/D1, TypeScript·Vite·three@0.169.0·vitest

**Spec:** `docs/superpowers/specs/2026-10-31-toycrane-coin-counters-design.md`

## Global Constraints

- 무료만, 유료 전환 금지. 서버를 타이머·알람으로 깨워 두지 않는다(쿨타임은 다음 메시지가 올 때 시각 비교).
- 코인 개수·무작위 금액·쿨타임·주기 확인은 서버가 한다.
- 헥사고날·슬라이스 1:1·import-linter. 일본어 글자 금지.
- 화면 문구에 가운데 점(·)으로 두 문장을 잇지 않는다. 문구는 `client/src/world/copy.ts`에 두고 검사한다.
- 수치
  - 코인 받기 +5, 코인이 15개 미만일 때만(15까지).
  - 교환소 조르기 10~50(정수, 같은 확률), 게스트마다 600초에 한 번.
  - 지갑 최대 99.
  - 창구·주기 손 닿는 거리 1.5m.
- 휴대폰 그리기 호출이 `client/e2e/perf-stock.json`(걷기 370·기계 앞 152)보다 늘지 않는다.
- 메시지 형식이 바뀌므로 `PROTOCOL`을 3으로 올린다(열려 있던 화면은 저절로 한 번 새로고침).

## Review Focus

1. **같은 게스트의 탭 두 개가 교환소 조르기를 같은 순간 누른다** — 한 번만 받아야 한다. (Task 3 `test_beg_sql_grants_once_per_cooldown`)
2. **두 사람이 한 조르는 사람에게 동시에 주거나, 받는 사람이 거의 99개다** — 어느 지갑도 음수나 99 초과가 되면 안 되고, 옮긴 만큼만 줄어야 한다. (Task 4 `test_give_sql_never_breaks_wallets`)
3. **주는 사람이 개수를 고르는 사이 조르던 사람이 움직였거나 멀어졌다** — 서버가 거절하고 주는 사람 코인은 그대로여야 한다. (Task 4 `test_give_to_someone_who_stopped_begging_is_refused`)
4. **새 교환소 자리가 길을 막거나 기계 앞자리를 가린다** — 탑 둘레 어디서 출발해도 교환소 4곳 창구까지 걸어갈 수 있고, 창구가 장애물 안에 있지 않아야 한다. (Task 1 `test_every_window_is_reachable_from_the_hub`)
5. **내가 한 판 하는 동안 다른 사람이 카메라와 기계 사이에 선다** — 내 화면에서는 거의 투명해져야 하고, 옆 기계 앞에 선 사람은 흐려지면 안 된다. (Task 9 `blocksView` 테스트)

---

## 파일 구조

```
shared/store_layout.json, shared/clamp_fixtures.json, shared/protocol_fixtures.json
server/migrations/0004_counter_beg.sql                 # wallets.begged_at
server/src/toycrane/domain/coins.py                    # 수치·규칙 함수
server/src/toycrane/domain/layout.py                   # Counter(창구만)
server/src/toycrane/domain/entities/player.py          # begging
server/src/toycrane/app/...                            # counter_take·counter_beg·beg·give 슬라이스, 줄 슬라이스 삭제
server/src/toycrane/adapter/...                        # handlers·schemas·messages·D1 지갑 SQL
client/src/world/copy.ts                               # 모든 화면 문구
client/src/ui/actionButton.ts, playControls.ts, giveSheet.ts(새)
client/src/world/coinCounter.ts, storeScene.ts, signs.ts, bigZone.ts, avatar.ts, motions.ts, machineControls.ts
client/src/game/autoWalk.ts, machineCamera.ts, remotePlayers.ts
client/src/net/protocol.ts, client/src/main.ts
```

---

### Task 1: 공용 배치 — 작은 교환소 4곳, 줄 자리 없음

**Files:**
- Modify: `shared/store_layout.json`, `shared/clamp_fixtures.json`, `server/src/toycrane/domain/layout.py`, `server/src/toycrane/domain/shared_data.py`(생성), `client/src/data/storeLayout.ts`
- Test: `server/tests/domain/test_shared_data.py`, `client/src/game/autoWalk.test.ts`, `client/src/data/data.test.ts`

**Interfaces:**
- Produces:
  - 교환소 `{"id","x","z","ry","window"}` 4개(줄 `queue` 없음). 모두 `ry: 0`(남쪽을 봄).
    - 0: x −5.5, z −3.0, 창구 [−5.5, −2.15]
    - 1: x 6.0, z 1.5, 창구 [6.0, 2.35]
    - 2: x −6.0, z 6.5, 창구 [−6.0, 7.35]
    - 3: x 4.0, z 8.5, 창구 [4.0, 9.35]
  - 장애물: 옛 교환소 상자 2개를 지우고, 교환소마다 `[x−0.65, z−0.35, x+0.65, z+0.35]`.
  - 서버 `Counter(id, x, z, ry, window: Position)`(queue 필드 삭제). 화면 `CounterSpot`도 같게.
  - clamp 견본 '교환소': in [−5.5, −2.8] → out [−5.5, −2.65].
  - 자리는 만든 뒤 화면을 사용자에게 보여 주고, 필요하면 옮긴다(Task 10).

- [ ] **Step 1: 실패하는 테스트**

```python
def test_four_small_counters_spread_out():
    assert len(layout.COUNTERS) == 4
    xs = sorted((c.x, c.z) for c in layout.COUNTERS)
    for i, a in enumerate(xs):
        for b in xs[i + 1:]:
            assert math.hypot(a[0] - b[0], a[1] - b[1]) > 5  # 나란히 붙지 않음
    for c in layout.COUNTERS:
        assert c.ry == 0 and c.window.z > c.z
```

```ts
// autoWalk.test.ts — Review Focus 4
test('every window is reachable from the hub', () => {
  for (const c of COUNTERS) for (const a of [0, 1.6, 3.2, 4.8]) {
    const from = { x: Math.cos(a) * 2.4, z: Math.sin(a) * 2.4 };
    const pts = routeTo(from, { x: c.window[0], z: c.window[1] });
    expect(pts.length).toBeGreaterThan(0);
    expect(OBSTACLES.some(([x0, z0, x1, z1]) => c.window[0] > x0 && c.window[0] < x1 && c.window[1] > z0 && c.window[1] < z1)).toBe(false);
  }
});
```

(서버에도 `test_every_window_is_reachable_from_the_hub`: 창구가 어떤 장애물 상자 안에도 없고 `clamp_to_floor(window) == window`.)

- [ ] **Step 2: 실패 확인** — `cd server && uv run pytest tests/domain -q`, `npm --prefix client test -- autoWalk data` → FAIL.
- [ ] **Step 3: 구현**
  - JSON을 고치고 `uv run python scripts/gen_shared.py`를 돌린다. 서버 layout·화면 storeLayout 타입을 맞춘다.
  - 줄 자리를 쓰던 곳은 Task 3·7이 없앤다. 이 Task에서는 컴파일만 맞춘다(`QueueClient.entrySpot`은 창구 자리를 돌려주게).
- [ ] **Step 4: 통과 확인** — 서버 `uv run pytest -q`, 화면 `npm --prefix client test` 전체 PASS.
- [ ] **Step 5: Commit** — `feat: 작은 교환소 4곳을 매장 곳곳에, 줄 자리 없음`

### Task 2: 서버 도메인 — 코인 규칙

**Files:**
- Modify: `server/src/toycrane/domain/coins.py`
- Test: `server/tests/domain/test_coins.py`(새, 없으면)

**Interfaces:**
- Produces(`coins.py`):
  - `COINS_PER_TAKE = 5`, `TAKE_LIMIT = 15`, `WALLET_CAP = 99`, `WINDOW_REACH = 1.5`.
  - `BEG_MIN, BEG_MAX = 10, 50`, `BEG_COOLDOWN = 600.0`, `GIVE_REACH = 1.5`.
  - `take_amount(balance: int) -> int`: `max(0, min(COINS_PER_TAKE, TAKE_LIMIT - balance))`.
  - `beg_award(rng) -> int`: `rng.randint(BEG_MIN, BEG_MAX)`.
  - `beg_wait(begged_at: float | None, now: float) -> float`: 남은 초(0이면 받을 수 있음).
  - `give_limit(giver: int, receiver: int) -> int`: `max(0, min(giver, WALLET_CAP - receiver))`.
  - 옛 `TAKE_SECONDS`, `TAKE_SLACK`, `HEAD_TIMEOUT`, `QUEUE_SLOTS`와 `coin_queue.py`는 Task 3에서 지운다.

- [ ] **Step 1: 실패하는 테스트**

```python
def test_take_tops_up_to_fifteen():
    assert [take_amount(b) for b in (0, 10, 12, 15, 40)] == [5, 5, 3, 0, 0]

def test_beg_award_is_ten_to_fifty():
    rng = random.Random(1); got = {beg_award(rng) for _ in range(5000)}
    assert min(got) == 10 and max(got) == 50 and len(got) == 41

def test_beg_waits_ten_minutes():
    assert beg_wait(None, 100.0) == 0 and beg_wait(100.0, 700.0) == 0 and beg_wait(100.0, 400.0) == 300.0

def test_give_limit_respects_both_wallets():
    assert give_limit(30, 0) == 30 and give_limit(30, 90) == 9 and give_limit(0, 0) == 0 and give_limit(5, 99) == 0
```

- [ ] **Step 2: 실패 확인** — FAIL(함수 없음).
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `uv run pytest tests/domain -q` PASS.
- [ ] **Step 5: Commit** — `feat: 코인 규칙 — 받기 15개까지, 조르기 10~50·10분, 지갑 99, 주기 한도`

### Task 3: 서버 — 교환소 코인 받기·조르기 (줄 없앰), D1 0004

**Files:**
- Create:
  - `server/migrations/0004_counter_beg.sql`(`ALTER TABLE wallets ADD COLUMN begged_at REAL;`)
  - 슬라이스 `counter_take`(dto·input port·interactor·provider·handler·schema), 슬라이스 `counter_beg`(같은 구성)
- Delete:
  - `queue_join_*`, `queue_leave_*`, `coin_take_*`(handler·provider·interactor·port·dto)
  - `queue_settle.py`, `queue_registry_port.py`, `attachment_queue_registry.py`, `coin_queue.py`, `queue_schema.py`, `queue_dto.py`, `take_dto.py`
  - 그 테스트들
- Modify:
  - `wallet_port.py`, `d1_wallet_adapter.py`, `connections_port.py`, `ws_connections_adapter.py`, `server_messages.py`, `ws_router.py`
  - `connection_cleanup.py`, `enter_interactor.py`, `leave_interactor.py`, `store_snapshot.py`(queues 삭제), providers, `tests/fakes.py`
  - `shared/protocol_fixtures.json`
- Test: `server/tests/app/use_cases/test_counter_take_interactor.py`, `test_counter_beg_interactor.py`, `server/tests/adapter/test_wallet_sql.py`(새)

**Interfaces:**
- Consumes: Task 2 규칙, Task 1 `COUNTERS`.
- Produces:
  - 메시지(화면 → 서버): `{"t":"take","c":0}`, `{"t":"cbeg","c":0}`.
  - 메시지(서버 → 화면)
    - `coins {n, got}`(그대로).
    - `take_no {c, why: "far"|"enough"}`.
    - `cbeg {id, c, n}`: 방송. 모두 그 사람의 3초 조르기 모션 뒤 결과를 그린다.
      - 받으면 n은 받은 수.
      - 쿨타임 거절이면 n=0(시무룩 모션).
    - `cbeg_no {c, why: "wait"|"full"|"far", wait: 초}`: 본인에게, 상태 줄용.
      - `wait`이면 위 방송(n=0)과 함께 보낸다.
      - `full`·`far`이면 방송 없이 이것만.
  - `WalletPort.beg(guest_id, n, cap, cooldown, now) -> int | None`: 쿨타임이 지났고 cap 미만이면 n을 더하고(cap까지) `begged_at = now`로 바꾼 뒤 새 잔액. 아니면 None.
  - `WalletPort.begged_at(guest_id) -> float | None`.
  - D1 SQL은 어댑터 모듈 상수 `BEG_SQL`(upsert + `ON CONFLICT DO UPDATE ... WHERE (begged_at IS NULL OR begged_at <= ?now - ?cooldown) AND coins < ?cap RETURNING coins`)로 둔다. 파이썬 sqlite3로 그 상수를 직접 시험한다.
  - welcome에서 `queues`를 뺀다(StoreSnapshot에서도).
  - 접속 정리는 기계 잠금만 푼다.

- [ ] **Step 1: 실패하는 테스트**

```python
async def test_take_gives_five_up_to_fifteen():  # 창구 1.5m 안, 12개 → 15개
    ...; assert conns.direct[-1][1] == {"t": "coins", "n": 15, "got": 3}

async def test_take_with_enough_coins_says_so():  # 15개 → take_no enough, D1 쓰기 없음
async def test_take_from_afar_is_refused():  # 창구 2m → take_no far

async def test_counter_beg_grants_and_tells_everyone():  # Rolls → 37, cbeg 방송 n=37, coins 직접
async def test_counter_beg_within_ten_minutes_is_refused_with_wait():  # cbeg_no wait, wait≈300
async def test_counter_beg_with_full_wallet_keeps_the_cooldown():  # 99개 → cbeg_no full, begged_at 그대로

# test_wallet_sql.py — Review Focus 1 (sqlite3 메모리 DB에 0002·0004 적용)
def test_beg_sql_grants_once_per_cooldown():
    assert run(BEG_SQL, g="g-1", n=20, now=1000.0) == 20
    assert run(BEG_SQL, g="g-1", n=30, now=1000.0) is None  # 같은 순간 두 번째 탭
    assert run(BEG_SQL, g="g-1", n=30, now=1600.0) == 50
def test_beg_sql_caps_at_99():  # 90개 + 40 → 99
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현**
  - 지운 줄 슬라이스를 쓰던 곳을 정리한다. 견본(`client_queue`, `client_unqueue`, `client_take`, `server_queue`, `server_queue_no`, welcome의 `queues`)을 새 메시지 견본(`client_take`, `client_cbeg`, `server_take_no`, `server_cbeg`, `server_cbeg_no`)으로 바꾼다.
  - 로컬 D1에 0004를 적용한다: `cd server && npx wrangler d1 migrations apply toycrane --local`.
- [ ] **Step 4: 통과 확인** — `uv run pytest -q`, `PYTHONPATH=src uv run lint-imports` PASS.
- [ ] **Step 5: Commit** — `feat: 교환소 코인 받기(줄 없이 바로)·조르기(10~50, 10분), 줄 기능 삭제, D1 0004`

### Task 4: 서버 — 맵 조르기 상태와 코인 주기

**Files:**
- Create: 슬라이스 `beg`(맵 조르기 켜고 끄기), 슬라이스 `give`
- Modify: `entities/player.py`(`begging: bool = False`), `player_view.py`(`beg: int | None` — 조르는 중이면 더 받을 수 있는 코인 수, 아니면 None), `move_interactor.py`, `wallet_port.py`·`d1_wallet_adapter.py`(`transfer`), messages·connections·router·fixtures
- Test: `test_beg_interactor.py`, `test_give_interactor.py`, `test_move_interactor.py`, `test_wallet_sql.py`

**Interfaces:**
- Produces:
  - 메시지
    - 화면 → 서버: `{"t":"beg","on":true|false}`, `{"t":"give","to":player_id,"n":int}`.
    - 서버 → 화면
      - `beg {id, room}`(방송). room은 조르는 중이면 `WALLET_CAP − 그 사람 코인`, 끝나면 null. 주기 창의 최대를 화면이 알게 한다.
      - `gave {from, to, n}`(방송 — 주기·기쁨 모션과 알림).
      - `give_no {why: "gone"|"stopped"|"far"|"poor"|"full"|"self"|"playing"}`(주는 사람에게).
      - `coins`(두 사람 각각).
  - 플레이어 보기(welcome·join의 플레이어)에 `beg` 필드(room 또는 null).
  - 움직이면 조르기가 끝난다: `MoveInteractor`가 `heading`이 0이 아니고 조르는 중이면 `begging=False`로 바꾸고 `beg {id, room:null}`를 방송한다.
  - `WalletPort.transfer(giver, receiver, n, cap, now) -> tuple[int, int] | None`.
    - SQL 상수 `TRANSFER_SQL`: 받는 사람 지갑 행을 `INSERT OR IGNORE`로 만든 뒤, UPDATE 한 문장이 두 행을 CASE로 바꾼다. 조건은 주는 사람 코인 ≥ n, 받는 사람 + n ≤ cap.
    - 성공하면 (주는 사람 잔액, 받는 사람 잔액), 실패하면 None.
  - `GiveInteractor`
    - 거절하는 경우
      - 받는 사람이 없음(`gone`)
      - 조르는 중이 아님(`stopped`)
      - 거리가 `GIVE_REACH`보다 멂(`far`)
      - 같은 게스트(`self`)
      - 주는 사람이 기계 잠금을 가짐(`playing`)
      - `n < 1`이거나 `give_limit`보다 큼(`poor`/`full`)
    - 성공하면 받는 사람의 조르기 상태를 끄고 `beg {id, room:null}`와 `gave`를 방송한 뒤, 각자에게 `coins`를 보낸다.

- [ ] **Step 1: 실패하는 테스트**

```python
async def test_begging_shows_to_everyone_and_moving_stops_it(): ...
async def test_give_moves_coins_and_stops_begging(): ...  # 주는 사람 20→15, 받는 사람 0→5, gave 방송, beg off
async def test_give_to_someone_who_stopped_begging_is_refused():  # Review Focus 3 — give_no stopped, 지갑 그대로
async def test_give_to_yourself_in_another_tab_is_refused(): ...
async def test_give_more_than_fits_is_refused(): ...  # 받는 사람 97, n=5 → give_no full

def test_give_sql_never_breaks_wallets():  # Review Focus 2
    seed(g1=10, g2=95)
    assert run(TRANSFER_SQL, frm="g1", to="g2", n=5, cap=99) is None  # 100 > 99
    assert run(TRANSFER_SQL, frm="g1", to="g2", n=4, cap=99) == (6, 99)
    assert run(TRANSFER_SQL, frm="g1", to="g3", n=7, cap=99) is None  # 6 < 7, g3 0개 그대로
    assert balances() == {"g1": 6, "g2": 99, "g3": 0}
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `uv run pytest -q`, `lint-imports` PASS.
- [ ] **Step 5: Commit** — `feat: 맵 조르기 상태와 코인 주기(주는 사람이 개수를 정함, 서버가 한 번에 옮김)`

### Task 5: 화면 — 메시지와 문구 모음

**Files:**
- Modify: `client/src/net/protocol.ts`, `client/src/net/protocol.test.ts`, `client/src/world/copy.ts`, `client/src/world/copy.test.ts`
- Delete: `client/src/game/queueClient.ts`(+test) — Task 7에서 쓰는 곳을 바꾼 뒤 지워도 된다(이 Task에서는 import만 남기지 않게)

**Interfaces:**
- Produces:
  - `PROTOCOL = 3`.
  - 새 메시지 타입: `TakeNo`, `CounterBeg`, `CounterBegNo`, `Beg`(`{ t:'beg'; id; room: number | null }`), `Gave`, `GiveNo`. `PlayerView.beg: number | null`.
  - 인코더: `encodeTake(c)`, `encodeCounterBeg(c)`, `encodeBeg(on)`, `encodeGive(to, n)`. `encodeQueue`·`encodeUnqueue`는 지운다.
  - `copy.ts`에 화면 문구를 모두 옮긴다(스펙 §4.7 표의 '바꿀 문구' 그대로). 이름 예:
    - `UI.playOne`, `UI.playRun(n)`, `UI.again`, `UI.againRun(n)`, `UI.stand`.
    - `UI.noCoins`, `UI.goCounter`, `UI.takeCoins`, `UI.beg`, `UI.stopBeg`, `UI.give`.
    - `UI.enough`, `UI.full`, `UI.begWait(min)`, `UI.someoneBegs(nick)`, `UI.watching`.
    - `UI.continueIn(s)`, `UI.nextRun(k)`, `UI.hint`.
    - `UI.gotCoins(n)`, `UI.gaveYou(nick, n)`, `UI.youGave(n)`, `UI.giveNo[why]`, `UI.noCoinsToast`.
    - `POP_CARDS = ['새로 왔어요', '잘 잡혀요', '오늘의 추천', '인기 1위', '한정판', '행운 기계']`.
    - `AD_SIGNS = 광고문의1~10`, `BEGGING = '조르는 중'`, `RARE_TAG = { rare: '★ 희귀', gold: '★★ 황금' }`.
    - `UI.nextRun(k)`의 한국어 순서 단어는 '두 번째'…'다섯 번째'.

- [ ] **Step 1: 실패하는 테스트**
  - 새 견본 해석(`server_take_no`, `server_cbeg`, `server_cbeg_no`, `server_beg`, `server_gave`, `server_give_no`), 인코더가 견본과 같음.
  - `copy.test.ts`
    - 모든 문구(함수는 대표 값으로 불러서)에 일본어 없음.
    - **가운데 점 `·` 없음.**
    - `UI.nextRun(2) === '곧 두 번째 판이 시작돼요'`.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npm --prefix client test`, `tsc` PASS(이 Task 끝에 main.ts가 컴파일되게 옛 문구 자리만 `UI.*`로 바꾼다).
- [ ] **Step 5: Commit** — `feat: 화면 메시지 v3과 문구 모음(가운데 점 없이)`

### Task 6: 화면 — 버튼·알약·잡기 글씨·유리 카드 다듬기

**Files:**
- Modify: `client/src/ui/actionButton.ts`, `client/src/ui/playControls.ts`, `client/src/world/signs.ts`(dropLabelTex·popTex), `client/src/world/machineControls.ts`, `client/src/world/bigZone.ts`(겨냥 고리), `client/src/main.ts`
- Test: `client/src/ui/actionButton.test.ts`(새, 순수 함수), `client/src/world/machineControls.test.ts`, `client/src/world/bigZone.test.ts`

**Interfaces:**
- Produces:
  - `setAction(label, onPress, opts?: { status?: string | null; badge?: number | null; extra?: { label: string; badge?: number; onPress } | null; dim?: boolean })`.
    - 상태 줄은 버튼 위 작은 글.
    - 배지는 버튼 오른쪽 '🪙 N'.
  - `showSeatControls`도 배지·상태 줄을 쓴다(한 판 더 🪙1, 다섯 판 더 🪙5).
  - `setTimer(seconds, run)`: 알약에 시간만, run이 있으면 작은 칩. `showHint()`는 알약 아래에 3초 떴다 사라진다(한 판 시작마다).
  - 잡기 글씨
    - `dropLabelTex`: 글씨 크기를 줄여 윗면 안에(캔버스 여백 20% 이상).
    - 라벨 평면은 돔 윗면 지름의 80% 안.
  - 유리 카드: `popTex`가 간판 글꼴(`SIGN_FONT`)로 가운데 정렬, 영어·특수기호 없는 `POP_CARDS`.
  - 겨냥 고리: `showAim`이 켜져 있어도 집게가 상품 구멍 원 안(`MACHINE_SPEC.hole`)에 있으면 숨긴다(`main.ts`가 매 프레임 판단하는 순수 함수 `aimVisible(claw)`를 `game/aim.ts`에).

- [ ] **Step 1: 실패하는 테스트**
  - `aimVisible({ x: -0.36, z: 0.27 }) === false`, `aimVisible({ x: 0, z: 0 }) === true`.
  - 잡기 라벨 크기가 돔 지름의 0.8 이하(`machineControls.test.ts`).
  - `actionButton.test.ts`: 순수 함수 `buttonParts(label, badge)`가 `{ text: '한 판 하기', badge: '🪙 1' }`를 돌려준다.
- [ ] **Step 2~4:** FAIL → 구현 → `npm --prefix client test` PASS.
- [ ] **Step 5: Commit** — `feat: 문구 다듬기 — 상태 줄·코인 배지, 시간 알약, 잡기 글씨, 유리 카드, 구멍 위 겨냥 고리 숨김`

### Task 7: 화면 — 작은 교환소, 코인 받기·조르기, 교환소 가기, 광고 간판

**Files:**
- Modify: `client/src/world/coinCounter.ts`, `client/src/world/storeScene.ts`, `client/src/world/signs.ts`, `client/src/game/autoWalk.ts`, `client/src/main.ts`
- Delete: `client/src/game/queueClient.ts`, `client/src/game/queueClient.test.ts`
- Test: `client/src/world/coinCounter.test.ts`(있으면 고침), `client/src/world/storeScene.test.ts`(간판), `client/src/game/autoWalk.test.ts`

**Interfaces:**
- Consumes: Task 1 `COUNTERS`, Task 5 메시지·`UI`, Task 6 `setAction`.
- Produces:
  - `buildCoinCounters(scene)`
    - 부스는 폭 1.3m·깊이 0.7m(장애물 상자와 같음), 창살·창구·'코인 교환소' 간판을 줄인다.
    - 줄 차단봉·발자국 6개는 없애고, 창구 앞 발자국 한 쌍만 둔다.
    - 4곳을 행 하나로 합쳐 그린다(그리기 호출이 늘지 않게).
  - 걷기 중 버튼
    - 창구 1.5m 안: '코인 받기'(큰 버튼), '조르기'(작은 버튼). 15개 이상이면 상태 줄 '코인이 넉넉해요'와 흐린 버튼.
    - 0개일 때: 상태 줄 '코인이 없어요' / '교환소 가기'. 누르면 가장 가까운 창구까지 걷기만 하고 저절로 받지 않는다.
  - `cbeg` 받으면 3초 조르기 모션(Task 8) 뒤
    - n > 0: 코인 튀는 연출과 알림 `UI.gotCoins(n)`(본인).
    - n = 0: 시무룩 모션.
  - `cbeg_no wait`: 상태 줄 `UI.begWait(Math.ceil(wait / 60))`.
  - 광고 간판 10장
    - 북쪽 벽 4장, 동·서 벽 각 2장, 남쪽 벽 2장(남쪽 벽은 카메라 쪽이라 위쪽만).
    - 문구 `AD_SIGNS`, 위에 작게 'toycrane'.
    - 10장을 한 그림(가로 2×5 칸 아틀라스)에 그려 메시 하나로.

- [ ] **Step 1: 실패하는 테스트**
  - 간판 메시가 하나이고 사각형 10개(삼각형 20개).
  - 교환소 4곳이 메시 몇 개로 합쳐짐(재질 수 이하).
  - `routeTo` 가장 가까운 창구 선택 함수 `nearestCounter(pos)`가 맞는 교환소를 고른다.
- [ ] **Step 2~4:** FAIL → 구현 → PASS.
- [ ] **Step 5: Commit** — `feat: 작은 교환소 4곳·코인 받기·교환소 조르기·교환소 가기·광고 간판 10장`

### Task 8: 화면 — 맵 조르기·주기 창·모션

**Files:**
- Create: `client/src/ui/giveSheet.ts`, `client/src/ui/giveSheet.test.ts`
- Modify: `client/src/world/motions.ts`, `client/src/world/avatar.ts`, `client/src/game/remotePlayers.ts`, `client/src/main.ts`
- Test: `client/src/world/motions.test.ts`, `client/src/game/remotePlayers.test.ts`(있으면), `giveSheet.test.ts`

**Interfaces:**
- Consumes: Task 5 메시지·`UI`, Task 6 버튼.
- Produces:
  - 모션(`motions.ts`)
    - `startBegging(rig, tw): { stop(): Promise<void> }`(두 손 모으고 폴짝·고개 갸웃 되풀이).
    - `playGive(rig, tw, toward: number)`.
    - `playHappy(rig, tw)`(폴짝 + 하트·코인 반짝은 `effects.burst`).
    - `playSulk(rig, tw)`.
  - `Avatar.setTag(text: string | null)`: 이름표 옆 작은 꼬리표('조르는 중').
  - `RemotePlayers.setBegging(id, room: number | null)`: 모션 시작·정지와 꼬리표, room 기억(`roomOf(id)`).
  - 주기 창 `openGiveSheet({ nick, max, onGive(n), onCancel })` — max = `min(내 코인, roomOf(그 사람))`, 0이면 버튼 위에 `UI.full`
    - 1~max, 기본 1, −/+/'최대', '주기'.
    - 순수 함수 `clampGive(n, max)`.
  - 버튼
    - 걷기 중(기계 앞·창구 근처 아님): '조르기'. 조르는 중에는 '그만 조르기'.
    - 조르는 사람 1.5m 안: 상태 줄 `UI.someoneBegs(nick)` / '주기'.
    - 내가 움직이면 서버가 끄지만, 화면도 바로 내 조르기 모션을 멈춘다.
  - `gave` 받으면 다음을 보여 준다.
    - 주는 사람 `playGive`, 받는 사람 `playHappy`(모두).
    - 받는 사람이 나면 알림 `UI.gaveYou(nick, n)`, 주는 사람이 나면 `UI.youGave(n)`.
  - `give_no`: 알림 `UI.giveNo[why]`.

- [ ] **Step 1: 실패하는 테스트**
  - `clampGive(0, 5) === 1`, `clampGive(9, 5) === 5`.
  - 조르기 모션이 stop 뒤 손이 쉬는 자리로 돌아온다.
  - `setBegging`이 꼬리표를 붙였다 뗀다.
- [ ] **Step 2~4:** FAIL → 구현 → PASS.
- [ ] **Step 5: Commit** — `feat: 맵 조르기·코인 주기 창·조르기/주기/기쁨/시무룩 모션`

### Task 9: 화면 — 희귀 이름표, 앞을 가리는 사람 흐리기

**Files:**
- Modify: `client/src/world/bigZone.ts`, `client/src/world/signs.ts`, `client/src/world/avatar.ts`, `client/src/game/machineCamera.ts`, `client/src/main.ts`
- Test: `client/src/world/bigZone.test.ts`, `client/src/game/machineCamera.test.ts`, `client/src/world/avatar.test.ts`

**Interfaces:**
- Produces:
  - 희귀 표시
    - 행마다 `rare-tags` 메시 하나: 이름표 평면 InstancedMesh(아틀라스 2칸: `RARE_TAG.rare`·`RARE_TAG.gold`, 황금은 1.3배), 기계 좌표 (0, 2.62, 0.3)에서 위아래로 3cm 흔들림.
    - 별 반짝이 `rare-twinkles` InstancedMesh(네 갈래 별 평면, 기계마다 3개, 제자리에서 크기 0.6~1.0으로 맥박).
    - 4단계의 `rare-sparkles`는 지운다.
  - 앞 가림
    - `blocksView(machine: MachineSpot, p: Vec2): boolean`(`machineCamera.ts`): 기계 좌표로 옮겨 `|x| < 0.85 && 0.45 < z < 2.3`.
    - `Avatar.setFade(opacity: number)`: 처음 흐릴 때 그 아바타 재질만 복제해 투명하게, 이름표·꼬리표도. 1이면 원래 재질로.
    - `main.ts`: 기계 카메라를 쓰는 동안 다른 사람마다 `blocksView`면 목표 0.15, 아니면 1로, 0.2초에 걸쳐 바꾼다.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('someone between my camera and my machine blocks the view, the next machine does not', () => {
  const m = MACHINES.find((x) => x.id === 'C-6')!; // x 0, z -6.55, ry 0
  expect(blocksView(m, { x: 0, z: -5.4 })).toBe(true);   // 기계 앞자리 바로 앞
  expect(blocksView(m, { x: 0.3, z: -4.6 })).toBe(true);
  expect(blocksView(m, { x: 1.85, z: -5.4 })).toBe(false); // 옆 기계(C-7) 앞
  expect(blocksView(m, { x: 0, z: -3.9 })).toBe(false);   // 카메라 뒤
});
// bigZone: 희귀 하나 → rare-tags 인스턴스 1, 황금 → 그 이름표가 1.3배, rare-sparkles는 없다
// avatar: setFade(0.15) 뒤 메시 재질 opacity 0.15·transparent, 다른 아바타 재질은 그대로(복제), setFade(1) 뒤 원래 재질
```

- [ ] **Step 2~4:** FAIL → 구현 → PASS.
- [ ] **Step 5: Commit** — `feat: 희귀 이름표(★ 희귀/★★ 황금)·제자리 반짝임, 한 판 중 앞을 가리는 사람 흐리기`

### Task 10: 확인·배포

- [ ] **Step 1: 성능** — `node client/e2e/perf.mjs http://localhost:8787 client/e2e/perf-coins.json`.
  Expected: 휴대폰 걷기 ≤ 370, 기계 앞 ≤ 152(±5%).
- [ ] **Step 2: e2e(로컬)**
  - mobile-entry·mobile-joystick.
  - 새 흐름
    - 교환소 가기 → 코인 받기 즉시 +5.
    - 15개면 '코인이 넉넉해요'.
    - 교환소 조르기 → 3초 뒤 10~50, 다시 누르면 'N분 뒤에 다시 와요'.
  - 두 화면
    - A 조르기 → B가 '주기' 3개 → 두 지갑 숫자·모션·알림.
    - A가 움직이면 '조르는 중'이 사라짐.
  - 앞 가림: A가 한 판 하는 동안 B가 앞에 서면 A 화면에서 흐림. 스크린샷.
- [ ] **Step 3: 화면 확인** — 다음을 PC·휴대폰 스크린샷으로 사용자에게 보여 준다(교환소 자리는 필요하면 옮김).
  - 교환소 4곳 자리
  - 광고 간판
  - 버튼 문구·배지
  - 시간 알약·안내
  - 잡기 글씨
  - 유리 카드
  - 희귀 이름표
- [ ] **Step 4: 전체 검토** — 새 검토자(가장 좋은 모델)가 브랜치 전체를 보고, 중요한 지적을 고친 뒤 배포한다.
- [ ] **Step 5: 배포**
  1. 클라이언트 빌드.
  2. `cd server && npx wrangler d1 execute toycrane --remote --json --command "SELECT * FROM wallets"`로 백업.
  3. `npx wrangler d1 migrations apply toycrane --remote` 직후 `CI=1 uv run pywrangler deploy`.
  4. 라이브에서 코인 받기·조르기 한 번.
  - 배포는 사용자 허락을 받고 한다.
- [ ] **Step 6: README 확인 기록** — 측정값·확인 범위를 적고 커밋.
