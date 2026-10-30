import pytest

from fakes import FakeGuestRepository
from toycrane.app.dtos.guest_dto import CreateGuestCommand, FindGuestQuery, GuestView
from toycrane.app.use_cases.guest_interactor import GuestInteractor
from toycrane.domain.nickname import InvalidNickname


async def test_create_normalizes_and_assigns_color():
    repo = FakeGuestRepository()
    uc = GuestInteractor(repo, new_id=lambda: "g-1", clock=lambda: 100.0, pick_color=lambda: 3)
    view = await uc.create(CreateGuestCommand(nickname="  말랑   토끼 "))
    assert view == GuestView(guest_id="g-1", nickname="말랑 토끼", color=3)
    assert repo.rows["g-1"] == (view, 100.0)


async def test_create_bad_nickname_stores_nothing():
    repo = FakeGuestRepository()
    with pytest.raises(InvalidNickname):
        await GuestInteractor(repo, lambda: "g-1", lambda: 0.0, lambda: 0).create(CreateGuestCommand(nickname=" "))
    assert repo.rows == {}


async def test_find_known_touches_last_seen():
    repo = FakeGuestRepository()
    repo.rows["g-1"] = (GuestView("g-1", "토끼", 3), 100.0)
    uc = GuestInteractor(repo, lambda: "x", lambda: 200.0, lambda: 0)
    assert await uc.find(FindGuestQuery("g-1")) == GuestView("g-1", "토끼", 3)
    assert repo.touched == [("g-1", 200.0)]


async def test_find_unknown_returns_none():
    uc = GuestInteractor(FakeGuestRepository(), lambda: "x", lambda: 0.0, lambda: 0)
    assert await uc.find(FindGuestQuery("nope")) is None
