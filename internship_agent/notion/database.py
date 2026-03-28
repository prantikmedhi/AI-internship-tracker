"""
Notion database operations - add/update rows and columns.
"""
import json

from internship_agent.notion.resolver import resolve_page_id


def add_row(database_id: str, properties_json: str, client) -> str:
    """
    Adds a new row to a database with typed property values.

    Properties are automatically converted to correct types based on schema.

    Args:
        database_id: Database UUID or name
        properties_json: JSON string like '{"Name": "Alice", "Status": "Active"}'
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    database_id = resolve_page_id(database_id, client)

    try:
        props_dict = json.loads(properties_json)
    except json.JSONDecodeError:
        return (
            "Error: properties_json is not valid JSON.\n"
            'Example: \'{"Name": "Alice", "Status": "Active"}\''
        )

    try:
        # Get schema to determine property types
        db_schema = client.databases.retrieve(database_id=database_id)
        db_props = db_schema.get("properties", {})

        # Build typed properties
        notion_props = _build_typed_properties(props_dict, db_props)

        # Create row
        client.pages.create(
            parent={"database_id": database_id},
            properties=notion_props
        )
        return "Row added successfully to your database."

    except Exception as e:
        return f"Error adding row: {str(e)}"


def update_row(row_id: str, properties_json: str, client) -> str:
    """
    Updates an existing database row's properties.

    Args:
        row_id: Row UUID or page name
        properties_json: JSON string of properties to update
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    row_id = resolve_page_id(row_id, client)

    try:
        props_dict = json.loads(properties_json)
    except json.JSONDecodeError:
        return "Error: properties_json is not valid JSON."

    try:
        # Get parent database
        row_page = client.pages.retrieve(page_id=row_id)
        parent = row_page.get("parent", {})
        database_id = parent.get("database_id")

        if not database_id:
            return f"Error: Row {row_id} is not part of a database."

        # Get schema
        db_schema = client.databases.retrieve(database_id=database_id)
        db_props = db_schema.get("properties", {})

        # Build typed properties
        notion_props = _build_typed_properties(props_dict, db_props)

        # Update row
        client.pages.update(page_id=row_id, properties=notion_props)
        return "Row updated successfully."

    except Exception as e:
        return f"Error updating row: {str(e)}"


def add_column(database_id: str, column_name: str, column_type: str, client) -> str:
    """
    Adds a new column to a database.

    Supported types: text, number, select, multi_select, date, checkbox, url

    Args:
        database_id: Database UUID or name
        column_name: Column name
        column_type: Column type (see supported types above)
        client: Notion client

    Returns:
        Success or error message
    """
    if not client:
        return "Notion client not initialized."

    database_id = resolve_page_id(database_id, client)

    type_map = {
        "text": {"rich_text": {}},
        "number": {"number": {"format": "number"}},
        "select": {"select": {"options": []}},
        "multi_select": {"multi_select": {"options": []}},
        "date": {"date": {}},
        "checkbox": {"checkbox": {}},
        "url": {"url": {}}
    }

    if column_type not in type_map:
        valid_types = ", ".join(type_map.keys())
        return f"Error: column_type must be one of: {valid_types}"

    try:
        type_schema = type_map[column_type]
        client.databases.update(
            database_id=database_id,
            properties={column_name: type_schema}
        )
        return f"Column '{column_name}' ({column_type}) added to your database."

    except Exception as e:
        return f"Error adding column: {str(e)}"


def _build_typed_properties(props_dict: dict, db_schema: dict) -> dict:
    """
    Converts raw property values to Notion API format based on schema.

    Args:
        props_dict: Raw property values
        db_schema: Database property schema

    Returns:
        Properties formatted for Notion API

    Raises:
        Exception: If property type conversion fails
    """
    notion_props = {}

    for prop_name, prop_value in props_dict.items():
        if prop_name not in db_schema:
            continue

        prop_type = db_schema[prop_name].get("type")

        try:
            if prop_type == "title":
                notion_props[prop_name] = {
                    "title": [{"text": {"content": str(prop_value)}}]
                }
            elif prop_type == "rich_text":
                notion_props[prop_name] = {
                    "rich_text": [{"text": {"content": str(prop_value)}}]
                }
            elif prop_type == "number":
                notion_props[prop_name] = {"number": float(prop_value)}
            elif prop_type == "select":
                notion_props[prop_name] = {"select": {"name": str(prop_value)}}
            elif prop_type == "multi_select":
                options = [
                    {"name": v.strip()}
                    for v in str(prop_value).split(",")
                ]
                notion_props[prop_name] = {"multi_select": options}
            elif prop_type == "date":
                notion_props[prop_name] = {"date": {"start": str(prop_value)}}
            elif prop_type == "checkbox":
                notion_props[prop_name] = {"checkbox": bool(prop_value)}
            elif prop_type == "url":
                notion_props[prop_name] = {"url": str(prop_value)}

        except Exception as e:
            raise Exception(f"Error setting property '{prop_name}': {str(e)}")

    return notion_props
