"""기계 한 판 규칙: 20초 안에 내리기, 시간은 타이머 없이 다음 메시지가 올 때 확인한다."""

from toycrane.domain.layout import MACHINE_SPEC

PLAY_SECONDS = MACHINE_SPEC.play_seconds  # 20
DROP_SLACK = 3.0  # 화면이 0초에 자동으로 내린 메시지가 늦게 와도 받아 주는 여유


def expired(started: float, now: float) -> bool:
    return now > started + PLAY_SECONDS + DROP_SLACK
