import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.domain.crane import DollSpot
from toycrane.domain.stock import MachineStock, due

# v3: 인형마다 변형(색·체형·표정·희귀)과 번호, 기계마다 다음 채울 시각 — 옛 배치("machines_v2")는 읽지 않고 새로 채운다
KEY, DUE_KEY = "machines_v3", "stock_due"
# 매장(DO)마다 가장 이른 채울 시각을 메모리에 둔다 — 이 DO만 자기 저장소에 쓰므로 어긋나지 않고, 메시지마다 저장소를
# 읽지 않아도 된다(무료 한도: 하루 행 읽기). 잠들었다 깨서 비어 있으면 한 번 읽는다
_DUE: dict[str, float | None] = {}


class DoStorageMachineContents(MachineContentsPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다 (24대 × 9개, 10KB 안팎) + 작은 키 하나에 가장 이른 채울 시각."""

    def __init__(self, storage, store_key: str) -> None:
        self._storage = storage
        self._key = store_key

    async def load(self) -> dict[str, MachineStock]:
        raw = to_py(await self._storage.get(KEY))
        if not raw:
            return {}
        return {m: MachineStock([DollSpot(*d) for d in v["d"]], v["n"], v["u"]) for m, v in json.loads(raw).items()}

    async def save(self, stocks: dict[str, MachineStock]) -> None:
        raw = {
            m: {"d": [[d.kind, d.x, d.z, d.r, d.y, d.color, d.body, d.face, d.rare, d.uid] for d in s.dolls], "n": s.next_at, "u": s.next_uid}
            for m, s in stocks.items()
        }
        when = due(stocks)
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
        await self._storage.put(DUE_KEY, json.dumps(when))
        _DUE[self._key] = when

    async def due_at(self) -> float | None:
        if self._key not in _DUE:
            _DUE[self._key] = json.loads(to_py(await self._storage.get(DUE_KEY)) or "null")
        return _DUE[self._key]
