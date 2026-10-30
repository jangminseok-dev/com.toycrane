from collections.abc import Callable

from toycrane.app.dtos.guest_dto import CreateGuestCommand, FindGuestQuery, GuestView
from toycrane.app.ports.input.guest_use_case import GuestUseCase
from toycrane.app.ports.output.guest_repository import GuestRepository
from toycrane.domain.nickname import normalize_nickname


class GuestInteractor(GuestUseCase):
    """로그인 없는 게스트: 닉네임으로 만들고, 같은 브라우저가 다시 오면 되찾는다."""

    def __init__(
        self,
        repo: GuestRepository,
        new_id: Callable[[], str],
        clock: Callable[[], float],
        pick_color: Callable[[], int],
    ) -> None:
        self._repo = repo
        self._new_id = new_id
        self._clock = clock
        self._pick_color = pick_color

    async def create(self, cmd: CreateGuestCommand) -> GuestView:
        view = GuestView(guest_id=self._new_id(), nickname=normalize_nickname(cmd.nickname), color=self._pick_color())
        await self._repo.insert(view, self._clock())
        return view

    async def find(self, query: FindGuestQuery) -> GuestView | None:
        view = await self._repo.get(query.guest_id)
        if view is not None:
            await self._repo.touch(view.guest_id, self._clock())
        return view
