from toycrane.app.dtos.admission_dto import AdmissionQuery, AdmissionResult, UnknownGuest
from toycrane.app.ports.input.admission_use_case import AdmissionUseCase
from toycrane.app.ports.output.guest_repository import GuestRepository
from toycrane.app.ports.output.occupancy_port import OccupancyPort
from toycrane.domain.store_rules import choose_store


class AdmissionInteractor(AdmissionUseCase):
    """자리가 있는 매장을 정해 준다. 다 차면 만석(None)."""

    def __init__(self, guests: GuestRepository, occupancy: OccupancyPort, max_stores: int) -> None:
        self._guests = guests
        self._occupancy = occupancy
        self._max_stores = max_stores

    async def admit(self, query: AdmissionQuery) -> AdmissionResult:
        if await self._guests.get(query.guest_id) is None:
            raise UnknownGuest(query.guest_id)
        return AdmissionResult(store_no=choose_store(await self._occupancy.counts(), self._max_stores))
