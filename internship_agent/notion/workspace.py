"""
Notion workspace operations - search and browse pages/databases.
"""
from internship_agent.common.helpers import extract_page_title


def get_workspace_overview(client) -> str:
    """
    Returns a list of the 30 most recently edited pages and databases.

    Args:
        client: Notion client

    Returns:
        Formatted overview of workspace items
    """
    if not client:
        return "Notion client not initialized."

    try:
        results = client.search(
            sort={"direction": "descending", "timestamp": "last_edited_time"},
            page_size=30
        )

        output = []
        for item in results.get("results", []):
            title = extract_page_title(item)
            url = item.get("url", "")
            item_id = item.get("id", "")
            item_type = item["object"].upper()

            output.append(
                f"- [{item_type}] Title: {title} | ID: {item_id} | URL: {url}"
            )

        if not output:
            return "The workspace is currently empty."

        return "Workspace Overview (Recent 30 items):\n" + "\n".join(output)

    except Exception as e:
        return f"Error gathering workspace overview: {str(e)}"


def search_workspace(query: str, client) -> str:
    """
    Searches the workspace for pages and databases.

    Returns the top 10 most recently edited matches.

    Args:
        query: Search keywords
        client: Notion client

    Returns:
        Formatted search results with metadata
    """
    if not client:
        return "Notion client not initialized."

    try:
        results = client.search(
            query=query,
            sort={"direction": "descending", "timestamp": "last_edited_time"}
        )

        output = []
        for item in results.get("results", [])[:10]:
            title = extract_page_title(item)
            last_edited = item.get("last_edited_time", "")
            item_type = item["object"].upper()
            item_id = item.get("id", "")

            output.append(
                f'- [{item_type}] Title: "{title}" | '
                f'ID: {item_id} | Last edited: {last_edited}'
            )

        if not output:
            return f"No results found for query: '{query}'"

        return "Search results:\n" + "\n".join(output)

    except Exception as e:
        return f"Error searching workspace: {str(e)}"
