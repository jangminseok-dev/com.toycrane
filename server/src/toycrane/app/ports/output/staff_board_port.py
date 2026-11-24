from abc import ABC, abstractmethod

from toycrane.domain.staff import StaffBoard


class StaffBoardPort(ABC):
    """상주 직원 일정과 손님마다 부른 뒤 판 수 (DO 저장소 — 잠들었다 깨도 남는다)."""

    @abstractmethod
    async def load(self) -> StaffBoard: ...

    @abstractmethod
    async def save(self, board: StaffBoard) -> None: ...
