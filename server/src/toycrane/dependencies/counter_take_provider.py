from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.counter_take_use_case import CounterTakeUseCase
from toycrane.app.use_cases.counter_take_interactor import CounterTakeInteractor


def get_counter_take_use_case(ctx, env) -> CounterTakeUseCase:
    return CounterTakeInteractor(AttachmentPlayerRegistry(ctx), D1WalletAdapter(env.DB), WsConnectionsAdapter(ctx))
