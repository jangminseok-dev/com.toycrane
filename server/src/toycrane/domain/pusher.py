"""미는 뽑기 규칙(설계 2026-11-02 §4, 수치 shared/pusher.json): 위에서 본 2D 선반(x ∈ ±half_w, z ∈ [back_z, front_z]) 위 미니 인형(반지름 r 원판).
뒤쪽 미는 판(폭 2×plate.half_w)이 '밀기'를 누른 자리 x에서 back_z부터 stroke만큼 앞으로 나가며 닿는 인형을 밀고, 밀린 인형이 다른 인형을 민다
(겹침 풀기 — 경품은 마찰이 있어 앞에 있는 인형이 앞으로만 밀려난다). 가운데가 앞 끝을 넘은 인형은 떨어져 당첨.
판마다 새 인형 하나가 뒤쪽에 떨어진다(cap개까지 — 쌓여야 사슬로 앞까지 밀린다). 같은 입력이면 같은 결과 — 난수는 새 인형에만 쓴다."""

import math
import random
from dataclasses import dataclass, replace

from toycrane.domain.catalog import DOLLS, EFFECTS, GOLD
from toycrane.domain.shared_data import PUSHER

_S, _P, _I = PUSHER["shelf"], PUSHER["plate"], PUSHER["item"]
_R = _I["r"]
_KINDS = tuple(DOLLS)
_STEPS = 10  # 미는 거리를 나눈 걸음
_RELAX = 40  # 걸음마다 겹침 풀기 상한
_SPAWN_DEPTH = 0.14  # 새 인형은 뒤 끝에서 이만큼 안에


@dataclass(frozen=True)
class Item:
    uid: int  # 선반 위 인형 번호(화면이 같은 인형을 따라 움직이게)
    kind: str
    color: int
    rare: str
    x: float
    z: float


def plate_range() -> tuple[float, float]:
    """미는 판 가운데가 갈 수 있는 x 범위."""
    m = _S["half_w"] - _P["half_w"]
    return -m, m


def valid_push(x: float) -> bool:
    lo, hi = plate_range()
    return math.isfinite(x) and lo - 1e-6 <= x <= hi + 1e-6


def _new_item(uid: int, x: float, z: float, rng: random.Random) -> Item:
    kind, color = rng.choice(_KINDS), rng.randrange(6)
    rare = GOLD if rng.random() < PUSHER["odds"]["gold"] else (rng.choice(EFFECTS) if rng.random() < PUSHER["odds"]["rare"] else "")
    return Item(uid, kind, color, rare, x, z)


def _free(items, x: float, z: float) -> bool:
    return all(math.dist((i.x, i.z), (x, z)) >= 2 * _R for i in items)


def _place(items: list[Item], uid: int, z_lo: float, z_hi: float, rng: random.Random) -> Item | None:
    for _ in range(30):
        x, z = rng.uniform(-_S["half_w"] + _R, _S["half_w"] - _R), rng.uniform(z_lo, z_hi)
        if _free(items, x, z):
            return _new_item(uid, x, z, rng)
    return None


def new_shelf(rng: random.Random) -> tuple[Item, ...]:
    """처음 선반: count개를 겹치지 않게 흩는다(앞 끝에서 반지름 + start_margin 안쪽까지 — 첫 판에 바로 떨어지지 않게)."""
    items: list[Item] = []
    while len(items) < _I["count"]:
        it = _place(items, len(items) + 1, _S["back_z"] + _R, _S["front_z"] - _R - _I["start_margin"], rng)
        if it:
            items.append(it)
    return tuple(items)


def drop_in(items: tuple[Item, ...], rng: random.Random) -> tuple[Item, ...]:
    """한 판의 새 인형 하나를 뒤 끝 가까이에 떨어뜨린다(cap개면, 또는 자리가 없으면 그대로)."""
    if len(items) >= _I["cap"]:
        return items
    it = _place(list(items), max((i.uid for i in items), default=0) + 1, _S["back_z"] + _R, _S["back_z"] + _SPAWN_DEPTH, rng)
    return items + (it,) if it else items


def _clamp(i: Item, front: float, px: float) -> Item:
    x = max(-_S["half_w"] + _R, min(_S["half_w"] - _R, i.x))
    z = max(_S["back_z"] + _R, i.z)
    if abs(x - px) < _P["half_w"] + _R and z < front + _R:  # 미는 판 앞면에 닿음
        z = front + _R
    return replace(i, x=x, z=z)


def push(items: tuple[Item, ...], x: float) -> tuple[tuple[Item, ...], tuple[Item, ...]]:
    """x에서 한 번 민다 — (선반에 남은 인형, 떨어진 인형)."""
    cur = list(items)
    for step in range(1, _STEPS + 1):
        front = _S["back_z"] + _P["stroke"] * step / _STEPS
        cur = [_clamp(i, front, x) for i in cur]
        for _ in range(_RELAX):
            moved = False
            for a in range(len(cur)):
                for b in range(a + 1, len(cur)):
                    p, q = cur[a], cur[b]
                    dx = q.x - p.x
                    if abs(dx) >= 2 * _R - 1e-9 or math.dist((p.x, p.z), (q.x, q.z)) >= 2 * _R - 1e-9:
                        continue
                    # 경품은 마찰이 있어 옆으로 미끄러져 흩어지지 않는다 — 앞에 있는 인형이 앞으로만 밀려난다(사슬로 힘이 앞까지 전해짐)
                    back, ahead = (a, b) if p.z <= q.z else (b, a)
                    behind = cur[back]
                    cur[ahead] = _clamp(replace(cur[ahead], z=behind.z + math.sqrt((2 * _R) ** 2 - dx * dx)), front, x)
                    moved = True
            if not moved:
                break
    fell = tuple(i for i in cur if i.z > _S["front_z"])
    return tuple(i for i in cur if i.z <= _S["front_z"]), fell
