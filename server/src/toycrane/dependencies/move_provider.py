from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.move_use_case import MoveUseCase
from toycrane.app.use_cases.move_interactor import MoveInteractor


def get_move_use_case(ctx, env) -> MoveUseCase:
    return MoveInteractor(AttachmentPlayerRegistry(ctx), WsConnectionsAdapter(ctx))
