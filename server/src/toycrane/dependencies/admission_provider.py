import time

from toycrane.adapter.outbound.d1_guest_repository import D1GuestRepository
from toycrane.adapter.outbound.d1_occupancy_adapter import D1OccupancyAdapter
from toycrane.app.ports.input.admission_use_case import AdmissionUseCase
from toycrane.app.use_cases.admission_interactor import AdmissionInteractor


def get_admission_use_case(env) -> AdmissionUseCase:
    return AdmissionInteractor(D1GuestRepository(env.DB), D1OccupancyAdapter(env.DB), max_stores=int(env.MAX_STORES), clock=time.time)
