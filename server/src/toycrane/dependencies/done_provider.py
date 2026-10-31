from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_bag_adapter import D1BagAdapter
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.done_use_case import DoneUseCase
from toycrane.app.use_cases.done_interactor import DoneInteractor


def get_done_use_case(ctx, env) -> DoneUseCase:
    return DoneInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageMachineContents(ctx.storage, str(ctx.id), ctx),
        D1BagAdapter(env.DB), WsConnectionsAdapter(ctx),
    )
