import random

from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_bag_adapter import D1BagAdapter
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.drop_use_case import DropUseCase
from toycrane.app.use_cases.drop_interactor import DropInteractor


def get_drop_use_case(ctx, env) -> DropUseCase:
    return DropInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageMachineContents(ctx.storage),
        D1BagAdapter(env.DB), WsConnectionsAdapter(ctx), random.Random(),
    )
