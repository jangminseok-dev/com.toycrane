from fakes import FakeBag
from toycrane.app.dtos.bag_dto import BagEntry, ListBagQuery
from toycrane.app.use_cases.bag_interactor import BagInteractor


# 가방 보기: 가방 저장소가 준 목록(처음 뽑은 때가 늦은 것부터)을 그대로, 없는 게스트는 빈 목록
async def test_bag_list_returns_the_guests_entries():
    entry = BagEntry("bear", 0, "", "big", 2, 10.0)
    uc = BagInteractor(FakeBag(entries={"g-1": [entry]}))
    assert await uc.list(ListBagQuery("g-1")) == [entry]
    assert await uc.list(ListBagQuery("nobody")) == []
