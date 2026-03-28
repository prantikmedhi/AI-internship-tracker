"""
Smart context search for AI - automatically finds relevant Notion pages.
"""
import re


def extract_search_context(user_message: str, client) -> str:
    """
    Pre-searches Notion for pages mentioned in the user's message.

    Intelligently extracts:
    - Quoted phrases: "my resume", "my projects tracker"
    - Possessive patterns: "my resume", "my skills"
    - Meaningful nouns from short messages

    Args:
        user_message: User's message text
        client: Notion client

    Returns:
        Formatted context with found page IDs for AI to use
    """
    if not client:
        return ""

    # Extract quoted phrases
    quoted = (
        re.findall(r'"([^"]+)"', user_message) +
        re.findall(r"'([^']+)'", user_message)
    )

    # Extract "my X" patterns
    my_patterns = re.findall(
        r'\bmy\s+([a-zA-Z][a-zA-Z0-9 ]{1,30}?)(?:\s+page|\s+database|\s+db)?\b',
        user_message,
        re.IGNORECASE
    )

    # For short messages, extract meaningful nouns
    keywords = []
    word_count = len(user_message.split())

    if word_count <= 12:
        stopwords = {
            "give", "show", "what", "this", "that", "with", "from",
            "have", "does", "tell", "about", "need", "want", "make",
            "can", "the", "and", "for", "are", "but", "not", "you",
            "all", "any", "had", "her", "his", "him", "how", "its",
            "our", "out", "own", "see", "she", "who", "why"
        }
        for word in user_message.split():
            w = word.strip(".,?!").lower()
            if len(w) >= 4 and w not in stopwords:
                keywords.append(w)

    # Combine all keywords and remove duplicates
    all_keywords = list(dict.fromkeys(quoted + my_patterns + keywords))

    # Search for matching pages
    found = {}

    for keyword in all_keywords[:4]:  # Limit to 4 searches
        keyword = keyword.strip()
        if not keyword or len(keyword) < 2:
            continue

        try:
            results = client.search(query=keyword, page_size=3).get("results", [])

            for item in results:
                page_id = item.get("id", "")
                obj_type = item.get("object", "page")
                title = _extract_title(item)

                if page_id and page_id not in found:
                    found[page_id] = f'[{obj_type.upper()}] "{title}" → ID: {page_id}'

        except Exception:
            pass

    if not found:
        return ""

    # Format results for AI
    lines = "\n".join(found.values())
    return (
        "\n\n[NOTION PAGES FOUND — USE THESE IMMEDIATELY]:\n"
        f"{lines}\n"
        "Now use the IDs above to read content and analyze automatically.\n"
    )


def _extract_title(page: dict) -> str:
    """Extract title from a Notion page or database object."""
    if page["object"] == "page":
        for prop in page.get("properties", {}).values():
            if prop.get("type") == "title" and prop.get("title"):
                try:
                    return prop["title"][0]["plain_text"]
                except (KeyError, IndexError, TypeError):
                    pass

    elif page["object"] == "database":
        try:
            return page["title"][0]["plain_text"]
        except (KeyError, IndexError, TypeError):
            pass

    return "Untitled"
