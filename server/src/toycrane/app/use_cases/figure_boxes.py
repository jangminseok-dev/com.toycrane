import random

from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.domain.box_rules import BoxRules
from toycrane.domain.figure import FIGURE_RULES, FigureState


async def ensure_figures(port: FigureBoxesPort, rng: random.Random, rules: BoxRules = FIGURE_RULES) -> dict[str, FigureState]:
    """저장된 상자를 읽고, 상자가 없는 상자 기계(규칙의 기계들)에는 새 상자를 놓아 저장한다."""
    states = await port.load()
    missing = [m for m in rules.machines if m not in states]
    for m in missing:
        states[m] = FigureState(rules.start_box(rng, m), 0)
    if missing:
        await port.save(states)
    return states
