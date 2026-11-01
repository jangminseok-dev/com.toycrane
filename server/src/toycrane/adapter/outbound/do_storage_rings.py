import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.ring_boards_port import RingBoardsPort
from toycrane.domain.ring import Card

# v1: 기계 id → 걸이마다 [캐릭터, 색, 희귀] (설계 2026-11-02 §3)
KEY = "rings_v1"


class DoStorageRingBoards(RingBoardsPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다 (10대 × 12장, 수 KB)."""

    def __init__(self, storage) -> None:
        self._storage = storage

    async def load(self) -> dict[str, tuple[Card, ...]]:
        raw = to_py(await self._storage.get(KEY))
        if not raw:
            return {}
        return {m: tuple(Card(k, c, r) for k, c, r in cards) for m, cards in json.loads(raw).items()}

    async def save(self, boards: dict[str, tuple[Card, ...]]) -> None:
        raw = {m: [[c.kind, c.color, c.rare] for c in cards] for m, cards in boards.items()}
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
