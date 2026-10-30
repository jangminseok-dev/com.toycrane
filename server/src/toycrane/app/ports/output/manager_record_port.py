from abc import ABC, abstractmethod


class ManagerRecordPort(ABC):
    """자기소개 같은 활동을 남기는 출구."""

    @abstractmethod
    async def record(self, subject: str, note: str) -> None: ...
