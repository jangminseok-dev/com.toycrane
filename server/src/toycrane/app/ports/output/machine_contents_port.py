from abc import ABC, abstractmethod

from toycrane.domain.stock import MachineStock


class MachineContentsPort(ABC):
    """매장의 기계 속 인형과 다음 채울 시각 (DO 저장소 — 잠들었다 깨도, 배포해도 남는다)."""

    @abstractmethod
    async def load(self) -> dict[str, MachineStock]: ...

    @abstractmethod
    async def save(self, stocks: dict[str, MachineStock]) -> None:
        """가장 이른 채울 시각(due)도 함께 저장한다."""

    @abstractmethod
    async def due_at(self) -> float | None:
        """매장에서 가장 먼저 채울 시각만 (메시지마다 부르므로 가볍게)."""
