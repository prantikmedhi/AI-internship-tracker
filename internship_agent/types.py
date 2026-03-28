"""
Shared data models for the internship automation system.
"""

from dataclasses import dataclass, field
from typing import TypedDict, Any
from enum import Enum, auto


# ──────────────────────────────────────────────────────────────────────────────
# Internship / Job Models
# ──────────────────────────────────────────────────────────────────────────────

class JobListing(TypedDict):
    """Basic job listing from scraper."""
    company: str
    role: str
    url: str
    location: str
    description: str
    tags: list[str]


class RankedJob(TypedDict):
    """Job listing with ranking/matching scores."""
    company: str
    role: str
    url: str
    location: str
    description: str
    tags: list[str]
    priority_score: int
    matched_skills: list[str]
    missing_skills: list[str]
    why_fits: str
    blocker: str


class SavedJob(TypedDict):
    """Job saved in Notion database."""
    company: str
    role: str
    url: str
    location: str
    description: str
    tags: list[str]
    priority_score: int
    matched_skills: list[str]
    missing_skills: list[str]
    why_fits: str
    blocker: str
    id: str
    status: str


# ──────────────────────────────────────────────────────────────────────────────
# Apply / Verification Models
# ──────────────────────────────────────────────────────────────────────────────

class ApplyStatus(Enum):
    """Truthful application status codes."""
    APPLIED_SUCCESSFULLY = auto()
    PARTIALLY_COMPLETED = auto()
    LOGIN_REQUIRED = auto()
    APPLICATION_BLOCKED = auto()
    UNSUPPORTED_FLOW = auto()
    FAILED = auto()


@dataclass
class ApplyResult:
    """Result of an apply attempt."""
    status: ApplyStatus
    message: str
    screenshot_path: str | None = None
    final_url: str | None = None
    page_title: str | None = None


# ──────────────────────────────────────────────────────────────────────────────
# Session / State Models
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Session:
    """Per-chat session state for tracking search results and selections."""
    last_results: list[dict] = field(default_factory=list)
    last_query: str = ""
    last_location: str = ""

    def get_by_number(self, n: int) -> dict | None:
        """Get job by 1-indexed number. Returns None if out of range."""
        if 1 <= n <= len(self.last_results):
            return self.last_results[n - 1]
        return None

    def get_by_name(self, name: str) -> dict | None:
        """Case-insensitive substring match on company or role."""
        name_lower = name.lower()
        for job in self.last_results:
            company = str(job.get("company", "")).lower()
            role = str(job.get("role", "")).lower()
            if name_lower in company or name_lower in role:
                return job
        return None

    def resolve(self, user_input: str) -> dict | list | None:
        """
        Resolve user input to a job or list of jobs.
        - "2" → get_by_number(2)
        - "all" → self.last_results
        - "Google" → get_by_name("Google")
        - Returns None if not found
        """
        stripped = user_input.strip()
        if stripped.isdigit():
            return self.get_by_number(int(stripped))
        if stripped.lower() == "all":
            return self.last_results
        return self.get_by_name(stripped)
