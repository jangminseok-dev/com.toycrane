from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.play_start_use_case import PlayStartUseCase
from toycrane.app.use_cases.play_start_interactor import PlayStartInteractor


def get_play_start_use_case(ctx, env) -> PlayStartUseCase:
    return PlayStartInteractor(AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), D1WalletAdapter(env.DB), WsConnectionsAdapter(ctx))
