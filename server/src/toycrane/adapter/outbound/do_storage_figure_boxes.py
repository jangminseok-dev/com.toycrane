import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.domain.figure import FigureState

# v1: 기계 id → {"b": 상자 자리 [x, y, z, qx, qy, qz, qw](기계 좌표), "s": 거의 안 움직인 판 수} — 경품은 뽑힌 순간 정하므로 없다
KEY = "figures_v1"


class DoStorageFigureBoxes(FigureBoxesPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다 (14대, 1KB 안팎)."""

    def __init__(self, storage) -> None:
        self._storage = storage

    async def load(self) -> dict[str, FigureState]:
        raw = to_py(await self._storage.get(KEY))
        if not raw:
            return {}
        return {m: FigureState(tuple(v["b"]), v["s"]) for m, v in json.loads(raw).items()}

    async def save(self, states: dict[str, FigureState]) -> None:
        raw = {m: {"b": list(s.box), "s": s.still} for m, s in states.items()}  # 반올림 없이 — 다시 읽어도 같은 상자(메시지만 셋째 자리)
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
