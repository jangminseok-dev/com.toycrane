import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.staff_board_port import StaffBoardPort
from toycrane.domain.staff import EMPTY_BOARD, StaffBoard, StaffJob

KEY = "staff_v1"  # {"jobs": {구역: [[기계, 앞 기계|null, depart, arrive, put, end], ...]}, "calls": {기계: {손님: 판 수}}}


class DoStorageStaffBoard(StaffBoardPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다(일 몇 개 + 기계마다 최근 손님 40명까지)."""

    def __init__(self, storage) -> None:
        self._storage = storage

    async def load(self) -> StaffBoard:
        raw = to_py(await self._storage.get(KEY))
        if not raw:
            return EMPTY_BOARD
        data = json.loads(raw)
        jobs = {z: tuple(StaffJob(*j) for j in js) for z, js in data.get("jobs", {}).items()}
        return StaffBoard(jobs, {m: dict(g) for m, g in data.get("calls", {}).items()})

    async def save(self, board: StaffBoard) -> None:
        raw = {
            "jobs": {z: [[j.machine, j.origin, j.depart, j.arrive, j.put, j.end] for j in js] for z, js in board.jobs.items()},
            "calls": board.calls,
        }
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
