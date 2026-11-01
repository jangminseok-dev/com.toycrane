from toycrane.adapter.outbound.d1_bag_adapter import D1BagAdapter
from toycrane.app.ports.input.bag_use_case import BagUseCase
from toycrane.app.use_cases.bag_interactor import BagInteractor


def get_bag_use_case(env) -> BagUseCase:
    return BagInteractor(D1BagAdapter(env.DB))
