from abc import ABC, abstractmethod


class PlayLockPort(ABC):
    """기계 한 대 = 한 번에 한 사람 (접속마다 attachment에 둔다). 한 판 중이거나, 판 사이에 이어서 할 자리를 잡고 있다."""

    @abstractmethod
    def holder(self, machine_id: str) -> tuple[str, float] | None:
        """(conn_id, 시작 시각)."""

    @abstractmethod
    def lock_of(self, conn_id: str) -> tuple[str, float] | None:
        """(machine_id, 시작 시각)."""

    @abstractmethod
    def lock(self, conn_id: str, machine_id: str, now: float) -> None: ...

    @abstractmethod
    def hold(self, conn_id: str, machine_id: str, now: float) -> None:
        """한 판이 끝난 뒤 그 사람이 이어서 할 수 있게 자리를 잡아 둔다(판 사이)."""

    @abstractmethod
    def is_between(self, conn_id: str) -> bool:
        """잠금이 한 판 중이 아니라 판 사이에 잡아 둔 자리인가."""

    @abstractmethod
    def release(self, conn_id: str) -> None: ...

    @abstractmethod
    def plays(self) -> dict[str, str]:
        """기계 id → 하는 사람 player_id (welcome용)."""
