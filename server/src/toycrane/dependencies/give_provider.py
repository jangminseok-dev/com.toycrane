from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.give_use_case import GiveUseCase
from toycrane.app.use_cases.give_interactor import GiveInteractor


def get_give_use_case(ctx, env) -> GiveUseCase:
    return GiveInteractor(AttachmentPlayerRegistry(ctx), D1WalletAdapter(env.DB), WsConnectionsAdapter(ctx), AttachmentPlayLocks(ctx))
