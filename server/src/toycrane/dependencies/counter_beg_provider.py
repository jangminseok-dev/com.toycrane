import random

from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_wallet_adapter import D1WalletAdapter
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.counter_beg_use_case import CounterBegUseCase
from toycrane.app.use_cases.counter_beg_interactor import CounterBegInteractor


def get_counter_beg_use_case(ctx, env) -> CounterBegUseCase:
    return CounterBegInteractor(AttachmentPlayerRegistry(ctx), D1WalletAdapter(env.DB), WsConnectionsAdapter(ctx), random.Random())
