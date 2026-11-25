# 가방 인형 크게 보기와 NEW 표시 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 가방 칸을 누르면 인형을 크게 360도 돌려 보고, 처음 생긴 칸은 당첨 카드와 가방에 NEW가 붙는다.

**구조:** 서버 가방 넣기가 '새 칸인가'를 돌려주고, 뽑은 손님에게 가는 `bag` 메시지에 새 칸 목록을 싣는다. 화면은 당첨 카드에 NEW를 붙이고, 가방은 이 기기에 둔 '마지막으로 연 때'와 칸의 `first_at`을 견준다. 크게 보기는 카드 안 작은 캔버스에 따로 그리고 닫을 때 버린다.

**기술:** Python Workers + D1(서버, pytest), TypeScript + three.js(화면, vitest).

**설계:** `docs/superpowers/specs/2026-11-24-toycrane-bag-viewer-new-design.md`

## 지켜야 할 것

- 화면 글에 가운데 점(·) 금지. 카툰 UI(남색 테두리, 납작 그림자, Jua 글꼴).
- 실패하는 시험은 넘기지 않는다. 마지막에 서버, 화면, 타입, 빌드. 시뮬은 물리를 안 건드리므로 생략하고 그 사실을 적는다.
- 브라우저 시험 뒤 탭을 닫는다. 배포는 하지 않는다.
- 메시지 형식 버전은 올리지 않는다(`bag`에 선택 필드만).

## 리뷰 때 볼 것

1. 한 판에 같은 칸 인형 둘이 빠짐 → 첫 번째만 새 칸, 둘째는 아님. 카드에는 그 칸 이름 하나에 NEW(작업 1 시험).
2. 가방을 처음 여는 손님 → NEW 없음, 열고 나면 기준 시각 저장(작업 3 시험).
3. 크게 보기를 열었다 닫기를 여러 번 → WebGL 렌더러를 매번 버린다(작업 4 시험: dispose 호출).
4. 크게 보기 열린 채 가방 바깥을 누름 → 크게 보기만 닫히고 가방은 남는다(작업 4).

---

### Task 1: 서버 — 가방 넣기가 새 칸을 알려 주고 `bag` 메시지에 싣기

**파일:** `server/src/toycrane/app/ports/output/bag_port.py`, `adapter/outbound/d1_bag_adapter.py`, `app/use_cases/done_interactor.py`, `app/use_cases/figure_done_interactor.py`, `app/ports/output/connections_port.py`, `adapter/outbound/ws_connections_adapter.py`, `adapter/inbound/ws/schemas/server_messages.py`, `tests/fakes.py`, `shared/protocol_fixtures.json`, 시험들

**인터페이스:**
- `BagPort.add(...) -> tuple[int, bool]`: (새 합계, 이번에 그 칸이 처음 생겼나). D1은 `... DO UPDATE SET count = count + 1 RETURNING count`의 count가 1이면 새 칸.
- `ConnectionsPort.send_bag(conn_id, total, new: list[tuple[str, int, str]] | None = None)` → `{"t":"bag","n":total}`(new가 비면 그대로), 있으면 `"new": [[캐릭터, 색, 희귀], ...]`.
- 판 보고 두 곳은 넣으며 새 칸을 모아 `send_bag`에 넘긴다.

- [ ] 실패하는 시험: `test_bag_add_says_when_a_cell_is_new`(fake·D1 SQL 시험 방식), `test_done_sends_new_cells_with_the_bag`(같은 칸 둘이면 하나만), `test_bag_message_with_new_matches_fixture`(`server_bag_new`).
- [ ] 구현, 서버 시험 전체 통과, 커밋 `가방: 처음 생긴 칸을 bag 메시지에`.

### Task 2: 화면 — 당첨 카드 NEW

**파일:** `client/src/net/protocol.ts`(+시험), `client/src/ui/winCard.ts`(+시험), `client/src/main.ts`

**인터페이스:**
- `Bag = { t: 'bag'; n: number; new?: [string, number, string][] }`(decode가 new를 확인).
- `winCardText(names, tier, fresh: boolean[] = [])` → 반환에 `freshTitle: boolean`, `more`는 `{ text, fresh }[]`.
- `showWinCard(names, setName, tier, bag, fresh)`: NEW인 이름 옆에 분홍 딱지 'NEW'.
- `main.ts`: `bag` 메시지의 new를 `freshKeys`(Set `kind|color|rare`)에 넣고, 바로 뒤 결과 카드가 이름마다 `freshKeys.has`로 fresh를 만든 뒤 비운다.
- [ ] 실패하는 시험: protocol(`server_bag_new` 해석, new 모양이 틀리면 null), winCard(`fresh`가 제목과 아래 줄에 붙음).
- [ ] 구현, 타입·화면 시험, 커밋 `당첨 카드: 처음 뽑은 인형에 NEW`.

### Task 3: 화면 — 가방 NEW

**파일:** `client/src/ui/bagSheet.ts`(+시험), `client/src/main.ts`

**인터페이스:**
- `bagGroups(items, seenAt: number | null = null)`: 칸에 `fresh: boolean`(= seenAt이 있고 firstAt > seenAt).
- `lastFirstAt(items): number | null`.
- `main.showBag`: 이 기기 `toycrane.bagSeen.<guestId>`를 읽어 넘기고, 연 뒤 `lastFirstAt`로 저장.
- 칸에 NEW 딱지(그림 왼쪽 위, 희귀 별은 오른쪽 위 그대로).
- [ ] 실패하는 시험: 처음(seenAt null) → NEW 없음, seenAt보다 늦은 칸만 NEW, `lastFirstAt`.
- [ ] 구현, 커밋 `가방: 마지막으로 연 뒤 생긴 칸에 NEW`.

### Task 4: 화면 — 인형 크게 보기(360도)

**파일:** 만들기 `client/src/ui/dollViewer.ts`(+`dollViewer.test.ts`), 고치기 `client/src/ui/bagSheet.ts`(칸 누르면 열기), `client/src/world/copy.ts`(`UI.firstGot(날짜)`)

**인터페이스:**
- 순수 로직 `class ViewerSpin { yaw; pitch; zoom; drag(dx, dy); pinch(scale); wheel(dy); tick(dt) }` — 좌우 끌기는 360도 넘게 계속 돎, 위아래는 ±20°로 자름, 확대 1~2배로 자름, 손대기 전엔 tick마다 천천히 돎, 손댄 뒤엔 저절로 돌지 않음.
- `openDollViewer(cell: BagCell): void`, `closeDollViewer(): void` — 가방 위에 카드(이름, 희귀 표시, ×개수, 처음 뽑은 날, 닫기). 캔버스에 `WebGLRenderer`(픽셀 비율 최대 2), `makeDoll(kind, { ...PLAIN, color, rare })`(작은 그림과 같은 모습, lite 아님), 희귀 장식 회전(`userData.spin`). 닫을 때 렌더러 `dispose` + `forceContextLoss`, 그 장면에서 만든 재질과 형상 정리. 바깥 누르기는 크게 보기만 닫는다.
- WebGL이 없으면(노드 시험) 그림 대신 큰 작은 그림을 보인다.
- [ ] 실패하는 시험: `ViewerSpin` 규칙(위 다섯 가지), 열고 닫으면 렌더러를 버림(렌더러 만들기를 주입해 확인).
- [ ] 구현, 커밋 `가방: 인형을 눌러 크게 360도로 보기`.

### Task 5: 전체 확인

- [ ] 서버 `uv run pytest -q`, 계층 계약, 화면 `npx tsc --noEmit && npx vitest run src && npm run build`.
- [ ] 로컬 e2e(`client/e2e/bag.mjs` 흐름 기반): 처음 뽑은 판의 당첨 카드 NEW, 가방 NEW(두 번째 열기 전 새로 뽑은 칸), 칸을 눌러 크게 보기, 끌어서 돌린 모습, PC와 휴대폰 스크린샷. 끝나면 탭 닫기.
- [ ] `docs/DEPLOY_LOG.md`에 '가방 크게 보기와 NEW(배포 대기)' 덧붙이고 커밋.
