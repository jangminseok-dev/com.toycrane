"""인형 목록(shared/catalog.json): 4세트 × (일반 6 + 희귀 1) = 28종."""

from dataclasses import dataclass

from toycrane.domain.shared_data import CATALOG


@dataclass(frozen=True)
class Doll:
    id: str
    name: str
    set: str
    rare: bool
    base: str | None = None  # 희귀 인형이 모양을 빌려 오는 일반 인형


DOLLS: dict[str, Doll] = {d["id"]: Doll(d["id"], d["name"], d["set"], d["rare"], d.get("base")) for d in CATALOG["dolls"]}
SET_IDS: tuple[str, ...] = tuple(s["id"] for s in CATALOG["sets"])


def set_kinds(set_id: str) -> tuple[list[str], str]:
    """세트의 일반 6종과 희귀 1종."""
    members = [d for d in DOLLS.values() if d.set == set_id]
    return [d.id for d in members if not d.rare], next(d.id for d in members if d.rare)


def is_rare(kind: str) -> bool:
    """목록에 없는 인형(배포로 목록이 바뀜)은 일반으로 본다."""
    doll = DOLLS.get(kind)
    return bool(doll and doll.rare)
