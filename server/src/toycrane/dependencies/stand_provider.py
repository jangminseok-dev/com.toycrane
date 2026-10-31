from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.stand_use_case import StandUseCase
from toycrane.app.use_cases.stand_interactor import StandInteractor


def get_stand_use_case(ctx, env) -> StandUseCase:
    return StandInteractor(AttachmentPlayLocks(ctx), WsConnectionsAdapter(ctx))
