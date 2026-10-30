"""인터랙터 테스트용 가짜 포트. 태스크가 늘 때마다 여기에 추가한다."""

from toycrane.adapter.inbound.ws.schemas import server_messages
from toycrane.app.dtos.guest_dto import GuestView
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

    def send_welcome(self, conn_id, store_no, you, players) -> None:
        self.direct.append((conn_id, server_messages.welcome(store_no, you, players)))

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
