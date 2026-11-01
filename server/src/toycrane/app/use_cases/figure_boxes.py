import random

from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.domain.figure import FigureState, start_box
from toycrane.domain.layout import FIGURES


async def ensure_figures(port: FigureBoxesPort, rng: random.Random) -> dict[str, FigureState]:
    """저장된 상자를 읽고, 상자가 없는 피규어 기계에는 새 상자를 놓아 저장한다."""
    states = await port.load()
    missing = [m for m in FIGURES if m not in states]
    for m in missing:
        states[m] = FigureState(start_box(rng, FIGURES[m].box), 0)
    if missing:
        await port.save(states)
    return states
