"""
Application automation module — form filling, verification, and submission.
"""

from internship_agent.apply.verifier import ApplyResult, ApplyStatus
from internship_agent.apply.engine import apply_to_job, apply_sync

__all__ = [
    "ApplyResult",
    "ApplyStatus",
    "apply_to_job",
    "apply_sync",
]
