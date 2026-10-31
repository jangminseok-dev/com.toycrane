from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.pose_use_case import PoseUseCase
from toycrane.app.use_cases.pose_interactor import PoseInteractor


def get_pose_use_case(ctx, env) -> PoseUseCase:
    return PoseInteractor(AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), WsConnectionsAdapter(ctx))
