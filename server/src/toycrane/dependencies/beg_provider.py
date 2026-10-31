from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.beg_use_case import BegUseCase
from toycrane.app.use_cases.beg_interactor import BegInteractor


def get_beg_use_case(ctx, env) -> BegUseCase:
    return BegInteractor(AttachmentPlayerRegistry(ctx), D1WalletAdapter(env.DB), WsConnectionsAdapter(ctx), AttachmentPlayLocks(ctx))
