import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.domain.figure import FigureState

# v2(큰 상자 두 종류, 설계 §8 — v1의 작은 상자는 읽지 않는다): 기계 id → {"b": 상자 자리 [x, y, z, qx, qy, qz, qw](기계 좌표),
# "s": 거의 안 움직인 판 수} — 경품은 뽑힌 순간 정하므로 없다
KEY = "figures_v4"  # v4: 앞도 받침 막대 + 유리 벽(상자 종류마다, 사용자 2026-11-02) — 옛 낮은 앞판에 기대 걸친 자리는 새 유리에 낄 수 있어 읽지 않고 새로 올린다(v3: 상자·막대 틈·집게 15% 키움)
HOOK_KEY = "hooks_v1"  # 고리 걸기 상자(계획 12) — 같은 형식, 다른 키


class DoStorageFigureBoxes(FigureBoxesPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다 (14대, 1KB 안팎)."""

    def __init__(self, storage, key: str = KEY) -> None:
        self._storage = storage
        self._key = key

    async def load(self) -> dict[str, FigureState]:
        raw = to_py(await self._storage.get(self._key))
        if not raw:
            return {}
        return {m: FigureState(tuple(v["b"]), v["s"]) for m, v in json.loads(raw).items()}

    async def save(self, states: dict[str, FigureState]) -> None:
        raw = {m: {"b": list(s.box), "s": s.still} for m, s in states.items()}  # 반올림 없이 — 다시 읽어도 같은 상자(메시지만 셋째 자리)
        await self._storage.put(self._key, json.dumps(raw, separators=(",", ":")))
