import random

from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.domain.crane import DollSpot, generate_contents
from toycrane.domain.layout import MACHINE_IDS, MACHINES


async def ensure_contents(port: MachineContentsPort, rng: random.Random) -> dict[str, list[DollSpot]]:
    """저장된 배치에 없는 기계만 새로 채우고, 새로 만든 게 있으면 한 번 저장한다."""
    contents = await port.load()
    missing = [m for m in MACHINE_IDS if m not in contents]
    for m in missing:
        contents[m] = generate_contents(MACHINES[m].kind, rng)
    if missing:
        await port.save(contents)
    return contents
