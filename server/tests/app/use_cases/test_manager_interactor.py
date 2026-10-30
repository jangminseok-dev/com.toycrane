from fakes import FakeRecordPort
from toycrane.app.dtos.manager_dto import ManagerQuery
from toycrane.app.use_cases.manager_interactor import ManagerInteractor


async def test_introduce_myself_records_and_describes_real_endpoints():
    record = FakeRecordPort()
    result = await ManagerInteractor(record).introduce_myself(ManagerQuery(name="toycrane 매장 서버"))
    assert result.name == "toycrane 매장 서버"
    assert "POST /api/guest" in " ".join(result.endpoints)
    assert "/ws/store/{n}" in " ".join(result.endpoints)
    assert record.calls == [("introduce_myself", "toycrane 매장 서버 자기소개 관찰")]
