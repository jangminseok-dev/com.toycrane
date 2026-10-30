import uuid

from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_occupancy_adapter import D1OccupancyAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.enter_use_case import EnterUseCase
from toycrane.app.use_cases.enter_interactor import EnterInteractor


def get_enter_use_case(ctx, env) -> EnterUseCase:
    return EnterInteractor(
        AttachmentPlayerRegistry(ctx),
        WsConnectionsAdapter(ctx),
        D1OccupancyAdapter(env.DB),
        new_player_id=lambda: uuid.uuid4().hex,
    )
