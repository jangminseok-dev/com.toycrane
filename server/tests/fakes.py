"""인터랙터 테스트용 가짜 포트. 태스크가 늘 때마다 여기에 추가한다."""

from toycrane.adapter.inbound.ws.schemas import server_messages
from toycrane.app.dtos.guest_dto import GuestView
from toycrane.app.dtos.queue_dto import QueueMember
from toycrane.domain.entities.player import Player
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position


class FakeRecordPort:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def record(self, subject: str, note: str) -> None:
        self.calls.append((subject, note))


class FakeGuestRepository:
    def __init__(self) -> None:
        self.rows: dict[str, tuple[GuestView, float]] = {}
        self.touched: list[tuple[str, float]] = []

    async def insert(self, view: GuestView, now: float) -> None:
        self.rows[view.guest_id] = (view, now)

    async def get(self, guest_id: str) -> GuestView | None:
        row = self.rows.get(guest_id)
        return row[0] if row else None

    async def touch(self, guest_id: str, now: float) -> None:
        self.touched.append((guest_id, now))


class FakeOccupancy:
    def __init__(self, counts_value: dict[int, int] | None = None, at: float = 0.0) -> None:
        self.rows: dict[int, tuple[int, float]] = {n: (c, at) for n, c in (counts_value or {}).items()}
        self.writes: list[tuple[int, int, float]] = []

    async def counts(self, fresh_since: float) -> dict[int, int]:
        return {n: c for n, (c, at) in self.rows.items() if at >= fresh_since}

    async def write(self, store_no: int, count: int, now: float) -> None:
        self.writes.append((store_no, count, now))
        self.rows[store_no] = (count, now)


class BrokenOccupancy(FakeOccupancy):
    """D1 쓰기가 실패하는 경우(한도 소진·장애)."""

    async def write(self, store_no: int, count: int, now: float) -> None:
        raise RuntimeError("D1 write failed")


def player(
    player_id: str,
    guest: str = "g-x",
    at: Position = Position(0, 0),
    heading: Heading = Heading.STOP,
    updated_at: float = 0.0,
) -> Player:
    return Player(player_id, guest, "토끼", 0, at, heading, updated_at)


class FakeRegistry:
    def __init__(self) -> None:
        self._players: dict[str, Player] = {}

    def entries(self) -> list[tuple[str, Player]]:
        return list(self._players.items())

    def put(self, conn_id: str, player: Player) -> None:
        self._players[conn_id] = player

    def remove(self, conn_id: str) -> Player | None:
        return self._players.pop(conn_id, None)


class FakeConnections:
    """ConnectionsPort 가짜 — 의미 단위 호출을 실제 서버 메시지(dict)로 바꿔 기록한다."""

    def __init__(self) -> None:
        self.broadcasts: list[tuple[str | None, dict]] = []
        self.direct: list[tuple[str, dict]] = []
        self.kicked: list[tuple[str, int]] = []

    def send_welcome(self, conn_id, store_no, you, players, snapshot) -> None:
        self.direct.append((conn_id, server_messages.welcome(store_no, you, players, snapshot)))

    def broadcast_join(self, except_conn, p) -> None:
        self.broadcasts.append((except_conn, server_messages.join(p)))

    def broadcast_leave(self, except_conn, player_id) -> None:
        self.broadcasts.append((except_conn, server_messages.leave(player_id)))

    def broadcast_move(self, except_conn, p) -> None:
        self.broadcasts.append((except_conn, server_messages.move(p)))

    def send_correction(self, conn_id, x, z) -> None:
        self.direct.append((conn_id, server_messages.correct(x, z)))

    def kick(self, conn_id: str, code: int, reason: str) -> None:
        self.kicked.append((conn_id, code))

    def broadcast_queue(self, counter, player_ids) -> None:
        self.broadcasts.append((None, server_messages.queue(counter, player_ids)))

    def send_queue_no(self, conn_id, counter, why) -> None:
        self.direct.append((conn_id, server_messages.queue_no(counter, why)))

    def send_coins(self, conn_id, total, got) -> None:
        self.direct.append((conn_id, server_messages.coins(total, got)))

    def send_play_ok(self, conn_id, machine_id, coins, limit) -> None:
        self.direct.append((conn_id, server_messages.play_ok(machine_id, coins, limit)))

    def send_play_no(self, conn_id, machine_id, why) -> None:
        self.direct.append((conn_id, server_messages.play_no(machine_id, why)))

    def broadcast_play(self, except_conn, machine_id, player_id) -> None:
        self.broadcasts.append((except_conn, server_messages.play(machine_id, player_id)))

    def broadcast_result(self, view) -> None:
        self.broadcasts.append((None, server_messages.result(view)))

    def broadcast_machine(self, machine_id, spots) -> None:
        self.broadcasts.append((None, server_messages.machine(machine_id, spots)))

    def broadcast_free(self, machine_id) -> None:
        self.broadcasts.append((None, server_messages.free(machine_id)))

    def send_bag(self, conn_id, total) -> None:
        self.direct.append((conn_id, server_messages.bag(total)))


class FakeWallet:
    """지갑(D1) 가짜 — 게스트별 코인 수."""

    def __init__(self, balances: dict[str, int] | None = None) -> None:
        self.coins = dict(balances or {})
        self.spent = 0

    async def balance(self, guest_id: str) -> int:
        return self.coins.get(guest_id, 0)

    async def add(self, guest_id: str, n: int, cap: int, now: float) -> int:
        self.coins[guest_id] = min(self.coins.get(guest_id, 0) + n, cap)
        return self.coins[guest_id]

    async def spend_one(self, guest_id: str, now: float) -> int | None:
        if self.coins.get(guest_id, 0) < 1:
            return None
        self.coins[guest_id] -= 1
        self.spent += 1
        return self.coins[guest_id]


class FakeBag:
    def __init__(self, totals: dict[str, int] | None = None) -> None:
        self.totals = dict(totals or {})
        self.added: list[tuple[str, str, str]] = []

    async def total(self, guest_id: str) -> int:
        return self.totals.get(guest_id, 0)

    async def add(self, guest_id: str, doll: str, zone: str, now: float) -> int:
        self.added.append((guest_id, doll, zone))
        self.totals[guest_id] = self.totals.get(guest_id, 0) + 1
        return self.totals[guest_id]


class FakeContents:
    """기계 속 인형 저장소(DO 저장소) 가짜: 기계 id → MachineStock, 가장 이른 채울 시각(due)."""

    def __init__(self, stored: dict | None = None, due: float | None = None) -> None:
        self.stored = dict(stored or {})
        self.due = due
        self.saves = 0
        self.loads = 0

    async def load(self) -> dict:
        self.loads += 1
        return dict(self.stored)

    async def save(self, stocks: dict) -> None:
        from toycrane.domain.stock import due

        self.stored = dict(stocks)
        self.due = due(stocks)
        self.saves += 1

    async def due_at(self) -> float | None:
        return self.due


class FakeStorage:
    """DO 저장소(ctx.storage) 가짜 — 값은 문자열 그대로 (to_py가 통과시킨다)."""

    def __init__(self, initial: dict | None = None) -> None:
        self.data = dict(initial or {})
        self.gets = 0

    async def get(self, key: str):
        self.gets += 1
        return self.data.get(key)

    async def put(self, key: str, value) -> None:
        self.data[key] = value


def stocks_with_empty(machine_id: str, next_at: float) -> dict:
    """24대를 모두 채우고 machine_id만 하나 비워 둔(next_at에 채울) 매장."""
    import random

    from toycrane.domain.layout import MACHINES
    from toycrane.domain.stock import MachineStock, generate_stock

    stocks = {m: generate_stock(spot.kind, random.Random(0)) for m, spot in MACHINES.items()}
    full = stocks[machine_id]
    stocks[machine_id] = MachineStock(full.dolls[1:], next_at, full.next_uid)
    return stocks


class FakeQueues:
    """교환소 줄(attachment) 가짜. player_ids: 접속 → player_id."""

    def __init__(self, player_ids: dict[str, str] | None = None) -> None:
        self.player_ids = dict(player_ids or {})
        self.rows: dict[str, dict] = {}

    def members(self, counter: int) -> list[QueueMember]:
        rows = sorted((r["at"], c) for c, r in self.rows.items() if r["c"] == counter)
        return [QueueMember(c, self.player_ids.get(c, c.replace("c-", "p")), at, self.rows[c]["head"]) for at, c in rows]

    def counter_of(self, conn_id: str) -> int | None:
        row = self.rows.get(conn_id)
        return row["c"] if row else None

    def join(self, conn_id: str, counter: int, now: float) -> None:
        self.rows[conn_id] = {"c": counter, "at": now, "head": None}

    def remove(self, conn_id: str) -> None:
        self.rows.pop(conn_id, None)

    def mark_head(self, conn_id: str, now: float) -> None:
        self.rows[conn_id]["head"] = now

    def head_since(self, conn_id: str) -> float | None:
        return self.rows[conn_id]["head"]


class FakeLocks:
    """기계 잠금(attachment) 가짜. player_ids: 접속 → player_id."""

    def __init__(self, player_ids: dict[str, str] | None = None) -> None:
        self.player_ids = dict(player_ids or {})
        self.rows: dict[str, tuple[str, float]] = {}
        self.between: set[str] = set()

    def holder(self, machine_id: str) -> tuple[str, float] | None:
        return next(((c, at) for c, (m, at) in self.rows.items() if m == machine_id), None)

    def lock_of(self, conn_id: str) -> tuple[str, float] | None:
        return self.rows.get(conn_id)

    def lock(self, conn_id: str, machine_id: str, now: float) -> None:
        self.rows[conn_id] = (machine_id, now)
        self.between.discard(conn_id)

    def hold(self, conn_id: str, machine_id: str, now: float) -> None:
        self.rows[conn_id] = (machine_id, now)
        self.between.add(conn_id)

    def is_between(self, conn_id: str) -> bool:
        return conn_id in self.between

    def release(self, conn_id: str) -> None:
        self.rows.pop(conn_id, None)
        self.between.discard(conn_id)

    def plays(self) -> dict[str, str]:
        return {m: self.player_ids.get(c, c.replace("c-", "p")) for c, (m, _) in self.rows.items()}
