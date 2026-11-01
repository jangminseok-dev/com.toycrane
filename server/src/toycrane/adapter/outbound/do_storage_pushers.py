import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.pusher_shelves_port import PusherShelvesPort
from toycrane.domain.pusher import Item

# v1: 기계 id → 인형마다 [번호, 캐릭터, 색, 희귀, x, z] (설계 2026-11-02 §4) — 반올림 없이(다시 읽어도 같은 선반)
KEY = "pushers_v1"


class DoStoragePusherShelves(PusherShelvesPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다 (4대 × 최대 20개, 수 KB)."""

    def __init__(self, storage) -> None:
        self._storage = storage

    async def load(self) -> dict[str, tuple[Item, ...]]:
        raw = to_py(await self._storage.get(KEY))
        if not raw:
            return {}
        return {m: tuple(Item(*row) for row in items) for m, items in json.loads(raw).items()}

    async def save(self, shelves: dict[str, tuple[Item, ...]]) -> None:
        raw = {m: [[i.uid, i.kind, i.color, i.rare, i.x, i.z] for i in items] for m, items in shelves.items()}
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
