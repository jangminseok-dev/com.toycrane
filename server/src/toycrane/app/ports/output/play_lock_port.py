from abc import ABC, abstractmethod


class PlayLockPort(ABC):
    """기계 한 대 = 한 번에 한 사람 (접속마다 attachment에 둔다)."""

    @abstractmethod
    def holder(self, machine_id: str) -> tuple[str, float] | None:
        """(conn_id, 시작 시각)."""

    @abstractmethod
    def lock_of(self, conn_id: str) -> tuple[str, float] | None:
        """(machine_id, 시작 시각)."""

    @abstractmethod
    def lock(self, conn_id: str, machine_id: str, now: float) -> None: ...

    @abstractmethod
    def release(self, conn_id: str) -> None: ...

    @abstractmethod
    def plays(self) -> dict[str, str]:
        """기계 id → 하는 사람 player_id (welcome용)."""
