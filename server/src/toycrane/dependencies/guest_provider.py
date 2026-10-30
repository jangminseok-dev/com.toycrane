import random
import time
import uuid

from toycrane.adapter.outbound.d1_guest_repository import D1GuestRepository
from toycrane.app.ports.input.guest_use_case import GuestUseCase
from toycrane.app.use_cases.guest_interactor import GuestInteractor

AVATAR_COLORS = 8


def get_guest_use_case(env) -> GuestUseCase:
    return GuestInteractor(
        D1GuestRepository(env.DB),
        new_id=lambda: uuid.uuid4().hex,
        clock=time.time,
        pick_color=lambda: random.randrange(AVATAR_COLORS),
    )
