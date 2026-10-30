import pytest

from fakes import FakeGuestRepository, FakeOccupancy
from toycrane.app.dtos.admission_dto import AdmissionQuery, AdmissionResult, UnknownGuest
from toycrane.app.dtos.guest_dto import GuestView
from toycrane.app.use_cases.admission_interactor import AdmissionInteractor


async def test_admit_unknown_guest_raises():
    with pytest.raises(UnknownGuest):
        await AdmissionInteractor(FakeGuestRepository(), FakeOccupancy(), max_stores=4, clock=lambda: 10.0).admit(AdmissionQuery("nope"))


async def test_admit_returns_store():
    guests = FakeGuestRepository()
    guests.rows["g-1"] = (GuestView("g-1", "토끼", 3), 0.0)
    occ = FakeOccupancy(counts_value={1: 50})
    assert await AdmissionInteractor(guests, occ, max_stores=4, clock=lambda: 10.0).admit(AdmissionQuery("g-1")) == AdmissionResult(store_no=2)


async def test_admit_ignores_stale_full_count():
    # 배포로 모든 접속이 끊기면 "나감"이 기록되지 않아 50이 그대로 남을 수 있다.
    # 2분 넘게 갱신 없는 기록은 모르는 것으로 보고 다시 시도하게 한다 (최종 리뷰 #1)
    guests = FakeGuestRepository()
    guests.rows["g-1"] = (GuestView("g-1", "토끼", 3), 0.0)
    occ = FakeOccupancy(counts_value={1: 50}, at=0.0)
    assert await AdmissionInteractor(guests, occ, max_stores=4, clock=lambda: 1000.0).admit(AdmissionQuery("g-1")) == AdmissionResult(store_no=1)
    fresh = FakeOccupancy(counts_value={1: 50}, at=950.0)
    assert await AdmissionInteractor(guests, fresh, max_stores=4, clock=lambda: 1000.0).admit(AdmissionQuery("g-1")) == AdmissionResult(store_no=2)
