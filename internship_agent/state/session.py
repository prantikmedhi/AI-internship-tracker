"""
Per-chat session state management — enables "apply to internship 2" functionality.
"""

from dataclasses import dataclass, field


@dataclass
class Session:
    """Stores search results and preferences for a chat session."""
    last_results: list = field(default_factory=list)
    last_query: str = ""
    last_location: str = ""

    def get_by_number(self, n: int):
        """Get job by numeric index (1-based)."""
        if 1 <= n <= len(self.last_results):
            return self.last_results[n - 1]
        return None

    def get_by_name(self, name: str):
        """Get job by company/role name substring match."""
        name_lower = name.lower()
        for j in self.last_results:
            company = j.get("company", "").lower()
            role = j.get("role", "").lower()
            if name_lower in company or name_lower in role:
                return j
        return None

    def resolve(self, user_input: str):
        """
        Resolve user input to job(s).
        Supports: "2" (by number), "all" (all results), "google" (by name).

        Returns:
            Single job dict, list of jobs, or None
        """
        s = user_input.strip()

        # By number
        if s.isdigit():
            return self.get_by_number(int(s))

        # All
        if s.lower() == "all":
            return self.last_results

        # By name
        return self.get_by_name(s)


# Global session storage (would be per-chat in production)
_sessions = {}


def get_session(chat_id: str) -> Session:
    """Get or create a session for a chat."""
    if chat_id not in _sessions:
        _sessions[chat_id] = Session()
    return _sessions[chat_id]


def update_session(chat_id: str, results: list, query: str, location: str) -> None:
    """Update session with new search results."""
    session = get_session(chat_id)
    session.last_results = results
    session.last_query = query
    session.last_location = location
