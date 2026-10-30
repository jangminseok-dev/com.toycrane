from dataclasses import dataclass

from toycrane.app.dtos.player_view import PlayerView


class StoreFull(Exception):
    pass


@dataclass(frozen=True)
class EnterCommand:
    conn_id: str
    guest_id: str
    nickname: str
    color: int
    store_no: int
    now: float
    seed: int


@dataclass(frozen=True)
class EnterResult:
    you: PlayerView
    others: tuple[PlayerView, ...]
