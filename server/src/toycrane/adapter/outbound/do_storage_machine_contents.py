import json

from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.domain.crane import DollSpot
from toycrane.domain.layout import PUSHERS
from toycrane.domain.shared_data import PUSHER
from toycrane.domain.stock import MachineStock, due

# v6: 인형마다 자리(x, y, z)·돌림(쿼터니언)·변형·번호 (물리 뽑기 설계 §4.5) — v5와 같은 모양, 미는 뽑기는 새 턱(2026-11-02)에 앉힌 자리.
# v5는 그대로 읽되 미는 뽑기의 턱 위 인형만 안 앉은 인형으로 — 턱 앞 끝을 당겨 옛 턱 앞쪽 인형이 출구 위에 뜬다(첫 판에 공짜로 빠짐).
# v4(옛 인형 모양으로 앉힌 자리, 인형 리뉴얼 설계 §5.3)와 v3(x, z, 돌림, 높이)는 자리만 남기고 안 앉은 인형으로 읽는다
# (첫 화면이 물리로 앉힘, 물리 뽑기 설계 §6). 더 옛 배치("machines_v2")는 읽지 않고 새로 채운다
KEY, V5_KEY, V4_KEY, V3_KEY, DUE_KEY = "machines_v6", "machines_v5", "machines_v4", "machines_v3", "stock_due"
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
            return {m: MachineStock([_doll(d) for d in v["d"]], v["n"], v["u"], v.get("m", {}), {int(k): n for k, n in v.get("s", {}).items()}) for m, v in json.loads(raw).items()}
        for key, read in ((V5_KEY, _from_v5), (V4_KEY, lambda _m, d: _from_v4(d)), (V3_KEY, lambda _m, d: _from_v3(d))):
            old = to_py(await self._storage.get(key))
            if old:
                return {m: MachineStock([read(m, d) for d in v["d"]], v["n"], v["u"]) for m, v in json.loads(old).items()}
        return {}

    async def save(self, stocks: dict[str, MachineStock]) -> None:
        raw = {
            m: {"d": [[d.kind, d.x, d.y, d.z, *d.q, d.color, d.body, d.face, d.rare, d.uid] for d in s.dolls], "n": s.next_at, "u": s.next_uid}
            | ({"m": s.misses} if s.misses else {})  # 연달아 못 뽑은 판 수(있을 때만)
            | ({"s": s.stuck} if s.stuck else {})  # 미는 뽑기 직원이 정리의 판 수(인형 번호별, 있을 때만)
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


def _from_v5(machine: str, d: list) -> DollSpot:
    spot = _doll(d)
    if machine in PUSHERS and spot.x < PUSHER["ledge"]["x1"]:  # 미는 뽑기 턱 위(칸은 턱 오른쪽 끝보다 오른쪽) — 새 턱에 다시 앉힌다
        return DollSpot(spot.kind, spot.x, None, spot.z, color=spot.color, body=spot.body, face=spot.face, rare=spot.rare, uid=spot.uid)
    return spot


def _from_v4(d: list) -> DollSpot:
    kind, x, _y, z, _qx, _qy, _qz, _qw, color, body, face, rare, uid = d
    return DollSpot(kind, x, None, z, color=color, body=body, face=face, rare=rare, uid=uid)


def _from_v3(d: list) -> DollSpot:
    kind, x, z, _r, _y, color, body, face, rare, uid = d
    return DollSpot(kind, x, None, z, color=color, body=body, face=face, rare=rare, uid=uid)
