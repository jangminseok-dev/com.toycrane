from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_bag_adapter import D1BagAdapter
from toycrane.adapter.outbound.do_storage_pushers import DoStoragePusherShelves
from toycrane.adapter.outbound.do_storage_rings import DoStorageRingBoards
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.act_use_case import ActUseCase
from toycrane.app.use_cases.act_interactor import ActInteractor


def get_act_use_case(ctx, env) -> ActUseCase:
    return ActInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageRingBoards(ctx.storage), DoStoragePusherShelves(ctx.storage),
        D1BagAdapter(env.DB), WsConnectionsAdapter(ctx),
    )
