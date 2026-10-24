"""The four analysis readers, in the order n8n runs them (one after another)."""

from .base import Reader
from .conflict_09 import READER as CONFLICT_09
from .eye_03 import READER as EYE_03
from .room_06 import READER as ROOM_06
from .second_count_05 import READER as SECOND_COUNT_05

READERS: tuple[Reader, ...] = (EYE_03, SECOND_COUNT_05, ROOM_06, CONFLICT_09)

__all__ = ["Reader", "READERS", "EYE_03", "SECOND_COUNT_05", "ROOM_06", "CONFLICT_09"]
