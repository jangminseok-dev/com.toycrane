import json

from toycrane.adapter.runtime import to_py
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.domain.crane import DollSpot

KEY = "machines"


class DoStorageMachineContents(MachineContentsPort):
    """매장 DO 저장소 키 "machines"에 JSON 문자열 하나로 둔다 (35대 × 9개, 10KB 안팎)."""

    def __init__(self, storage) -> None:
        self._storage = storage

    async def load(self) -> dict[str, list[DollSpot]]:
        raw = to_py(await self._storage.get(KEY))
        if not raw:
            return {}
        return {m: [DollSpot(*s) for s in spots] for m, spots in json.loads(raw).items()}

    async def save(self, contents: dict[str, list[DollSpot]]) -> None:
        raw = {m: [[s.kind, s.x, s.z, s.r] for s in spots] for m, spots in contents.items()}
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
