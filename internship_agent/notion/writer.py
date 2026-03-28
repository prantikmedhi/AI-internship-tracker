"""
Notion content writers - create, update, and delete pages and databases.
"""
from internship_agent.notion.resolver import resolve_page_id


def create_page(parent_id: str, title: str, content: str, client) -> str:
    """
    Creates a new page under a parent page or database.

    Args:
        parent_id: Parent page UUID or name
        title: Page title
        content: Initial content text
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    parent_id = resolve_page_id(parent_id, client)

    try:
        # Try as standard page first
        client.pages.create(
            parent={"page_id": parent_id},
            properties={"title": [{"text": {"content": title}}]},
            children=[{
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}
            }]
        )
        return f"Page '{title}' created successfully."

    except Exception as e:
        # Try as database row
        try:
            db_info = client.databases.retrieve(database_id=parent_id)
            title_prop_name = "Name"

            for prop_name, prop_data in db_info.get("properties", {}).items():
                if prop_data.get("type") == "title":
                    title_prop_name = prop_name
                    break

            client.pages.create(
                parent={"database_id": parent_id},
                properties={title_prop_name: {"title": [{"text": {"content": title}}]}},
                children=[{
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}
                }]
            )
            return f"New row '{title}' added to the database."

        except Exception as e2:
            return f"Error: Could not create as page or database row. {str(e2)}"


def create_database(parent_page_id: str, title: str, client) -> str:
    """
    Creates a new database under a parent page.

    Args:
        parent_page_id: Parent page UUID or name
        title: Database title
        client: Notion client

    Returns:
        Database ID and URL on success
    """
    if not client:
        return "Notion client not initialized."

    parent_page_id = resolve_page_id(parent_page_id, client)

    try:
        new_db = client.databases.create(
            parent={"type": "page_id", "page_id": parent_page_id},
            title=[{"type": "text", "text": {"content": title}}],
            properties={"Name": {"title": {}}}
        )
        return f"Database created successfully!\nID: {new_db.get('id')}\nURL: {new_db.get('url')}"

    except Exception as e:
        return f"Error creating database: {str(e)}"


def append_text_to_page(page_id: str, text: str, client) -> str:
    """
    Appends a text block to an existing page.

    Args:
        page_id: Page UUID or name
        text: Text to append
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    page_id = resolve_page_id(page_id, client)

    try:
        client.blocks.children.append(
            block_id=page_id,
            children=[{
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]}
            }]
        )
        return f"Content appended successfully to ID {page_id}."

    except Exception as e:
        err_msg = str(e).lower()
        if "database" in err_msg or "children" in err_msg:
            return (
                f"Error: Cannot append text to database. "
                f"Use create_page to add rows instead."
            )
        return f"Error appending: {str(e)}"


def delete_block(block_id: str, client) -> str:
    """
    Deletes or archives a Notion block or child page.

    Args:
        block_id: Block UUID or page name
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    block_id = resolve_page_id(block_id, client)

    try:
        client.blocks.delete(block_id=block_id)
        return "Deleted successfully."

    except Exception as e:
        return f"Error deleting: {str(e)}"


def update_page(page_id: str, title: str = "", content: str = "", client=None) -> str:
    """
    Updates a page's title and/or appends new content.

    Args:
        page_id: Page UUID or name
        title: New title (optional)
        content: Content to append (optional)
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    page_id = resolve_page_id(page_id, client)

    try:
        if title:
            client.pages.update(
                page_id=page_id,
                properties={"title": [{"text": {"content": title}}]}
            )

        if content:
            client.blocks.children.append(
                block_id=page_id,
                children=[{
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}
                }]
            )

        parts = []
        if title:
            parts.append(f"title updated to '{title}'")
        if content:
            parts.append("new content appended")

        if parts:
            return "Page updated: " + " and ".join(parts) + "."
        return "Page updated."

    except Exception as e:
        return f"Error updating page: {str(e)}"
