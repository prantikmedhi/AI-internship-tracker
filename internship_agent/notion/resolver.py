"""
Notion ID resolver - handles UUID extraction and page/database lookups.
"""
import re
from typing import Any

from internship_agent.common.helpers import (
    format_uuid,
    extract_uuid,
    extract_page_title,
)


def resolve_page_id(identifier: Any, client) -> str:
    """
    Resolves a page identifier to a valid UUID.

    Supports:
    - Direct UUID strings (formatted or unformatted)
    - Page/database names (auto-searches Notion)
    - Partial matches (returns most recently edited)

    Args:
        identifier: UUID string or page name
        client: Notion client instance

    Returns:
        Formatted UUID string

    Raises:
        ValueError: If identifier cannot be resolved
    """
    if not identifier:
        raise ValueError(
            "You must provide a valid page name or 32-character ID. "
            "Please ask the user where they want this created if not specified."
        )

    # Try direct UUID extraction first
    uuid = extract_uuid(str(identifier))
    if uuid:
        return uuid

    # Try auto-resolve via search
    text = str(identifier).split("?")[0]
    if not client or len(text) < 2:
        raise ValueError(f"Could not find any Notion page matching '{text}'.")

    # Search for matching pages/databases
    try:
        results = client.search(
            query=text,
            sort={"direction": "descending", "timestamp": "last_edited_time"}
        )
        pages = results.get("results", [])

        if not pages:
            raise ValueError(f"No Notion pages found matching '{text}'.")

        # Find best matches
        matches = []
        for page in pages:
            title = extract_page_title(page)
            if text.lower() in title.lower():
                matches.append((title, format_uuid(page.get("id", ""))))

        # Return exact match if found
        if len(matches) == 1:
            return matches[0][1]

        exact_matches = [
            m for m in matches
            if m[0].lower() == text.lower()
        ]
        if len(exact_matches) == 1:
            return exact_matches[0][1]

        # Prefer single unique title
        unique_titles = list(set(m[0] for m in matches))
        if len(unique_titles) == 1:
            return matches[0][1]

        # Return most recently edited as fallback
        if matches:
            return matches[0][1]

        # No keyword matches, try first result
        return format_uuid(pages[0].get("id", ""))

    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Error resolving '{text}': {str(e)}")
