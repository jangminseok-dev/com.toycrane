import pytest

from fakes import FakeGuestRepository, FakeOccupancy
from toycrane.app.dtos.admission_dto import AdmissionQuery, AdmissionResult, UnknownGuest
from toycrane.app.dtos.guest_dto import GuestView
from toycrane.app.use_cases.admission_interactor import AdmissionInteractor


async def test_admit_unknown_guest_raises():
    with pytest.raises(UnknownGuest):
        await AdmissionInteractor(FakeGuestRepository(), FakeOccupancy(), max_stores=4).admit(AdmissionQuery("nope"))


async def test_admit_returns_store():
    guests = FakeGuestRepository()
    guests.rows["g-1"] = (GuestView("g-1", "토끼", 3), 0.0)
    occ = FakeOccupancy(counts_value={1: 50})
    assert await AdmissionInteractor(guests, occ, max_stores=4).admit(AdmissionQuery("g-1")) == AdmissionResult(store_no=2)
