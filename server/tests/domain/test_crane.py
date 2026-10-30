import math
import random

from toycrane.domain.catalog import DOLLS
from toycrane.domain.crane import generate_contents
from toycrane.domain.layout import MACHINE_SPEC


def test_generated_contents_stay_in_play_area_and_out_of_hole():
    spots = generate_contents("soft", random.Random(1))
    assert len(spots) == 9
    hx, hz, hr = MACHINE_SPEC.hole
    for s in spots:
        assert abs(s.x) <= 0.44 and abs(s.z) <= 0.38
        assert math.hypot(s.x - hx, s.z - hz) >= hr
        assert DOLLS[s.kind].set == "soft"


def test_generated_contents_are_repeatable_for_a_seed():
    assert generate_contents("water", random.Random(7)) == generate_contents("water", random.Random(7))
