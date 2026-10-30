from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.attachment_queue_registry import AttachmentQueueRegistry
from toycrane.adapter.outbound.d1_occupancy_adapter import D1OccupancyAdapter
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.leave_use_case import LeaveUseCase
from toycrane.app.use_cases.leave_interactor import LeaveInteractor


def get_leave_use_case(ctx, env) -> LeaveUseCase:
    return LeaveInteractor(
        AttachmentPlayerRegistry(ctx), WsConnectionsAdapter(ctx), D1OccupancyAdapter(env.DB),
        queues=AttachmentQueueRegistry(ctx), locks=AttachmentPlayLocks(ctx), wallet=D1WalletAdapter(env.DB),
    )
