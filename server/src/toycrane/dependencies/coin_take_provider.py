from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.attachment_queue_registry import AttachmentQueueRegistry
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.coin_take_use_case import CoinTakeUseCase
from toycrane.app.use_cases.coin_take_interactor import CoinTakeInteractor


def get_coin_take_use_case(ctx, env) -> CoinTakeUseCase:
    return CoinTakeInteractor(AttachmentQueueRegistry(ctx), WsConnectionsAdapter(ctx), AttachmentPlayerRegistry(ctx), D1WalletAdapter(env.DB))
