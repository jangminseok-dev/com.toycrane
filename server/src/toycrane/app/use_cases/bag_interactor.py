from toycrane.app.dtos.bag_dto import BagEntry, ListBagQuery
from toycrane.app.ports.input.bag_use_case import BagUseCase
from toycrane.app.ports.output.bag_port import BagPort


class BagInteractor(BagUseCase):
    """가방 보기(설계 2026-11-02 §5): 게스트 id를 아는 사람만 그 가방을 본다(지금 게스트 모델과 같음)."""

    def __init__(self, bag: BagPort) -> None:
        self._bag = bag

    async def list(self, query: ListBagQuery) -> list[BagEntry]:
        return await self._bag.items(query.guest_id)
