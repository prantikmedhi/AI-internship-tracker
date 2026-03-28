"""
Notion SDK singleton and ID resolution utilities.
"""

import re
from notion_client import Client as NotionClient
from config import NOTION_API_KEY
from internship_agent.log.logger import log


# Singleton Notion client
_notion_instance = None


def get_notion() -> NotionClient:
    """Get or create the Notion client singleton."""
    global _notion_instance
    if _notion_instance is None:
        if not NOTION_API_KEY:
            raise ValueError("NOTION_API_KEY not set in environment")
        _notion_instance = NotionClient(auth=NOTION_API_KEY)
    return _notion_instance


# NOTE: Do NOT instantiate at module level — call get_notion() lazily when needed
# The old `notion = get_notion()` caused issues with schema caching and timing


def dashify(val: str) -> str:
    """Convert 32-char UUID to dashed format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"""
    v = str(val).replace("-", "")
    if len(v) == 32:
        return f"{v[:8]}-{v[8:12]}-{v[12:16]}-{v[16:20]}-{v[20:]}"
    return str(val)


def resolve_id(text: str) -> str:
    """
    Extracts a valid 32-char UUID from text or intelligently searches Notion for matching titles.
    Returns a dashed UUID string.
    Raises ValueError if no match found.
    """
    if not text:
        raise ValueError("Error: You must provide a valid parent page name or 32-character ID.")

    text = str(text).split("?")[0]

    # Try to extract UUID directly
    match = re.search(r'([a-fA-F0-9]{8}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{12})', text)
    if match:
        return dashify(match.group(1))

    # Auto-resolve using search
    if len(text) > 2:
        log.info(f"Auto-resolving page name '{text}' to UUID...")
        try:
            results = notion.search(query=text, sort={"direction": "descending", "timestamp": "last_edited_time"})
            pages = results.get("results", [])

            matches = []
            for page in pages:
                title = "Untitled"
                if page["object"] == "page":
                    props = page.get("properties", {})
                    for prop_data in props.values():
                        if prop_data.get("type") == "title" and prop_data.get("title"):
                            title = prop_data["title"][0]["plain_text"]
                elif page["object"] == "database":
                    try:
                        title = page["title"][0]["plain_text"]
                    except:
                        pass

                if text.lower() in title.lower():
                    matches.append((title, dashify(page.get("id", ""))))

            if len(matches) == 1:
                return matches[0][1]
            elif len(matches) > 1:
                exact_matches = [m for m in matches if m[0].lower() == text.lower()]
                if len(exact_matches) == 1:
                    return exact_matches[0][1]

                titles = list(set([m[0] for m in matches]))
                if len(titles) == 1:
                    return matches[0][1]

                # Multiple matches with different titles — silently pick the first (most recently edited)
                return matches[0][1]

            elif len(pages) > 0:
                return dashify(pages[0].get("id", ""))

        except Exception as e:
            if isinstance(e, ValueError):
                raise e
            log.error(f"Failed to auto-resolve: {e}")

    # No match from keyword search — try one broader search before giving up
    try:
        broad_results = notion.search(query=text, page_size=1).get("results", [])
        if broad_results:
            return dashify(broad_results[0].get("id", ""))
    except Exception:
        pass

    raise ValueError(f"Error: Could not find any Notion page matching '{text}'. Try a different page name.")
