import random

from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.domain.layout import MACHINE_IDS, MACHINES, PUSHERS
from toycrane.domain.pusher_crane import generate_mixed_stock
from toycrane.domain.stock import MachineStock, generate_stock


async def ensure_contents(port: MachineContentsPort, rng: random.Random) -> dict[str, MachineStock]:
    """저장된 기계에 없는 기계만 새로 채우고, 새로 만든 게 있으면 한 번 저장한다. 미는 뽑기 기계도 같은 저장에 기계 번호로 든다(섞인 미니 인형)."""
    stocks = await port.load()
    missing = [m for m in (*MACHINE_IDS, *PUSHERS) if m not in stocks]
    for m in missing:
        stocks[m] = generate_mixed_stock(rng) if m in PUSHERS else generate_stock(MACHINES[m].kind, rng)
    if missing:
        await port.save(stocks)
    return stocks
