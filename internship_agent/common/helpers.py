"""
Common helper utilities for the internship agent.
"""
import re
from typing import Any


def format_uuid(val: str) -> str:
    """Formats a 32-char UUID string into standard Notion format (8-4-4-4-12)."""
    v = val.replace("-", "")
    if len(v) == 32:
        return f"{v[:8]}-{v[8:12]}-{v[12:16]}-{v[16:20]}-{v[20:]}"
    return val


def extract_uuid(text: Any) -> str | None:
    """Extracts a UUID from text if present."""
    if not text:
        return None

    text = str(text).split("?")[0]
    match = re.search(
        r'([a-fA-F0-9]{8}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{12})',
        text
    )

    if match:
        return format_uuid(match.group(1))
    return None


def extract_page_title(page: dict) -> str:
    """Extracts the title from a Notion page or database object."""
    if page["object"] == "page":
        props = page.get("properties", {})
        for prop_data in props.values():
            if prop_data.get("type") == "title" and prop_data.get("title"):
                return prop_data["title"][0]["plain_text"]
    elif page["object"] == "database":
        try:
            return page["title"][0]["plain_text"]
        except (KeyError, IndexError, TypeError):
            pass

    return "Untitled"
