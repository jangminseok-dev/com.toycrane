"""기계 한 판 규칙: 20초 안에 내리기 → 집게 한 바퀴와 멈춤 대기(물리 뽑기 설계 §4.4) → 판이 끝나면 20초 동안 그 사람 자리.
시간은 타이머 없이 다음 메시지가 올 때 확인한다."""

from toycrane.domain.layout import MACHINE_SPEC, PUSHERS
from toycrane.domain.shared_data import CLAW, PUSHER

PLAY_SECONDS = MACHINE_SPEC.play_seconds  # 20
CYCLE_SECONDS = CLAW["cycle_seconds"] + CLAW["settle_seconds"]  # 15: 집게 한 바퀴 + 멈춤 대기
PUSHER_CYCLE_SECONDS = CLAW["cycle_seconds"] + PUSHER["settle"]["max"]  # 20: 미는 뽑기는 놓은 뒤 판이 멈출 때까지 기다린다(설계 ring-hook §4)
DROP_SLACK = 3.0  # 화면이 0초에 자동으로 내린 뒤 보고가 늦게 와도 받아 주는 여유


def expired(started: float, now: float, machine_id: str = "") -> bool:
    cycle = PUSHER_CYCLE_SECONDS if machine_id in PUSHERS else CYCLE_SECONDS
    return now > started + PLAY_SECONDS + cycle + DROP_SLACK


HOLD_SECONDS = MACHINE_SPEC.hold_seconds  # 20


def hold_over(since: float, now: float) -> bool:
    """판 사이에 잡아 둔 자리가 끝났다(그 사람이 이어서 하지 않았다)."""
    return now > since + HOLD_SECONDS
