"""크레인 기계 속: 인형 배치와 판정 (설계 §5.3, 수치는 2단계 계획의 [내 판단]).

배치: 바닥에 6개를 서로 22cm 넘게 떨어뜨려 놓고(겹쳐 파고들지 않게), 위층 3개는 가까운 바닥 인형 두 개 사이 틈에
얹는다. 얹힌 높이는 받쳐 주는 인형들의 둥근 윗면(타원체)으로 정해 모든 화면이 같게 그린다. 바라보는 방향은 무작위.
판정: 집게 손이 닿는 인형(14cm 안) 가운데 가장 높이 있는 것을 노리고, 그 인형 중심까지 거리로 잡은 부위
(머리·몸통·팔)를 정해 부위별 (성공, 놓침) 확률 × 희귀도로 결과를 굴린다. 나머지는 헛잡음."""

import math
import random
from dataclasses import dataclass

from toycrane.domain.catalog import is_rare, set_kinds
from toycrane.domain.layout import MACHINE_SPEC

DOLLS_PER_MACHINE = 9
FLOOR_DOLLS = 6
TOP_DOLLS = DOLLS_PER_MACHINE - FLOOR_DOLLS
MIN_GAP = 0.22      # 바닥 인형 중심 사이 최소 거리(m) — 인형 지름이 25~30cm
VALLEY_MAX = 0.30   # 위층 인형을 받칠 두 바닥 인형 사이 최대 거리
DOLL_H, DOLL_W = 0.34, 0.16  # 기계 속 인형을 감싸는 타원체: 높이, 가로 반지름
SINK = 0.06         # 위층 인형이 받침 사이에 파묻히는 깊이
RARE_CHANCE = 0.06
PART_RADII = (("head", 0.05), ("body", 0.10), ("arm", 0.14))
# (성공, 놓침), 나머지는 헛잡음. 보통 난이도(사용자 결정 2026-10-31) — 머리를 맞혀도 7판에 하나꼴, 4단계 근성 게이지가 받쳐 준다
ODDS = {"head": (0.15, 0.40), "body": (0.08, 0.45), "arm": (0.03, 0.45)}
RARE_WIN_FACTOR = 0.35  # 희귀는 성공 확률 × 0.35, 줄어든 만큼 놓침으로
SWAY_MAX = 0.07  # 내려갈 때 집게가 흔들려 노린 자리에서 벗어나는 최대 거리(m) — 머리(5cm)를 노려도 몸통에 걸릴 수 있게


@dataclass(frozen=True)
class DollSpot:
    """기계 안 인형 하나: 기계 안 좌표(m)와 몸 돌림(라디안)."""

    kind: str
    x: float
    z: float
    r: float
    y: float = 0.0  # 얹힌 높이(바닥이면 0)


def generate_contents(set_id: str, rng: random.Random) -> list[DollSpot]:
    """그 세트 인형 9개: 바닥 6개(서로 떨어뜨림) + 위층 3개(두 인형 사이 틈에 얹음). 틈이 모자라면 바닥을 다시 깐다."""
    while True:
        floor = _floor(set_id, rng)
        top = _top(set_id, floor, rng)
        if len(top) == TOP_DOLLS:
            return floor + top


def new_spot(set_id: str, rng: random.Random, x: float, z: float, y: float = 0.0) -> DollSpot:
    normals, rare = set_kinds(set_id)
    kind = rare if rng.random() < RARE_CHANCE else rng.choice(normals)
    return DollSpot(kind, x, z, round(rng.uniform(0, 2 * math.pi), 2), y)


def _in_area(x: float, z: float) -> bool:
    hx, hz, hr = MACHINE_SPEC.hole
    return math.hypot(x - hx, z - hz) >= hr


def _floor(set_id: str, rng: random.Random) -> list[DollSpot]:
    w, d = MACHINE_SPEC.play_half
    spots: list[DollSpot] = []
    gap, tries = MIN_GAP, 0
    while len(spots) < FLOOR_DOLLS:
        x, z = round(rng.uniform(-w, w), 3), round(rng.uniform(-d, d), 3)
        if _in_area(x, z) and all(math.hypot(x - s.x, z - s.z) >= gap for s in spots):
            spots.append(new_spot(set_id, rng, x, z))
        tries += 1
        if tries > 400:  # 자리가 안 나면 아주 조금씩 좁힌다
            gap, tries = gap - 0.005, 0
    return spots


def _top(set_id: str, floor: list[DollSpot], rng: random.Random) -> list[DollSpot]:
    pairs = [(a, b) for i, a in enumerate(floor) for b in floor[i + 1:] if math.hypot(a.x - b.x, a.z - b.z) <= VALLEY_MAX]
    rng.shuffle(pairs)
    top: list[DollSpot] = []
    for a, b in pairs:
        x = round((a.x + b.x) / 2 + rng.uniform(-0.01, 0.01), 3)
        z = round((a.z + b.z) / 2 + rng.uniform(-0.01, 0.01), 3)
        if not _in_area(x, z) or any(math.hypot(x - t.x, z - t.z) < 0.18 for t in top):
            continue
        top.append(new_spot(set_id, rng, x, z, rest_height(floor, x, z)))
        if len(top) == TOP_DOLLS:
            break
    return top


def rest_height(floor: list[DollSpot], x: float, z: float) -> float:
    """받쳐 주는 인형들의 둥근 윗면 가운데 가장 높은 곳에서 조금 파묻힌 높이."""
    top = 0.0
    for s in floor:
        d = math.hypot(s.x - x, s.z - z)
        if d < DOLL_W:
            top = max(top, DOLL_H / 2 + DOLL_H / 2 * math.sqrt(1 - (d / DOLL_W) ** 2))
    return round(max(top - SINK, 0.0), 3)


@dataclass(frozen=True)
class Grab:
    outcome: str  # "win" | "slip" | "miss"
    part: str  # "head" | "body" | "arm" | "none"
    index: int | None  # 집게가 노린 인형 (빈 곳이면 None)


def sway(x: float, z: float, rng: random.Random) -> tuple[float, float]:
    """집게가 내려가며 흔들려 실제로 떨어지는 자리 (서버가 정한다 — 화면을 고쳐도 없앨 수 없게)."""
    angle, reach = rng.uniform(0, 2 * math.pi), rng.uniform(0, SWAY_MAX)
    return x + math.cos(angle) * reach, z + math.sin(angle) * reach


def clamp_claw(x: float, z: float) -> tuple[float, float]:
    w, d = MACHINE_SPEC.play_half
    return min(max(x, -w), w), min(max(z, -d), d)


def judge(spots: list[DollSpot], x: float, z: float, roll: float) -> Grab:
    """roll은 0~1 난수. 손이 닿는 인형 중 가장 높이 있는 것(같으면 가까운 것)을 노린다. 목록에 없는 인형은 일반으로 본다."""
    reach = PART_RADII[-1][1]
    near = [(i, math.hypot(s.x - x, s.z - z)) for i, s in enumerate(spots)]
    near = [(i, dist) for i, dist in near if dist <= reach]
    if not near:
        return Grab("miss", "none", None)
    index, distance = max(near, key=lambda c: (spots[c[0]].y, -c[1]))
    part = next(name for name, radius in PART_RADII if distance <= radius)
    win, slip = ODDS[part]
    if is_rare(spots[index].kind):
        win, slip = win * RARE_WIN_FACTOR, slip + win * (1 - RARE_WIN_FACTOR)
    outcome = "win" if roll < win else "slip" if roll < win + slip else "miss"
    return Grab(outcome, part, index)


def restock(spots: list[DollSpot], index: int, set_id: str, rng: random.Random) -> list[DollSpot]:
    """뽑힌 자리에 같은 세트 새 인형을 넣는다 — 위층을 받치던 인형이 빠져도 무더기가 무너지지 않게 자리·높이는 그대로."""
    old = spots[index]
    return [new_spot(set_id, rng, old.x, old.z, old.y) if i == index else s for i, s in enumerate(spots)]


def drop_nearby(spots: list[DollSpot], index: int, rng: random.Random) -> list[DollSpot]:
    """들었다 놓친 인형이 떨어져 굴러간 자리: 5~16cm 떨어진 빈 바닥(다른 바닥 인형과 18cm 넘게), 없으면 근처 인형 위.
    위층을 받치던 바닥 인형이면 위층이 뜨지 않게 제자리로 떨어진다."""
    old = spots[index]
    others = [s for i, s in enumerate(spots) if i != index]
    floor = [s for s in others if s.y == 0]
    holding = old.y == 0 and any(s.y > 0 and math.hypot(s.x - old.x, s.z - old.z) <= 0.17 for s in others)
    moved = old
    if not holding:
        w, d = MACHINE_SPEC.play_half
        candidates = []
        for _ in range(32):
            angle, dist = rng.uniform(0, 2 * math.pi), rng.uniform(0.05, 0.16)
            x, z = round(old.x + math.cos(angle) * dist, 3), round(old.z + math.sin(angle) * dist, 3)
            if abs(x) <= w and abs(z) <= d and _in_area(x, z):
                candidates.append((x, z))
        spin = round(rng.uniform(0, 2 * math.pi), 2)
        on_floor = next(((x, z) for x, z in candidates if all(math.hypot(x - f.x, z - f.z) >= 0.18 for f in floor)), None)
        if on_floor:
            moved = DollSpot(old.kind, on_floor[0], on_floor[1], spin, 0.0)
        elif candidates:
            x, z = candidates[0]
            moved = DollSpot(old.kind, x, z, spin, rest_height(floor, x, z))
    return [moved if i == index else s for i, s in enumerate(spots)]
