import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.domain.crane import DollSpot
from toycrane.domain.stock import MachineStock, due

# v4: 인형마다 자리(x, y, z)·돌림(쿼터니언)·변형·번호 (물리 뽑기 설계 §4.5). v3(x, z, 돌림, 높이)는 자리만 남기고 안 앉은 인형으로
# 읽는다(첫 화면이 물리로 앉힘, 설계 §6). 더 옛 배치("machines_v2")는 읽지 않고 새로 채운다
KEY, OLD_KEY, DUE_KEY = "machines_v4", "machines_v3", "stock_due"
# 매장(DO)마다 가장 이른 채울 시각을 메모리에 둔다 — 메시지마다 저장소를 읽지 않게(무료 한도: 하루 행 읽기).
# 모듈 메모리는 isolate 것이라, 기억한 DO 인스턴스(owner = ctx)가 지금 인스턴스일 때만 믿는다 — 그 DO가 다른 곳에서
# 다시 만들어져 저장한 뒤 돌아와도 옛 값을 쓰지 않게. 새 인스턴스는 처음 한 번 읽는다
_DUE: dict[str, tuple[object, float | None]] = {}


class DoStorageMachineContents(MachineContentsPort):
    """매장 DO 저장소 키 하나에 JSON 문자열로 둔다 (24대 × 9개, 10KB 안팎) + 작은 키 하나에 가장 이른 채울 시각."""

    def __init__(self, storage, store_key: str, owner: object) -> None:
        self._storage = storage
        self._key = store_key
        self._owner = owner

    async def load(self) -> dict[str, MachineStock]:
        raw = to_py(await self._storage.get(KEY))
        if raw:
            return {m: MachineStock([_doll(d) for d in v["d"]], v["n"], v["u"]) for m, v in json.loads(raw).items()}
        old = to_py(await self._storage.get(OLD_KEY))
        if not old:
            return {}
        return {m: MachineStock([_from_v3(d) for d in v["d"]], v["n"], v["u"]) for m, v in json.loads(old).items()}

    async def save(self, stocks: dict[str, MachineStock]) -> None:
        raw = {
            m: {"d": [[d.kind, d.x, d.y, d.z, *d.q, d.color, d.body, d.face, d.rare, d.uid] for d in s.dolls], "n": s.next_at, "u": s.next_uid}
            for m, s in stocks.items()
        }
        when = due(stocks)
        await self._storage.put(KEY, json.dumps(raw, separators=(",", ":")))
        await self._storage.put(DUE_KEY, json.dumps(when))
        _DUE[self._key] = (self._owner, when)

    async def due_at(self) -> float | None:
        known = _DUE.get(self._key)
        if known is None or known[0] is not self._owner:
            known = _DUE[self._key] = (self._owner, json.loads(to_py(await self._storage.get(DUE_KEY)) or "null"))
        return known[1]


def _doll(d: list) -> DollSpot:
    kind, x, y, z, qx, qy, qz, qw, color, body, face, rare, uid = d
    return DollSpot(kind, x, y, z, (qx, qy, qz, qw), color, body, face, rare, uid)


def _from_v3(d: list) -> DollSpot:
    kind, x, z, _r, _y, color, body, face, rare, uid = d
    return DollSpot(kind, x, None, z, color=color, body=body, face=face, rare=rare, uid=uid)
