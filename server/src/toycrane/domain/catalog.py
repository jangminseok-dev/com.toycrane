"""인형 목록(shared/catalog.json): 4세트 × 일반 6 = 24종. 캐릭터마다 색 6가지, 희귀 효과 8가지와 황금은 모든 캐릭터에 입힌다."""

from dataclasses import dataclass

from toycrane.domain.shared_data import CATALOG


@dataclass(frozen=True)
class Doll:
    id: str
    name: str
    set: str
    palette: tuple[str, ...]  # 색 이름 6가지 (0번이 기본색)


DOLLS: dict[str, Doll] = {
    d["id"]: Doll(d["id"], d["name"], d["set"], tuple(c["name"] for c in d["palette"])) for d in CATALOG["dolls"]
}
SET_IDS: tuple[str, ...] = tuple(s["id"] for s in CATALOG["sets"])
EFFECTS: tuple[str, ...] = tuple(e["id"] for e in CATALOG["effects"])  # 희귀(특수효과)
GOLD = CATALOG["gold"]["id"]  # 매우 희귀(황금)
_LEGACY: dict[str, tuple[str, str]] = {k: (v[0], v[1]) for k, v in CATALOG["legacy"].items()}


def legacy_kind(doll_id: str) -> tuple[str, str]:
    """옛 희귀 캐릭터 id(별빛 토끼 등)를 (캐릭터, 희귀)로. 일반 id는 (id, "")."""
    return _LEGACY.get(doll_id, (doll_id, ""))
