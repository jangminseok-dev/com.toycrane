"""크레인 기계 속: 인형 자리와 판정 (설계 §5.3, 수치는 2단계 계획의 [내 판단], 체형·희귀는 2026-10-31 인형 채우기 설계 §4.4·§4.5).

자리: 바닥에 6개를 서로 22cm 넘게 떨어뜨려 놓고(겹쳐 파고들지 않게), 위층은 가까운 바닥 인형 두 개 사이 틈에
얹는다. 얹힌 높이는 받쳐 주는 인형들의 둥근 윗면(타원체, 체형만큼 넓거나 좁음)으로 정해 모든 화면이 같게 그린다.
판정: 집게 손이 닿는 인형(14cm × 체형) 가운데 가장 높이 있는 것을 노리고, 그 인형 중심까지 거리로 잡은 부위
(머리·몸통·팔)를 정해 부위별 (성공, 놓침) 확률에 희귀 단계·체형을 입혀 결과를 굴린다. 나머지는 헛잡음."""

import math
import random
from dataclasses import dataclass, replace

from toycrane.domain.layout import MACHINE_SPEC

FLOOR_DOLLS = 6
MIN_GAP = 0.22      # 바닥 인형 중심 사이 최소 거리(m) — 인형 지름이 25~30cm
VALLEY_MAX = 0.30   # 위층 인형을 받칠 두 바닥 인형 사이 최대 거리
DOLL_H, DOLL_W = 0.34, 0.16  # 기계 속 인형을 감싸는 타원체: 높이, 가로 반지름
SINK = 0.06         # 위층 인형이 받침 사이에 파묻히는 깊이
PART_RADII = (("head", 0.05), ("body", 0.10), ("arm", 0.14))
# (성공, 놓침), 나머지는 헛잡음. 성공에는 그 자리 집게 힘(claw_strength)을 곱한다 — 보통 인형 머리를 노리면
# 흔들림까지 넣어 10판에 3~4번, 몸통은 그 절반쯤 (사용자 결정 2026-10-31, tests/domain/test_crane.py의 aim_rate로 확인)
ODDS = {"head": (0.41, 0.40), "body": (0.20, 0.45), "arm": (0.08, 0.45)}
TIER_WIN = {"rare": 0.5, "gold": 0.3}  # 희귀·황금은 성공 확률 × 배율, 줄어든 만큼 놓침으로
# 체형: 폭(키는 같음) · 부위 판정 반지름 배율 · 놓침에 더하는 값 — 뚱뚱은 잘 잡히지만 무거워 떨어뜨리고, 마른은 빠져나가지만 들면 안 떨어진다
BODY_W = {"n": 1.0, "c": 1.15, "s": 0.88}
BODY_REACH = {"n": 1.0, "c": 1.25, "s": 0.8}
BODY_SLIP = {"n": 0.0, "c": 0.10, "s": -0.10}
STRENGTH_SPREAD = 0.25  # 집게 힘이 평균에서 ±25%까지 (claw_strength)
SWAY_MAX = 0.07  # 내려갈 때 집게가 흔들려 노린 자리에서 벗어나는 최대 거리(m) — 머리(5cm)를 노려도 몸통에 걸릴 수 있게


@dataclass(frozen=True)
class DollSpot:
    """기계 안 인형 하나: 기계 안 좌표(m)와 몸 돌림(라디안), 그리고 이 인형만의 변형."""

    kind: str
    x: float
    z: float
    r: float
    y: float = 0.0  # 얹힌 높이(바닥이면 0)
    color: int = 0  # 캐릭터 색 6가지 중 (희귀·황금은 쓰지 않음)
    body: str = "n"  # "n" 보통 · "c" 뚱뚱 · "s" 마른
    face: int = 0  # 표정 5가지 중
    rare: str = ""  # "" 일반 · 효과 id(희귀) · "gold"(매우 희귀)
    uid: int = 0  # 기계 안에서 이 인형을 가리키는 번호 (새로 채운 인형을 화면이 알아보게)


def _in_area(x: float, z: float) -> bool:
    hx, hz, hr = MACHINE_SPEC.hole
    return math.hypot(x - hx, z - hz) >= hr


def _supports(floor: list[DollSpot], x: float, z: float) -> list[DollSpot]:
    """(x, z)에 얹힌 인형을 받쳐 주는 바닥 인형 — 둥근 윗면(체형 폭) 안에 있는 것."""
    return [s for s in floor if math.hypot(s.x - x, s.z - z) < DOLL_W * BODY_W[s.body]]


def place_new(spots: list[DollSpot], rng: random.Random) -> tuple[float, float, float]:
    """새 인형이 놓일 자리 (x, z, y): 바닥이 6개가 안 되면 다른 인형과 22cm 넘게 떨어진 빈 바닥,
    아니면(또는 빈 바닥이 없으면) 바닥 인형 두 개 사이 틈 위, 둘 다 없으면 간격을 조금씩 줄인 빈 바닥."""
    w, d = MACHINE_SPEC.play_half
    floor, top = [s for s in spots if s.y == 0], [s for s in spots if s.y > 0]

    def free_floor(gap: float, tries: int) -> tuple[float, float] | None:
        for _ in range(tries):
            x, z = round(rng.uniform(-w, w), 3), round(rng.uniform(-d, d), 3)
            if _in_area(x, z) and all(math.hypot(x - s.x, z - s.z) >= gap for s in spots):
                return x, z
        return None

    if len(floor) < FLOOR_DOLLS:
        spot = free_floor(MIN_GAP, 400)
        if spot:
            return spot[0], spot[1], 0.0
    pairs = [(a, b) for i, a in enumerate(floor) for b in floor[i + 1:] if math.hypot(a.x - b.x, a.z - b.z) <= VALLEY_MAX]
    rng.shuffle(pairs)
    for a, b in pairs:
        x = round((a.x + b.x) / 2 + rng.uniform(-0.01, 0.01), 3)
        z = round((a.z + b.z) / 2 + rng.uniform(-0.01, 0.01), 3)
        if _in_area(x, z) and len(_supports(floor, x, z)) >= 2 and all(math.hypot(x - t.x, z - t.z) >= 0.18 for t in top):
            return x, z, rest_height(floor, x, z)
    gap = MIN_GAP
    while True:  # 자리가 안 나면 아주 조금씩 좁힌다
        gap -= 0.005
        spot = free_floor(gap, 400)
        if spot:
            return spot[0], spot[1], 0.0


def rest_height(floor: list[DollSpot], x: float, z: float) -> float:
    """받쳐 주는 인형들의 둥근 윗면(체형 폭) 가운데 가장 높은 곳에서 조금 파묻힌 높이."""
    top = 0.0
    for s in _supports(floor, x, z):
        top = max(top, DOLL_H / 2 + DOLL_H / 2 * math.sqrt(1 - (math.hypot(s.x - x, s.z - z) / (DOLL_W * BODY_W[s.body])) ** 2))
    return round(max(top - SINK, 0.0), 3)


def settle(spots: list[DollSpot]) -> list[DollSpot]:
    """위층 인형 높이를 지금 바닥으로 다시 잰다 (받침이 없으면 0 = 바닥 인형)."""
    floor = [s for s in spots if s.y == 0]
    return [replace(s, y=rest_height(floor, s.x, s.z)) if s.y > 0 else s for s in spots]


def take_out(spots: list[DollSpot], index: int) -> list[DollSpot]:
    """뽑혀 나간 인형을 뺀다. 그 인형이 받치던 위층 인형은 받침이 하나뿐이 되면 빈 자리로 내려앉는다(공중에 뜨지 않게)."""
    gone, rest = spots[index], [s for i, s in enumerate(spots) if i != index]
    if gone.y == 0:
        floor = [s for s in rest if s.y == 0]
        fallen = next((i for i, s in enumerate(rest) if s.y > 0 and len(_supports(floor, s.x, s.z)) < 2
                       and math.hypot(s.x - gone.x, s.z - gone.z) < DOLL_W * BODY_W[gone.body]), None)
        if fallen is not None:
            rest[fallen] = replace(rest[fallen], x=gone.x, z=gone.z, y=0.0)
    return settle(rest)


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


def claw_strength(x: float, z: float) -> float:
    """집게 힘 배율: 구멍 가장자리 0.75 → 구멍에서 가장 먼 모서리 1.25 (사용자 결정 2026-10-31 — 멀리 있는 인형은 세게, 가까운 인형은 약하게)."""
    hx, hz, hr = MACHINE_SPEC.hole
    w, d = MACHINE_SPEC.play_half
    far = max(math.hypot(cx - hx, cz - hz) for cx in (-w, w) for cz in (-d, d))
    t = min(max((math.hypot(x - hx, z - hz) - hr) / (far - hr), 0.0), 1.0)
    return 1.0 + STRENGTH_SPREAD * (2 * t - 1)


def judge(spots: list[DollSpot], x: float, z: float, roll: float) -> Grab:
    """roll은 0~1 난수. 손이 닿는 인형(체형만큼 넓거나 좁게) 중 가장 높이 있는 것(같으면 가까운 것)을 노린다."""
    near = [(i, math.hypot(s.x - x, s.z - z)) for i, s in enumerate(spots)]
    near = [(i, dist) for i, dist in near if dist <= PART_RADII[-1][1] * BODY_REACH[spots[i].body]]
    if not near:
        return Grab("miss", "none", None)
    index, distance = max(near, key=lambda c: (spots[c[0]].y, -c[1]))
    doll = spots[index]
    part = next(name for name, radius in PART_RADII if distance <= radius * BODY_REACH[doll.body])
    win, slip = ODDS[part]
    if doll.rare:
        factor = TIER_WIN["gold" if doll.rare == "gold" else "rare"]
        win, slip = win * factor, slip + win * (1 - factor)
    held = min(win * claw_strength(doll.x, doll.z), 1.0)  # 멀면 세게 쥐어 덜 떨어뜨리고, 가까우면 약해 더 떨어뜨린다
    win, slip = held, max(slip + win - held, 0.0)
    slip = min(max(slip + BODY_SLIP[doll.body], 0.0), 1.0 - win)
    outcome = "win" if roll < win else "slip" if roll < win + slip else "miss"
    return Grab(outcome, part, index)


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
            moved = replace(old, x=on_floor[0], z=on_floor[1], r=spin, y=0.0)
        elif candidates:
            x, z = candidates[0]
            moved = replace(old, x=x, z=z, r=spin, y=rest_height(floor, x, z))
    return [moved if i == index else s for i, s in enumerate(spots)]
