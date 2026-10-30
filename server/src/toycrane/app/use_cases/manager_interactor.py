from toycrane.app.dtos.manager_dto import ManagerQuery, ManagerResponse
from toycrane.app.ports.input.manager_use_case import ManagerUseCase
from toycrane.app.ports.output.manager_record_port import ManagerRecordPort


class ManagerInteractor(ManagerUseCase):
    """toycrane 서버 대장 — 서버가 실제로 하는 일을 소개한다."""

    def __init__(self, record: ManagerRecordPort) -> None:
        self._record = record

    async def introduce_myself(self, query: ManagerQuery) -> ManagerResponse:
        await self._record.record(subject="introduce_myself", note=f"{query.name} 자기소개 관찰")
        return ManagerResponse(
            name=query.name,
            introduction=(
                "온라인 인형뽑기방 toycrane의 서버입니다. 게스트 만들기·매장 배정·매장 웹소켓(이동 중계)을 "
                "제공합니다. 로그인은 없고 매장 하나에 50명까지 들어갑니다."
            ),
            endpoints=(
                "GET /api/myself — 이 소개",
                "POST /api/guest — 닉네임으로 게스트 만들기",
                "GET /api/guest/{id} — 게스트 되찾기",
                "POST /api/admission — 자리가 있는 매장 배정",
                "GET /ws/store/{n}?guest={id} — 매장 웹소켓(이동 중계)",
            ),
        )
