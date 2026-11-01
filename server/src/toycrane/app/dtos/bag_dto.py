from dataclasses import dataclass


@dataclass(frozen=True)
class ListBagQuery:
    guest_id: str


@dataclass(frozen=True)
class BagEntry:
    """가방 한 칸: 캐릭터·색·희귀 단계·구역마다 몇 개, 처음 뽑은 때."""

    doll: str
    color: int
    rare: str
    zone: str
    count: int
    first_at: float
