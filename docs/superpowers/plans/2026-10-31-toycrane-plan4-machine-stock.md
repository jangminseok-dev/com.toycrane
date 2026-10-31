# toycrane 4단계 — 인형 채우기·희귀 2단계·한 기계 한 종류·인형 변형 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 큰인형 기계 24대가 캐릭터 하나씩을 담고, 인형마다 색·체형·표정이 다르며, 뽑혀 빈 자리는 아무도 하지 않을 때 30초마다 위에서 떨어져 채워지고, 그때 낮은 확률로 희귀(특수효과)·매우 희귀(진짜 황금)가 나와 매장 전광판에 알려진다.

**Architecture:** 판정·채우기·변형은 서버 도메인이 정한다. 기계 속 인형 한 칸에 변형(색·체형·표정·희귀)과 고유 번호(uid)를 더하고, 기계마다 "다음에 채울 시각"을 DO 저장소에 둔다. 서버는 혼자 깨어나지 않는다. 그래서 매장이 받는 모든 메시지마다 작은 키(가장 이른 채울 시각) 하나만 읽고, 때가 됐을 때만 채운다. 화면은 그 시각을 받아 두었다가 지나면 짧은 `tick`을 보낸다. 화면은 인형 색을 꼭짓점 색으로 칠해 그리기 호출을 늘리지 않는다.

**Tech Stack:** 3단계와 같음 — Python 3.14(Pyodide) · uv · pytest · import-linter · Cloudflare Workers / Durable Objects(저장소 KV) / D1 · TypeScript · Vite · three@0.169.0 · vitest

**Spec:** `docs/superpowers/specs/2026-10-31-toycrane-machine-stock-design.md`. 바탕 설계는 `2026-10-30-toycrane-design.md`, `2026-10-31-toycrane-graphics-a-design.md`.

## 실행 준비

- 지금 작업 브랜치 `machine-lever`에는 아직 main에 합치지 않은 수정이 있다(인형 깜빡임 수정, 레버 + 하강 버튼, 설계 문서). 이 계획은 그 위에서 `git checkout -b plan4-machine-stock`으로 시작한다.
- 로컬 D1에 새 표를 만든다: Task 6의 `cd server && npx wrangler d1 migrations apply toycrane --local`. 라이브 D1에는 Task 11에서 `--remote`로 적용한다.

## Global Constraints

- 1~3단계 Global Constraints 그대로다.
  - 무료만, 유료 전환 금지.
  - 결과는 서버가 정한다.
  - 헥사고날, 슬라이스 1:1, import-linter.
  - 일본어 글자 금지(`copy.ts`·`catalog.json`의 화면 문구 모두).
  - 만화 그림체(툰 + 외곽선). 반사·빛 번짐 없음.
- **서버를 타이머·알람으로 깨워 두지 않는다.** 채우기는 메시지가 올 때만 계산한다.
- 기계 **24대**: 벽 줄 A-1~A-13 + 섬 앞쪽 줄 C-1~C-11. 캐릭터 하나에 기계 하나다. 섬 뒤쪽 줄 B는 뺀다.
- 채우기
  - 빈 자리 하나당 **30초**(아무도 그 기계를 잡고 있지 않은 시간만 센다). 기계마다 최대 **9개**.
  - 성공하면 그 자리는 비워 둔다. 바로 채우지 않는다.
- 희귀
  - 희귀(특수효과)는 새 인형마다 **3%**. 처음 채울 때도 나온다. 기계 한 대에 최대 1개.
  - 효과는 8가지를 같은 확률로 고른다: 별빛 `star`, 진주 `pearl`, 무지개 `rainbow`, 은하 `galaxy`, 벚꽃 `sakura`, 크리스탈 `crystal`, 오로라 `aurora`, 솜사탕 `cotton`.
  - 매우 희귀(황금 `gold`)는 새로 채워지는 인형마다 **0.5%**. 처음 채울 때는 없다. 기계 한 대에 최대 1개, 매장에 동시에 최대 3개. 겉모습은 진짜 금으로 만든 것처럼 보이는 금속 광택(matcap)이다.
  - 성공 확률 배율: 희귀 ×**0.5**, 황금 ×**0.3**. 줄어든 만큼은 놓침으로 간다.
- 변형
  - 색: 캐릭터마다 **6가지**(이름 있음), 같은 확률. 특수효과·황금 인형은 색 대신 효과를 입는다.
  - 체형: 보통 `n` 50% · 뚱뚱 `c` 25% · 마른 `s` 25%. 폭은 1 / 1.15 / 0.88이고 키는 같다.
  - 표정: **5가지**, 같은 확률 — 0 웃음, 1 ω 입, 2 윙크, 3 졸린 눈, 4 볼 빨개짐.
- 체형과 난이도
  - 뚱뚱: 부위 판정 반지름 ×1.25, 놓침 +0.10.
  - 마른: 반지름 ×0.8, 놓침 −0.10.
  - 확률은 0~1 사이로 자른다.
- 기존 희귀 캐릭터 4종을 그 캐릭터의 희귀판으로 옮긴다(가방 포함): 별빛 토끼 → 토끼+`star`, 진주 펭귄 → 펭귄+`pearl`, 무지개 공룡 → 공룡+`rainbow`, 황금 여우 → 여우+`gold`.
- 가방에는 캐릭터·색·희귀를 남긴다. 체형·표정은 남기지 않는다.
- 알림
  - 희귀가 채워지면 전광판에 `B-3에 별빛 곰돌이 등장!`(분홍)을 띄운다.
  - 황금이 채워지면 `★ 매우 희귀 등장! ★` / `B-3에 황금 곰돌이가 나타났어요`(금색, 더 오래)를 띄운다.
  - 희귀가 든 기계 위에는 반짝임이 뜬다(황금은 금빛으로 더 크게).
- 휴대폰 그리기 호출은 지금보다 늘지 않는다. 지금 값은 `client/e2e/perf-after.json`.

## Review Focus

1. **아무도 없던 매장에 몇 시간 만에 처음 들어온다** — 밀린 채우기를 한 번에 계산하되 기계마다 9개를 넘지 않고, 황금은 매장 3개를 넘지 않으며, 입장 화면(welcome)에 이미 채워진 상태가 보여야 한다. (Task 3 `test_refill_catches_up_after_a_long_quiet_but_never_overfills`, Task 5 `test_enter_sees_the_caught_up_stock`)
2. **한 사람이 기계를 오래 붙잡았다가 놓거나, 판 사이 자리에 앉은 채 자리를 비운다** — 풀리자마자 여러 개가 한꺼번에 쏟아지지 않고, 놓은 뒤 30초 지나 하나가 채워져야 한다. 시간이 지난 잠금(한 판 20초+여유, 판 사이 20초)은 채우기를 막지 않아야 한다. (Task 3 `test_a_held_machine_waits_a_full_slot_after_release`, Task 5 `test_a_stale_lock_does_not_block_refill`)
3. **위층을 받치던 바닥 인형을 뽑아 간다** — 위층 인형이 공중에 뜨지 않고 내려앉아야 한다. (Task 2 `test_taking_a_supporting_doll_settles_the_top`)
4. **여러 기계가 같은 순간 황금을 뽑을 수 있다** — 매장 전체 황금은 동시에 3개를 넘지 않아야 한다. (Task 3 `test_gold_never_exceeds_three_in_the_store`)
5. **옛 저장(machines_v2)과 옛 가방(희귀 캐릭터 id)이 남아 있다** — 옛 배치는 버리고 새로 채우고, 가방의 옛 희귀 4종은 그 캐릭터의 희귀판으로 옮겨져야 한다. (Task 4 `test_old_storage_is_replaced_by_fresh_stock`, Task 6 `test_bag_migration_maps_legacy_rares`)

---

## 파일 구조 (새로 생기거나 바뀌는 것)

```
shared/catalog.json                  # (수정) 24종 + 캐릭터별 palette 6색, effects 8, gold, legacy 대응표
shared/store_layout.json             # (수정) 기계 24대(kind), 섬 장애물 줄임
shared/protocol_fixtures.json        # (수정) 10칸 인형, result c/rv, spawn, stock, client_tick
server/migrations/0003_bag_variants.sql
server/src/toycrane/domain/catalog.py      # (수정) Doll(palette), EFFECTS, LEGACY
server/src/toycrane/domain/layout.py       # (수정) Machine.kind
server/src/toycrane/domain/crane.py        # (수정) DollSpot 변형·uid, 체형 폭, judge 체형·희귀 단계, settle·take_out·place_new
server/src/toycrane/domain/stock.py        # (새) new_doll, generate_stock, refill, due_in, 상한
server/src/toycrane/app/...                 # stock 슬라이스, contents 포트(MachineStock), drop·bag 변경
server/src/toycrane/adapter/...             # 저장 v3, tick·채우기 훅, spawn·stock 메시지, D1 가방
client/src/data/catalog.ts                  # (수정) palette·effects·gold·dollName
client/src/data/storeLayout.ts              # (수정) MachineSpot.kind
client/src/net/protocol.ts                  # (수정) DollSpot 10칸, Result c/rv, Spawn, Stock, encodeTick
client/src/world/copy.ts                    # (수정) 캐릭터별 간판 이름
client/src/world/dolls.ts, dollTextures.ts  # (수정) 변형·효과 8·황금 matcap·표정
client/src/world/bigZone.ts, machine.ts     # (수정) 꼭짓점 색 굽기, 체형 폭, 희귀 반짝임, 새 인형 떨어지기, 간판
client/src/world/dollPose.ts, clawShow.ts   # (수정) 체형·변형
client/src/main.ts                          # (수정) spawn 알림, stock→tick, 당첨 이름
```

---

### Task 1: 공용 데이터 — 24종 목록·색·효과, 기계 24대

**Files:**
- Modify: `shared/catalog.json`, `shared/store_layout.json`, `server/src/toycrane/domain/catalog.py`, `server/src/toycrane/domain/layout.py`, `server/src/toycrane/domain/shared_data.py`(생성), `client/src/data/catalog.ts`, `client/src/data/storeLayout.ts`, `client/src/world/copy.ts`
- Test: `server/tests/domain/test_shared_data.py`, `client/src/data/catalog.test.ts`(새), `client/src/world/copy.test.ts`

**Interfaces:**
- Produces:
  - `catalog.json`:
    - `{"sets":[…그대로], "dolls":[{"id","name","set","palette":[{"name","color":"#rrggbb"}×6]}×24], "effects":[{"id","name"}×8], "gold":{"id":"gold","name":"황금"}, "legacy":{"starbunny":["bunny","star"],"pearlpenguin":["penguin","pearl"],"rainbowdino":["dino","rainbow"],"goldfox":["fox","gold"]}}`
    - 일반 24종만 남긴다. `rare`·`base` 필드는 없앤다.
    - palette의 첫 색은 지금 `dolls.ts` LOOKS의 기본색이다.
  - `store_layout.json`:
    - 기계 24개는 `{"id","x","z","ry","kind","row"}`이고 B-* 11대는 지운다.
    - kind 배정: A-1…A-13, C-1…C-11 순서로 세트를 돌아가며(soft→forest→water→dream) 각 세트의 일반 캐릭터를 목록 순서대로 하나씩 넣는다.
    - 섬 장애물 `[-9.9,-8.4,9.9,-5.75]` → `[-9.9,-7.15,9.9,-5.75]`.
  - 서버:
    - `Doll(id, name, set, palette: tuple[str, ...])`, `DOLLS`, `EFFECTS: tuple[str, ...]`, `GOLD = "gold"`.
    - `legacy_kind(doll_id: str) -> tuple[str, str]`: (캐릭터, 희귀). 일반 id면 `(id, "")`.
    - `Machine.kind`. `Machine.set`은 지운다.
  - 화면:
    - `DollInfo { id; name; set; palette: { name: string; color: string }[] }`, `EFFECTS: { id: string; name: string }[]`, `GOLD`.
    - `dollName(kind: string, color: number, rare: string): string`
      - 일반은 `"<색 이름> <이름>"`(예: "민트 곰돌이").
      - 효과는 `"<효과 이름> <이름>"`(예: "별빛 곰돌이").
      - 황금은 `"황금 <이름>"`.
    - `MachineSpot.kind`.
  - `copy.ts`: `MACHINE_SIGNS: Record<string, string>` — 24종 간판 이름(예: bear "곰돌이 왕국"). 일본어 검사 대상에 넣는다.

- [ ] **Step 1: 실패하는 테스트**

```python
# server/tests/domain/test_shared_data.py
def test_one_kind_per_machine_and_24_machines():
    from toycrane.domain.catalog import DOLLS
    from toycrane.domain.layout import MACHINES
    assert len(MACHINES) == 24 and sorted(m.kind for m in MACHINES.values()) == sorted(DOLLS)
    assert not any(m.id.startswith("B-") for m in MACHINES.values())

def test_every_doll_has_six_named_colors_and_eight_effects_exist():
    from toycrane.domain.catalog import DOLLS, EFFECTS
    assert all(len(d.palette) == 6 for d in DOLLS.values()) and len(EFFECTS) == 8

def test_legacy_rare_ids_map_to_rare_versions():
    from toycrane.domain.catalog import legacy_kind
    assert legacy_kind("goldfox") == ("fox", "gold") and legacy_kind("starbunny") == ("bunny", "star") and legacy_kind("bear") == ("bear", "")
```

```ts
// client/src/data/catalog.test.ts
test('doll names read like a shop tag', () => {
  expect(dollName('bear', 0, '')).toBe(`${DOLLS.bear.palette[0].name} 곰돌이`);
  expect(dollName('bear', 3, 'star')).toBe('별빛 곰돌이');
  expect(dollName('bear', 3, 'gold')).toBe('황금 곰돌이');
});
// copy.test.ts: 일본어 검사 목록에 Object.values(MACHINE_SIGNS)와 catalog의 색·효과 이름을 더한다
```

- [ ] **Step 2: 실패 확인** — `cd server && uv run pytest tests/domain/test_shared_data.py -q`, `npm --prefix client test -- catalog copy` → FAIL.
- [ ] **Step 3: 구현**
  - JSON을 바꾸고 `cd server && uv run python scripts/gen_shared.py`를 돌린다.
  - 서버 catalog·layout과 화면 catalog·storeLayout·copy를 고친다.
  - 쓰는 곳은 컴파일만 되게 맞춘다(`set_kinds`·`is_rare`·`isRare`를 부르는 곳). 실제 동작은 Task 2·4·7에서 바꾼다.
  - 기존 테스트 중 "35대"·`set`을 가정한 것은 24대·`kind`로 고친다. 고친 이유를 커밋 메시지에 적는다.
- [ ] **Step 4: 통과 확인** — 서버 `uv run pytest -q`, 화면 `npm --prefix client test`가 모두 PASS(이 단계에서 깨지는 판정·채우기 테스트는 Task 2~4가 다시 쓴다. 남는 실패가 있으면 그 테스트 이름을 원장에 적고 Task 2에서 고친다).
- [ ] **Step 5: Commit** — `feat: 인형 24종 색 6가지·희귀 효과 8가지 목록과 기계 24대(캐릭터 하나에 기계 하나)`

### Task 2: 서버 도메인 — 변형 인형, 체형·희귀 판정, 빼고 다시 앉히기

**Files:**
- Create: `server/src/toycrane/domain/stock.py`
- Modify: `server/src/toycrane/domain/crane.py`
- Test: `server/tests/domain/test_crane.py`, `server/tests/domain/test_stock.py`(새)

**Interfaces:**
- Produces:
  - `crane.py`
    - `DollSpot(kind, x, z, r, y=0.0, color=0, body="n", face=0, rare="", uid=0)`. `rare`는 `""`·효과 id·`"gold"`.
    - `BODY_W = {"n": 1.0, "c": 1.15, "s": 0.88}`, `BODY_REACH = {"n": 1.0, "c": 1.25, "s": 0.8}`, `BODY_SLIP = {"n": 0.0, "c": 0.10, "s": -0.10}`, `TIER_WIN = {"rare": 0.5, "gold": 0.3}`.
    - `judge(spots, x, z, roll) -> Grab`: 인형마다 부위 반지름 × `BODY_REACH[body]`로 닿는지와 부위를 정한다. 성공 × 단계 배율, 줄어든 만큼은 놓침으로 보내고, 놓침에 `BODY_SLIP`을 더해 0~1로 자른다.
    - `rest_height(floor, x, z)`: 받치는 인형 폭 `DOLL_W × BODY_W[body]`.
    - `settle(spots) -> list[DollSpot]`: 위층 인형 높이를 남은 바닥으로 다시 잰다. 0이면 바닥 인형이 된다.
    - `take_out(spots, index) -> list[DollSpot]`: 빼고 `settle`.
    - `place_new(spots, rng) -> tuple[float, float, float]`: 바닥이 6개 미만이면 22cm 간격 빈 바닥, 아니면 두 인형 사이 틈 위층, 둘 다 없으면 간격을 줄인 빈 바닥.
    - `drop_nearby`는 `dataclasses.replace`로 변형·uid를 그대로 둔다.
  - `stock.py`
    - `RARE_CHANCE = 0.03`, `GOLD_CHANCE = 0.005`, `REFILL_SECONDS = 30.0`, `DOLLS_PER_MACHINE = 9`, `GOLD_PER_STORE = 3`.
    - `new_doll(kind, rng, x, z, y, uid, *, rare_ok: bool, gold_ok: bool) -> DollSpot`
      - 황금 0.5%(gold_ok일 때) → 희귀 3%(rare_ok일 때, 효과 8가지 균등) → 일반(색 6 균등).
      - 체형 50/25/25, 표정 5 균등, 몸 돌림 0~2π.
    - `MachineStock(dolls: list[DollSpot], next_at: float | None, next_uid: int)`
    - `generate_stock(kind, rng) -> MachineStock`: 9개, 처음 채움(희귀 가능·황금 없음·기계당 희귀 1), `next_at=None`.

- [ ] **Step 1: 실패하는 테스트**

```python
# test_crane.py (기존 판정·배치 테스트는 DollSpot 새 필드로 고친다)
def test_chubby_dolls_are_easier_to_hit_but_slip_more():
    chubby, plain = DollSpot("bear", 0, 0, 0, body="c"), DollSpot("bear", 0, 0, 0)
    assert judge([chubby], 0.06, 0, 0.99).part == "head" and judge([plain], 0.06, 0, 0.99).part == "body"
    assert judge([chubby], 0, 0, 0.15 + 0.40 + 0.05).outcome == "slip"   # 놓침 0.40 + 0.10
def test_slim_dolls_slip_through_but_hold_once_lifted():
    slim = DollSpot("bear", 0, 0, 0, body="s")
    assert judge([slim], 0.115, 0, 0.0).index is None                    # 팔 범위 0.14×0.8 밖
    assert judge([slim], 0, 0, 0.15 + 0.30 + 0.01).outcome == "miss"    # 놓침 0.40 − 0.10
def test_rare_and_gold_win_less():
    assert judge([DollSpot("bear", 0, 0, 0, rare="star")], 0, 0, 0.15 * 0.5 + 0.001).outcome == "slip"
    assert judge([DollSpot("bear", 0, 0, 0, rare="gold")], 0, 0, 0.15 * 0.3 + 0.001).outcome == "slip"
def test_taking_a_supporting_doll_settles_the_top():
    floor = [DollSpot("bear", -0.12, 0, 0), DollSpot("bear", 0.12, 0, 0)]
    top = DollSpot("bear", 0, 0, 0, y=rest_height(floor, 0, 0))
    after = take_out(floor + [top], 0)
    assert after[-1].y < top.y
# test_stock.py
def test_new_dolls_follow_the_odds():
    rng = random.Random(1); dolls = [new_doll("bear", rng, 0, 0, 0, i, rare_ok=True, gold_ok=True) for i in range(20000)]
    share = lambda f: sum(map(f, dolls)) / len(dolls)
    assert abs(share(lambda d: d.rare == "gold") - 0.005) < 0.002
    assert abs(share(lambda d: d.rare not in ("", "gold")) - 0.03) < 0.006
    assert abs(share(lambda d: d.body == "c") - 0.25) < 0.02 and {d.face for d in dolls} == set(range(5)) and {d.color for d in dolls} == set(range(6))
def test_first_fill_has_nine_dolls_no_gold_and_at_most_one_rare():
    for seed in range(200):
        s = generate_stock("bear", random.Random(seed))
        assert len(s.dolls) == 9 and s.next_at is None and not any(d.rare == "gold" for d in s.dolls)
        assert sum(d.rare != "" for d in s.dolls) <= 1 and len({d.uid for d in s.dolls}) == 9
```

- [ ] **Step 2: 실패 확인** — `cd server && uv run pytest tests/domain -q` → FAIL(새 필드·함수 없음).
- [ ] **Step 3: 구현** — 위 Interfaces대로. `restock`·`new_spot`·`generate_contents`·`set_kinds`·`is_rare`는 지운다(쓰는 곳은 Task 4에서 바뀐다).
- [ ] **Step 4: 통과 확인** — `uv run pytest tests/domain -q` PASS, `PYTHONPATH=src uv run lint-imports` 2 kept.
- [ ] **Step 5: Commit** — `feat: 인형 변형(색·체형·표정·희귀 단계)과 체형·희귀가 바꾸는 판정, 뺀 뒤 위층 내려앉기`

### Task 3: 서버 도메인 — 채우기 규칙

**Files:**
- Modify: `server/src/toycrane/domain/stock.py`
- Test: `server/tests/domain/test_stock.py`

**Interfaces:**
- Produces:
  - `on_taken(stock: MachineStock, index: int, now: float) -> MachineStock`: 그 인형을 빼고(`take_out`), `next_at`이 None이면 now + 30.
  - `refill(stock, kind, now, held: bool, gold_in_store: int, rng) -> tuple[MachineStock, list[DollSpot]]`
    - held(한 판 중이거나 판 사이 자리)이면 `next_at`이 지났을 때 now + 30으로 미루고, 채우지 않는다.
    - 아니면 `next_at <= now`이고 9개 미만인 동안 하나씩 채운다(`place_new` + `new_doll`, `next_at += 30`). 9개가 되면 `next_at = None`.
    - 상한: 기계당 희귀 1개, 기계당 황금 1개, `gold_in_store + 이번에 나온 황금 < 3`.
    - 새로 채운 인형 목록을 함께 돌려준다.
  - `due(stocks: dict[str, MachineStock]) -> float | None`: 가장 이른 `next_at`.

- [ ] **Step 1: 실패하는 테스트**

```python
def test_a_won_slot_stays_empty_then_refills_after_30s():
    s = on_taken(generate_stock("bear", random.Random(1)), 0, now=100.0)
    assert len(s.dolls) == 8 and s.next_at == 130.0
    same, added = refill(s, "bear", 129.0, False, 0, random.Random(2)); assert added == [] and len(same.dolls) == 8
    full, added = refill(s, "bear", 130.0, False, 0, random.Random(2)); assert len(added) == 1 and len(full.dolls) == 9 and full.next_at is None

def test_refill_catches_up_after_a_long_quiet_but_never_overfills():
    s = generate_stock("bear", random.Random(1))
    for i in range(5): s = on_taken(s, 0, now=100.0)
    full, added = refill(s, "bear", 100.0 + 3600, False, 0, random.Random(3))
    assert len(full.dolls) == 9 and len(added) == 5 and full.next_at is None

def test_a_held_machine_waits_a_full_slot_after_release():
    s = on_taken(generate_stock("bear", random.Random(1)), 0, now=0.0)
    held, added = refill(s, "bear", 180.0, True, 0, random.Random(4)); assert added == [] and held.next_at == 210.0
    _, added = refill(held, "bear", 200.0, False, 0, random.Random(4)); assert added == []
    _, added = refill(held, "bear", 210.0, False, 0, random.Random(4)); assert len(added) == 1

def test_gold_never_exceeds_three_in_the_store():
    golds = 0
    for seed in range(3000):
        s = on_taken(generate_stock("bear", random.Random(seed)), 0, now=0.0)
        _, added = refill(s, "bear", 30.0, False, golds, random.Random(seed))
        golds += sum(d.rare == "gold" for d in added)
    assert golds == 3

def test_at_most_one_rare_per_machine():
    rng = random.Random(9); s = generate_stock("bear", rng); t = 0.0
    for _ in range(400):
        s = on_taken(s, 0, now=t); s, _ = refill(s, "bear", t + 30, False, 99, rng); t += 30
        assert sum(d.rare not in ("", "gold") for d in s.dolls) <= 1
```

- [ ] **Step 2: 실패 확인** — FAIL(함수 없음).
- [ ] **Step 3: 구현** — 위 Interfaces대로.
- [ ] **Step 4: 통과 확인** — `uv run pytest tests/domain -q` PASS.
- [ ] **Step 5: Commit** — `feat: 빈 자리 30초마다 채우기(잠긴 시간은 세지 않음)와 희귀·황금 상한`

### Task 4: 서버 앱·어댑터 — 저장 v3, 성공하면 비워 두기, 메시지 형식

**Files:**
- Modify:
  - `server/src/toycrane/app/ports/output/machine_contents_port.py`, `server/src/toycrane/adapter/outbound/do_storage_machine_contents.py`
  - `server/src/toycrane/app/use_cases/machine_contents.py`, `server/src/toycrane/app/use_cases/drop_interactor.py`, `server/src/toycrane/app/dtos/drop_dto.py`
  - `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`, `shared/protocol_fixtures.json`
  - 입장 스냅샷을 쓰는 곳(`enter_interactor`, `store_snapshot` DTO)
- Test: `server/tests/app/use_cases/test_drop_interactor.py`, `server/tests/adapter/test_server_messages.py`, `server/tests/adapter/test_attachment_state.py`, `server/tests/fakes.py`

**Interfaces:**
- Consumes: Task 2·3의 `MachineStock`, `on_taken`, `generate_stock`.
- Produces:
  - `MachineContentsPort`
    - `load() -> dict[str, MachineStock]`, `save(stocks: dict[str, MachineStock]) -> None`.
    - `save`는 `due(stocks)`도 작은 키에 같이 저장한다.
    - `due_at() -> float | None`: 그 작은 키만 읽는다.
  - DO 저장소 어댑터 `DoStorageMachineContents(storage, store_key: str)`
    - `due_at()`는 모듈 수준 dict(키: `store_key`)에 기억해 두고, `save`가 함께 고친다. 이 DO만 자기 저장소에 쓰므로 어긋나지 않는다. 잠들었다 깨서 비어 있으면 한 번 읽는다. 걷기 메시지마다 저장소 행 읽기가 하나씩 늘지 않게 하려는 것이다(무료 한도: 하루 행 읽기 500만).
    - provider들(`drop_provider`, `enter_provider`, Task 5의 `stock_provider`)은 `DoStorageMachineContents(ctx.storage, str(ctx.id))`로 만든다.
    - 키 `machines_v3`는 `{m: {"d": [[kind,x,z,r,y,color,body,face,rare,uid]…], "n": next_at|null, "u": next_uid}}`, 작은 키 `stock_due`.
    - 옛 `machines_v2`는 읽지 않는다.
  - `ensure_contents(port, rng) -> dict[str, MachineStock]`: 없는 기계를 `generate_stock(MACHINES[m].kind, rng)`로 채운다.
  - `DropInteractor` 성공 처리
    - `on_taken(stock, index, now)` → 저장, 가방 add(Task 6), result, machine 메시지.
    - `ResultView`에 `color: int | None`, `rare: str | None`을 더한다.
  - 메시지
    - `_spots`는 10칸 `[kind,x,z,r,y,color,body,face,rare,uid]`.
    - result에 `"c"`(색), `"rv"`(희귀)를 더한다.
    - 견본(`server_machine`, `server_result`, `server_welcome`의 인형)을 10칸으로 바꾼다.

- [ ] **Step 1: 실패하는 테스트**

```python
async def test_a_win_leaves_the_slot_empty_and_starts_the_refill_clock():
    ...  # setup: 가짜 저장에 9개, 한 판 잠금
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))           # 성공 굴림
    stock = contents.stored["A-1"]
    assert len(stock.dolls) == 8 and stock.next_at == 45.0 and contents.due == 45.0
    machine = next(m for _, m in conns.broadcasts if m["t"] == "machine"); assert len(machine["dolls"]) == 8
    result = next(m for _, m in conns.broadcasts if m["t"] == "result"); assert {"c", "rv"} <= result.keys()

async def test_old_storage_is_replaced_by_fresh_stock():
    storage = FakeStorage({"machines_v2": '{"A-1": [["bunny",0,0,0,0]]}'})
    stocks = await ensure_contents(DoStorageMachineContents(storage, "s-old"), random.Random(1))
    assert len(stocks) == 24 and all(len(s.dolls) == 9 for s in stocks.values())

async def test_due_time_is_read_from_storage_once():
    storage = FakeStorage({})
    await DoStorageMachineContents(storage, "s-1").save(stocks_with_empty("A-1", next_at=30.0))
    storage.gets = 0
    assert [await DoStorageMachineContents(storage, "s-1").due_at() for _ in range(3)] == [30.0] * 3 and storage.gets == 0

def test_machine_message_carries_variants():
    msg = machine("A-1", [DollSpot("bear", 0.1, 0.2, 1.0, 0.0, 3, "c", 2, "star", 7)])
    assert msg["dolls"] == [["bear", 0.1, 0.2, 1.0, 0.0, 3, "c", 2, "star", 7]]
```

- [ ] **Step 2: 실패 확인** — `uv run pytest -q` → 새 테스트 FAIL.
- [ ] **Step 3: 구현** — 위 Interfaces대로. 테스트 도우미(`server/tests/fakes.py`):
  - `FakeContents(stocks, due=None)`: `stored`, `due`, `loads`, `saves` 세기와 `due_at()`.
  - `FakeStorage(initial: dict)`: 비동기 `get`/`put`, `gets` 세기. `to_py`가 그대로 통과하는 값을 돌려준다(`adapter/test_attachment_state.py`의 가짜 ctx 방식).
  - `stocks_with_empty(machine_id, next_at) -> dict[str, MachineStock]`: 24대를 `generate_stock(kind, Random(0))`로 채우고, `machine_id`만 인형 8개·`next_at`.
- [ ] **Step 4: 통과 확인** — `uv run pytest -q`, `PYTHONPATH=src uv run lint-imports` PASS.
- [ ] **Step 5: Commit** — `feat: 기계 속 인형 저장 v3(변형·uid·다음 채울 시각), 성공한 자리는 비워 둠`

### Task 5: 서버 — 채우기 슬라이스(stock)와 tick, 희귀 등장 알림

**Files:**
- Create:
  - `server/src/toycrane/app/dtos/stock_dto.py`, `server/src/toycrane/app/ports/input/stock_use_case.py`, `server/src/toycrane/app/use_cases/stock_interactor.py`
  - `server/src/toycrane/dependencies/stock_provider.py`, `server/src/toycrane/adapter/inbound/ws/tick_handler.py`
- Modify:
  - `server/src/toycrane/adapter/inbound/ws/ws_router.py`, `server/src/toycrane/adapter/inbound/ws/enter_handler.py`
  - `server/src/toycrane/app/ports/output/connections_port.py`, `server/src/toycrane/adapter/outbound/ws_connections_adapter.py`
  - `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`, `shared/protocol_fixtures.json`
- Test: `server/tests/app/use_cases/test_stock_interactor.py`(새), `server/tests/adapter/test_ws_router.py`, `server/tests/app/use_cases/test_enter_interactor.py`

**Interfaces:**
- Consumes: `refill`, `due`(Task 3), `MachineContentsPort.due_at/load/save`(Task 4), `PlayLockPort.holder`.
- Produces:
  - `StockCommand(now: float)`, `StockUseCase.refill(cmd) -> None`.
  - `StockInteractor(contents, locks, connections, rng)`
    - `due_at()`가 None이거나 now보다 뒤면 아무것도 읽지 않고 끝난다.
    - 아니면 load → 기계마다 `refill(stock, MACHINES[m].kind, now, held=lock_active(locks, m, now), gold_in_store, rng)` → 바뀐 게 있으면 한 번 save.
    - `lock_active(locks, machine_id, now) -> bool`(`app/use_cases/stock_interactor.py` 안): `holder`가 있고, 판 사이면 `not hold_over(since, now)`, 한 판 중이면 `not expired(since, now)`. 잠금은 다음 메시지가 올 때에야 풀리므로, 시간이 지난 잠금을 붙잡힌 것으로 보면 그 기계가 영영 안 채워진다.
    - 바뀐 기계마다 `broadcast_machine`.
    - 새로 채운 인형 중 희귀·황금마다 `broadcast_spawn(machine_id, kind, rare)`.
    - 마지막에 `broadcast_stock(due - now 또는 None)`.
  - 메시지
    - `spawn(machine_id, kind, rare) -> {"t":"spawn","m","k","rv"}`
    - `stock(due_in: float | None) -> {"t":"stock","in": 초 | null}`(소수 1자리)
    - 화면 메시지 `{"t":"tick"}`
  - `ConnectionsPort.broadcast_spawn(machine_id, kind, rare)`, `broadcast_stock(due_in)`.
  - `ws_router.dispatch`
    - 메시지를 해석한 뒤, 핸들러보다 먼저 `get_stock_use_case(ctx, env).refill(StockCommand(time.time()))`를 부른다(모든 메시지).
    - `HANDLERS["tick"] = tick_handler.handle`(아무것도 안 한다 — 채우기는 위에서 이미 돌았다).
  - `enter_handler`: 입장 처리 전에 채우기를 돌려 welcome에 밀린 채우기가 보이게 한다. 입장한 사람에게 `stock`도 보낸다.

- [ ] **Step 1: 실패하는 테스트**

```python
async def test_due_refill_fills_saves_once_and_tells_everyone():
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    await StockInteractor(contents, FakeLocks(), conns, Rolls(0.5)).refill(StockCommand(now=31.0))
    kinds = [m["t"] for _, m in conns.broadcasts]
    assert contents.saves == 1 and "machine" in kinds and kinds[-1] == "stock"

async def test_nothing_is_read_before_the_due_time():
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    await StockInteractor(contents, FakeLocks(), conns, Rolls(0.5)).refill(StockCommand(now=10.0))
    assert contents.loads == 0 and conns.broadcasts == []

async def test_a_gold_refill_is_announced():
    ...  # Rolls(0.001) → 황금
    assert ("spawn", "gold") in [(m["t"], m.get("rv")) for _, m in conns.broadcasts]

async def test_a_locked_machine_is_not_refilled():
    locks = FakeLocks(); locks.lock("c-1", "A-1", 0.0)
    ...  # A-1은 그대로, next_at이 now+30으로 밀림

async def test_a_stale_lock_does_not_block_refill():
    locks = FakeLocks(); locks.hold("c-1", "A-1", 0.0)            # 판 사이 자리, 20초 지나면 끝
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    await StockInteractor(contents, locks, conns, Rolls(0.5)).refill(StockCommand(now=31.0))
    assert len(contents.stored["A-1"].dolls) == 9

def test_tick_message_has_a_handler():
    from toycrane.adapter.inbound.ws.ws_router import HANDLERS
    assert "tick" in HANDLERS

async def test_enter_sees_the_caught_up_stock():
    ...  # 오래 비어 있던 매장: refill 뒤 enter → welcome의 그 기계 인형 9개
```

- [ ] **Step 2: 실패 확인** — FAIL(슬라이스 없음).
- [ ] **Step 3: 구현** — 슬라이스 1:1(dto·port·interactor·provider·handler·test). 라우터 훅은 adapter 계층에만 둔다.
- [ ] **Step 4: 통과 확인** — `uv run pytest -q`, `PYTHONPATH=src uv run lint-imports` PASS.
- [ ] **Step 5: Commit** — `feat: 메시지가 올 때 때가 된 기계만 채우기, tick, 희귀·황금 등장 알림`

### Task 6: 가방에 색·희귀 남기기 (D1)

**Files:**
- Create: `server/migrations/0003_bag_variants.sql`
- Modify: `server/src/toycrane/app/ports/output/bag_port.py`, `server/src/toycrane/adapter/outbound/d1_bag_adapter.py`, `server/src/toycrane/app/use_cases/drop_interactor.py`, `server/tests/fakes.py`
- Test: `server/tests/app/use_cases/test_drop_interactor.py`, `server/tests/adapter/test_bag_migration.py`(새)

**Interfaces:**
- Produces:
  - 표 `bag(guest_id, doll, color, rare, zone, count, first_at)`, PRIMARY KEY `(guest_id, doll, color, rare, zone)`.
  - 옮기기: 옛 행은 `color 0`, `rare ''`로 옮긴다. 단 legacy 4종은 (캐릭터, 희귀)로 바꾼다. 같은 키로 겹치면 count를 더한다.
  - `BagPort.add(guest_id, doll, color, rare, zone, now) -> int`(총 개수).

- [ ] **Step 1: 실패하는 테스트**

```python
def test_bag_migration_maps_legacy_rares():
    # 파이썬 sqlite3 메모리 DB에 0002 → 옛 행(goldfox 1, bear 2) → 0003 적용
    rows = db.execute("SELECT doll, color, rare, count FROM bag ORDER BY doll").fetchall()
    assert rows == [("bear", 0, "", 2), ("fox", 0, "gold", 1)]

async def test_a_win_bags_the_color_and_rare():
    ...  # 성공 → bag.added == [("g-1", "bear", 3, "star", "big")]
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현**
  - 마이그레이션 SQL: 새 표 → INSERT … SELECT(CASE로 legacy 4종, GROUP BY로 합치기) → 옛 표 DROP → 이름 바꾸기.
  - 어댑터 SQL을 바꾸고, drop이 색·희귀를 넘기게 한다.
  - 로컬에 적용한다: `cd server && npx wrangler d1 migrations apply toycrane --local`.
- [ ] **Step 4: 통과 확인** — `uv run pytest -q` PASS. 로컬 적용 출력에 `0003_bag_variants.sql ✅`.
- [ ] **Step 5: Commit** — `feat: 가방에 색·희귀를 남기고 옛 희귀 캐릭터 4종을 희귀판으로 옮김`

### Task 7: 화면 — 메시지와 목록

**Files:**
- Modify: `client/src/net/protocol.ts`, `client/src/net/protocol.test.ts`, `client/src/net/storeSocket.ts`, `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`, `shared/protocol_fixtures.json`, `client/src/main.ts`(DOLLS·isRare 쓰는 곳만 컴파일되게)
- Test: `client/src/net/protocol.test.ts`

**Interfaces:**
- Produces:
  - `DollSpot = [kind: string, x, z, r, y: number, color: number, body: 'n' | 'c' | 's', face: number, rare: string, uid: number]`.
  - `isSpot`은 10칸만 받는다.
  - `Result`에 `c?: number | null; rv?: string | null`을 더한다.
  - 새 메시지 `Spawn { t: 'spawn'; m; k; rv }`, `Stock { t: 'stock'; in: number | null }`.
  - `encodeTick()`.
  - 프로토콜 버전: 서버 welcome에 `"v": 2`를 더한다(`server_messages.welcome`, 견본 포함). 화면은 `PROTOCOL = 2`를 두고, `storeSocket`이 해석 전에 `t === 'welcome'`인데 `v`가 다르면 한 번만(sessionStorage 표시) `location.reload()`한다. 이번 배포 때 열려 있던 옛 화면은 이 검사가 없어 사람이 새로고침해야 한다 — 다음 형식 변경부터 저절로 새로고침된다.
  - `lookOf(spot: DollSpot): DollLook`(`{ color, body, face, rare }`) — `world/dolls.ts`의 `DollLook` 타입을 쓴다(Task 8에서 정의). 이 태스크에서는 `protocol.ts`에 타입을 먼저 두고 Task 8이 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트** — 견본으로 확인한다.
  - `decode(fx.server_machine)`의 인형이 10칸이다.
  - `decode(fx.server_spawn)`, `decode(fx.server_stock)`가 통과한다.
  - `encodeTick()`이 `fx.client_tick`과 같다.
  - `needsReload('{"t":"welcome","v":1}')`이 true, `v: 2`이면 false, welcome이 아니면 false(`storeSocket.ts`가 쓰는 순수 함수, `protocol.ts`에 둔다).
  - 옛 5칸 인형은 `decode`가 null이다.
- [ ] **Step 2: 실패 확인** — `npm --prefix client test -- protocol` FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS, `tsc --noEmit` OK.
- [ ] **Step 5: Commit** — `feat: 화면 메시지 — 변형 인형 10칸, spawn·stock·tick`

### Task 8: 화면 — 변형 인형 모델 (색·체형·표정·효과 8·진짜 황금)

**Files:**
- Modify: `client/src/world/dolls.ts`, `client/src/world/dollTextures.ts`, `client/src/world/dolls.test.ts`

**Interfaces:**
- Consumes: `DOLLS[kind].palette`, `EFFECTS`(Task 1).
- Produces:
  - `DollLook = { color: number; body: 'n' | 'c' | 's'; face: number; rare: string }`, `PLAIN: DollLook`(0, 'n', 0, '').
  - `makeDoll(kind, look: DollLook = PLAIN, lite = false): THREE.Group | null`
    - 몸 색 = palette[color](효과·황금이면 그 재질).
    - 표정 face 0~4: 눈·입·볼 부품을 바꾼다.
    - 희귀·황금이면 왕관(황금은 크게), lite가 아니면 효과별 반짝이(userData.spin).
    - 체형은 여기서 바꾸지 않는다(놓는 쪽이 x·z 크기에 `BODY_W`를 곱한다).
  - `BODY_W`(서버와 같은 값)를 낸다.
  - `effectMaterial(effect)`(8가지, 툰 + 그림), `goldMaterial()`(금속 matcap 그림, `THREE.MeshMatcapMaterial`).
  - `dollHits(kind, body = 'n')`: 공의 x·z와 반지름에 `BODY_W[body]`를 곱한다.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('each palette color paints the body', () => {
  const tint = (c: number) => bodyColorOf(makeDoll('bear', { ...PLAIN, color: c })!);  // 몸통 메시 재질 색
  expect(tint(0)).not.toBe(tint(3));
  expect(tint(3)).toBe(new THREE.Color(DOLLS.bear.palette[3].color).getHex());
});
test('gold dolls are made of shiny metal and wear a big crown', () => {
  const g = makeDoll('bear', { ...PLAIN, rare: 'gold' })!;
  expect(meshesWith(g, (m) => m instanceof THREE.MeshMatcapMaterial).length).toBeGreaterThan(3);
  expect(g.getObjectByName('crown')!.scale.x).toBeGreaterThan(1.2);
});
test('all eight effects build and differ', () => {
  const mats = EFFECTS.map((e) => bodyMaterialOf(makeDoll('cat', { ...PLAIN, rare: e.id })!));
  expect(new Set(mats).size).toBe(8);
});
test('faces change the face parts', () => {
  const sig = (f: number) => facePartsSignature(makeDoll('bear', { ...PLAIN, face: f })!);   // 얼굴 부품 이름·크기 목록
  expect(new Set([0, 1, 2, 3, 4].map(sig)).size).toBe(5);
});
test('chubby hit spheres are wider', () => {
  expect(dollHits('bear', 'c').solid[1].r).toBeGreaterThan(dollHits('bear').solid[1].r);
});
```

(`bodyColorOf`·`bodyMaterialOf`·`meshesWith`·`facePartsSignature`는 테스트 파일 안 도우미. 몸통 메시는 `name = 'body'`로 표시한다.)

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현**
  - 기존 희귀 그림(별빛·진주·무지개)을 효과로 옮긴다.
  - 은하·벚꽃·크리스탈·오로라·솜사탕 그림을 캔버스로 새로 만든다.
  - 황금 matcap은 캔버스로 그린 금색 구 그림이다.
  - 표정 5가지 그림.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS.
- [ ] **Step 5: Commit** — `feat: 인형 변형 모델 — 색 6·표정 5·특수효과 8·진짜 황금`

### Task 9: 화면 — 기계 속 무더기(꼭짓점 색 굽기·체형 폭), 간판, 희귀 반짝임, 새 인형 떨어지기

**Files:**
- Modify: `client/src/world/bigZone.ts`, `client/src/world/bigZone.test.ts`, `client/src/world/machine.ts`, `client/src/world/dollPose.ts`, `client/src/world/dollPose.test.ts`

**Interfaces:**
- Consumes: `makeDoll(kind, look, true)`, `BODY_W`, `dollHits(kind, body)`(Task 8), `lookOf`(Task 7), `MACHINE_SIGNS`, `MachineSpot.kind`(Task 1).
- Produces:
  - 굽기
    - 인형 lite 부품 중 그림 없는 툰 재질은 꼭짓점 색으로 바꿔 공용 재질 `DOLL_VC`(툰, vertexColors) 하나로 굽는다.
    - 그림 있는 재질(효과·황금·다람쥐 등)만 따로 묶는다.
    - 캐시 키는 `kind|color|face|rare`.
  - 놓기: 체형 폭 `DOLL_SCALE × BODY_W[body]`(x·z).
  - `dollPose(spot)`는 그대로(키가 같으므로). `solidsOf(spots)`는 `dollHits(kind, body)`를 쓴다.
  - `BigZone.setContents(id, dolls)`
    - 처음이 아니면 이전에 없던 uid의 인형을 무더기에서 빼 두고, 위 0.6m에서 0.6초 동안 떨어져 한 번 튀게 따로 그린 뒤 무더기에 넣는다.
    - 그동안 그 인형은 정확히 한 번만 보인다.
  - 희귀 반짝임
    - 행마다 `rare-sparkles` 한 덩어리로, 희귀가 든 기계 간판 위에 작은 별 4개(황금은 금빛 6개, 1.5배)가 돈다.
    - `update(t)`에서 돌린다.
  - 간판 이름은 `MACHINE_SIGNS[spot.kind]`.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('six machines of different colors still bake into few materials', () => {
  const scene = new THREE.Scene(); const zone = buildBigZone(scene);
  for (const [k, m] of MACHINES.slice(0, 6).entries()) zone.setContents(m.id, nineDolls(m.kind, k % 6));
  zone.update(0);
  expect(materialsIn(scene, 'dolls-big-wall-0')).toBeLessThanOrEqual(6);
});
test('a doll that appears in a refill falls in and is drawn exactly once', () => {
  ...  // setContents(9개) → update → setContents(8개 + 새 uid 1개) → 매 프레임 update: 무더기 + 따로 그린 인형 합해 그 uid가 정확히 1, 0.7초 뒤 무더기에만 있음
});
test('machines holding a rare show sparkles above them', () => {
  ...  // 희귀 하나가 든 기계 → rare-sparkles의 인스턴스 수 > 0, 희귀를 빼면 0
});
test('chubby dolls are drawn wider', () => {
  ...  // 같은 자리 보통/뚱뚱 인형의 묶음 상자 폭 비교
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS.
- [ ] **Step 5: Commit** — `feat: 기계 속 변형 인형 굽기(그리기 호출 그대로)·체형 폭·캐릭터 간판·희귀 반짝임·새 인형 떨어지기`

### Task 10: 화면 — 집게 연출·알림·tick·당첨 이름

**Files:**
- Modify: `client/src/world/clawShow.ts`, `client/src/world/clawShow.test.ts`, `client/src/world/plush.ts`, `client/src/main.ts`, `client/src/ui/winCard.ts`
- Test: `client/src/ui/winCard.test.ts`(새)

**Interfaces:**
- Consumes: `lookOf`, `Spawn`, `Stock`, `encodeTick`(Task 7), `makeDoll(kind, look)`, `BODY_W`(Task 8), `dollName`(Task 1).
- Produces:
  - `clawShow`
    - 꺼내고 들고 떨어뜨리는 인형을 `makeDoll(kind, lookOf(spot))`로 만든다.
    - 크기는 (DOLL_SCALE·w, DOLL_SCALE, DOLL_SCALE·w).
    - `squeezeAboutTop`의 rest에 `width`를 더해 눌림이 체형 폭을 지킨다.
  - `main`
    - `spawn` → 전광판을 띄운다.
      - 희귀: `showMessage('희귀 등장!', '<기계>에 <dollName> 등장!', false, 5)`
      - 황금: `showMessage('★ 매우 희귀 등장! ★', '<기계>에 <dollName>이(가) 나타났어요', true, 8)`
    - 그리고 `bigZone.flash(m, rare === 'gold', 3)`.
    - `stock` → 이전 tick 타이머를 지우고, `in`초 + 0~1.5초 흔들림 뒤 `encodeTick()`을 보낸다(null이면 안 보냄).
    - 당첨 카드와 희귀 뽑기 전광판에 `dollName(k, c, rv)`를 쓰고, 희귀 여부는 `rv`로 정한다.
  - `showWinCard(name, setName, tier: '' | 'rare' | 'gold', bag)`(`ui/winCard.ts`)
    - 머리말: 일반 `짠!`, 희귀 `★ 희귀!`, 황금 `★★ 매우 희귀!`.
    - 이름 앞: 희귀 `★ `, 황금 `★★ `(예: "★★ 황금 곰돌이").
    - 황금은 지금 희귀 카드의 금빛 배경을 더 진하게, 희귀는 분홍 빛으로.

- [ ] **Step 1: 실패하는 테스트**
  - `clawShow.test.ts`: 뚱뚱 인형을 성공시킨다. 연출 내내 따로 그린 그 인형의 x 크기가 y 크기의 1.15배다(눌림 4% 범위 안).
  - 기존 '정확히 한 번' 테스트 3개는 10칸 인형으로 그대로 통과해야 한다.
  - `winCard.test.ts`: `showWinCard('황금 곰돌이', '포근 세트', 'gold', 3)` 뒤 문서 안 글자에 `★★ 매우 희귀!`와 `★★ 황금 곰돌이`가 있다. `''`이면 `★`가 없다.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npm --prefix client test`, `tsc --noEmit` PASS.
- [ ] **Step 5: Commit** — `feat: 변형 인형 집게 연출, 희귀·황금 등장 전광판, 채울 때 tick, 당첨 이름`

### Task 11: 확인·배포

- [ ] **Step 1: 성능** — 로컬 빌드 후 `node client/e2e/perf.mjs http://localhost:8787 client/e2e/perf-stock.json`.
  Expected: 네 값 모두 `perf-after.json` 이하이거나 같다(±5%).
- [ ] **Step 2: e2e**
  - `mobile-entry`, `mobile-joystick`이 통과한다.
  - 레버 한 판(scratch `lever.mjs` 흐름)이 통과한다.
  - 채우기 확인: 한 판을 성공시키고(관찰자로 결과를 받을 때까지 반복) 아무도 그 기계를 안 한 채 35초 기다린다. 그 사이 화면은 가만히 둔다. 그러면 `stock` → `tick` → `machine`(인형 9개) 순서로 와야 하고, 새 인형이 떨어지는 프레임을 캡처한다.
- [ ] **Step 3: 화면 프레임** — 다음을 PC 스크린샷으로 본다.
  - 기계마다 한 캐릭터, 여러 색, 체형·표정이 섞인 모습.
  - 희귀 반짝임.
  - 화면에 `spawn` 황금 메시지를 넣었을 때의 전광판.
  - 황금 인형 금속 광택(기계 하나에 화면 쪽에서만 황금 인형을 넣어 확인).
- [ ] **Step 4: 배포**
  1. `npm --prefix client test`
  2. `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`
  3. `cd server && npx wrangler d1 migrations apply toycrane --remote` — 라이브 D1 표 변경. 적용 전에 `--remote`로 옛 bag 행 수를 세어 두고, 적용 뒤 총 개수가 같은지 확인한다.
  4. `npm --prefix client run build && (cd server && CI=1 uv run pywrangler deploy)`
  5. 라이브 한 판.
- [ ] **Step 5: README 확인 기록과 사람 확인** — 기계 24대, 채우기, 희귀·황금 알림, 레버 조작을 PC와 휴대폰으로 확인한다. 측정값을 README에 적고 커밋한다.
