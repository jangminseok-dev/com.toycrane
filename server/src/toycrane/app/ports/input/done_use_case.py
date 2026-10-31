from abc import ABC, abstractmethod

from toycrane.app.dtos.done_dto import DoneCommand


class DoneUseCase(ABC):
    @abstractmethod
    async def done(self, cmd: DoneCommand) -> None: ...

    @abstractmethod
    async def refuse(self, cmd: DoneCommand) -> None:
        """읽을 수 없는 보고(NaN 등): 잠근 사람이면 done_no를 보내고 판 사이로 — 조용히 버리면 그 사람이 기계 화면에 갇힌다."""
