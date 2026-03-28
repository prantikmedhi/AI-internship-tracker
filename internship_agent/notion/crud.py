"""
All 13 Notion CRUD operations extracted from main.py.
"""

import json
from internship_agent.notion.client import get_notion, resolve_id
from internship_agent.log.logger import log


def get_notion_client():
    """Get Notion client."""
    notion = get_notion()
    if not notion:
        raise RuntimeError("Notion client not initialized.")
    return notion


def get_workspace_overview() -> str:
    """Returns a list of the 30 most recently edited pages and databases in the entire Notion workspace."""
    try:
        notion = get_notion_client()
        results = notion.search(sort={"direction": "descending", "timestamp": "last_edited_time"}, page_size=30)
        output = []
        for item in results.get("results", []):
            title = "Untitled"
            if item["object"] == "page":
                props = item.get("properties", {})
                for prop_data in props.values():
                    if prop_data.get("type") == "title" and prop_data.get("title"):
                        title = prop_data["title"][0]["plain_text"]
            elif item["object"] == "database":
                try:
                    title = item["title"][0]["plain_text"]
                except:
                    pass
            url = item.get("url", "")
            id_ = item.get("id", "")
            output.append(f"- [{item['object'].upper()}] Title: {title} | ID: {id_} | URL: {url}")

        return "Workspace Overview (Recent 30 items):\n" + "\n".join(output) if output else "The workspace is currently empty."
    except Exception as e:
        return f"Error gathering workspace overview: {str(e)}"


def search_notion(query: str) -> str:
    """Searches Notion for pages/databases and returns their titles, IDs, types, and last edited time."""
    try:
        notion = get_notion_client()
        results = notion.search(query=query, sort={"direction": "descending", "timestamp": "last_edited_time"})
        output = []
        for item in results.get("results", [])[:10]:
            title = "Untitled"
            if item["object"] == "page":
                props = item.get("properties", {})
                for prop_data in props.values():
                    if prop_data.get("type") == "title" and prop_data.get("title"):
                        title = prop_data["title"][0]["plain_text"]
            elif item["object"] == "database":
                try:
                    title = item["title"][0]["plain_text"]
                except:
                    pass
            last_edited = item.get("last_edited_time", "")
            obj_type = item["object"].upper()
            id_ = item.get("id", "")
            output.append(f"- [{obj_type}] Title: \"{title}\" | ID: {id_} | Last edited: {last_edited}")
        return "Search results:\n" + "\n".join(output) if output else "No results found for that query."
    except Exception as e:
        return f"Error: {str(e)}"


def read_notion_blocks(target_id: str) -> str:
    """Reads the content blocks of a standard Notion page (but NOT rows of a database)."""
    try:
        notion = get_notion_client()
        target_id = resolve_id(target_id)
        results = notion.blocks.children.list(block_id=target_id)
        output = []
        for block in results.get("results", []):
            b_type = block["type"]
            b_id = block["id"]
            if b_type in ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do", "toggle", "quote"]:
                try:
                    text_arr = block[b_type].get("rich_text", [])
                    text = "".join([t.get("plain_text", "") for t in text_arr])
                    output.append(f"[{b_id} | {b_type}] {text}")
                except Exception:
                    pass
        return "\n".join(output) if output else "No readable text blocks found on this page. (If this is a Database, use read_notion_database instead)."
    except Exception as e:
        return f"Error reading page: {str(e)}"


def read_notion_database(database_id: str) -> str:
    """Reads the rows and columns of a Notion database."""
    try:
        notion = get_notion_client()
        database_id = resolve_id(database_id)
        results = notion.databases.query(database_id=database_id)
        pages = results.get("results", [])
        if not pages:
            return "This database is empty."

        output = []
        for i, page in enumerate(pages[:15]):
            props = page.get("properties", {})
            row_data = []
            for prop_name, prop_val in props.items():
                val_str = ""
                p_type = prop_val.get("type", "")
                if p_type == "title" and prop_val["title"]:
                    val_str = prop_val["title"][0]["plain_text"]
                elif p_type == "rich_text" and prop_val["rich_text"]:
                    val_str = "".join([t["plain_text"] for t in prop_val["rich_text"]])
                elif p_type == "number" and prop_val["number"] is not None:
                    val_str = str(prop_val["number"])
                elif p_type == "select" and prop_val["select"]:
                    val_str = prop_val["select"]["name"]
                elif p_type == "multi_select":
                    val_str = ", ".join([s["name"] for s in prop_val["multi_select"]])
                elif p_type == "date" and prop_val["date"]:
                    val_str = prop_val["date"].get("start", "")
                elif p_type == "checkbox":
                    val_str = "Yes" if prop_val["checkbox"] else "No"
                elif p_type == "url" and prop_val["url"]:
                    val_str = prop_val["url"]

                if val_str:
                    row_data.append(f"{prop_name}: {val_str}")

            row_str = " | ".join(row_data) if row_data else "Empty Row"
            output.append(f"Row {i+1} [ID: {page['id']}]: {row_str}")

        return "\n".join(output)
    except Exception as e:
        return f"Error querying database: {str(e)}"


def read_notion_file(page_id: str) -> str:
    """Downloads and reads all file attachments (PDF, DOCX, XLSX, CSV, PPTX) from a Notion page."""
    try:
        import requests, tempfile, os
        from PyPDF2 import PdfReader
        from docx import Document

        notion = get_notion_client()
        page_id = resolve_id(page_id)
        blocks = notion.blocks.children.list(block_id=page_id)
        output = []

        for block in blocks.get("results", []):
            b_type = block.get("type", "")
            if b_type not in ("file", "pdf", "image"):
                continue

            file_data = block.get(b_type, {})
            url = file_data.get("file", {}).get("url") or file_data.get("external", {}).get("url")
            name = file_data.get("name", "unknown_file")

            if not url:
                continue

            log.info(f"Downloading file: {name} from {url[:80]}...")
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()

            ext = os.path.splitext(name.split("?")[0])[1].lower()
            content_bytes = resp.content
            text = ""

            if ext == ".pdf":
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(content_bytes)
                    tmp_path = tmp.name
                try:
                    reader = PdfReader(tmp_path)
                    text = "\n".join([page.extract_text() for page in reader.pages])
                finally:
                    os.unlink(tmp_path)

            elif ext in [".docx", ".doc"]:
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                    tmp.write(content_bytes)
                    tmp_path = tmp.name
                try:
                    doc = Document(tmp_path)
                    text = "\n".join([p.text for p in doc.paragraphs])
                finally:
                    os.unlink(tmp_path)

            elif ext in [".csv"]:
                text = content_bytes.decode("utf-8", errors="ignore")

            elif ext in [".xlsx"]:
                import openpyxl
                with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                    tmp.write(content_bytes)
                    tmp_path = tmp.name
                try:
                    wb = openpyxl.load_workbook(tmp_path)
                    text = "\n".join([f"Sheet: {ws.title}" for ws in wb.sheetnames])
                finally:
                    os.unlink(tmp_path)

            if text:
                output.append(f"[{name}]\n{text[:2000]}")

        return "\n\n".join(output) if output else "No files found on this page."
    except Exception as e:
        return f"Error reading files: {str(e)}"


def create_notion_page(parent_id: str, title: str, content: str) -> str:
    """Creates a basic page under a parent page or a database."""
    try:
        notion = get_notion_client()
        parent_id = resolve_id(parent_id)
        new_page = notion.pages.create(
            parent={"page_id": parent_id},
            properties={"title": [{"text": {"content": title}}]},
            children=[{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}}]
        )
        return f"Page '{title}' created successfully."
    except Exception as e:
        err = str(e)
        try:
            notion = get_notion_client()
            db_info = notion.databases.retrieve(database_id=parent_id)
            title_prop_name = "Name"
            for prop_name, prop_data in db_info.get("properties", {}).items():
                if prop_data.get("type") == "title":
                    title_prop_name = prop_name
                    break

            new_page = notion.pages.create(
                parent={"database_id": parent_id},
                properties={title_prop_name: {"title": [{"text": {"content": title}}]}},
                children=[{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}}]
            )
            return f"New row '{title}' added to the database."
        except Exception as e2:
            return f"Error creating page: {err}. Also failed to insert as database row: {str(e2)}"


def create_notion_database(parent_page_id: str, title: str) -> str:
    """Creates a basic database in Notion under a parent page."""
    try:
        notion = get_notion_client()
        parent_page_id = resolve_id(parent_page_id)
        new_db = notion.databases.create(
            parent={"type": "page_id", "page_id": parent_page_id},
            title=[{"type": "text", "text": {"content": title}}],
            properties={"Name": {"title": {}}}
        )
        return f"Database '{title}' created successfully."
    except Exception as e:
        return f"Error creating database: {str(e)}"


def append_text_to_notion(target_id: str, text: str) -> str:
    """Appends a paragraph of text to an existing Notion page."""
    try:
        notion = get_notion_client()
        target_id = resolve_id(target_id)
        notion.blocks.children.append(
            block_id=target_id,
            children=[{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]}}]
        )
        return "Content appended successfully."
    except Exception as e:
        err = str(e)
        if "database" in err.lower() or "children" in err.lower():
            return f"Error: Cannot append to database. Use create_notion_page to add rows instead."
        return f"Error appending: {err}"


def delete_notion_block(block_id: str) -> str:
    """Deletes or archives a specific Notion block or child page."""
    try:
        notion = get_notion_client()
        block_id = resolve_id(block_id)
        notion.blocks.delete(block_id=block_id)
        return "Deleted successfully."
    except Exception as e:
        return f"Error deleting: {str(e)}"


def update_notion_page(page_id: str, title: str = "", content: str = "") -> str:
    """Updates an existing page's title and/or appends new content."""
    try:
        notion = get_notion_client()
        page_id = resolve_id(page_id)
        if title:
            notion.pages.update(page_id=page_id, properties={"title": [{"text": {"content": title}}]})
        if content:
            notion.blocks.children.append(
                block_id=page_id,
                children=[{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}}]
            )
        parts = []
        if title:
            parts.append(f"title updated to '{title}'")
        if content:
            parts.append("new content appended")
        return ("Page updated: " + " and ".join(parts) + ".") if parts else "Page updated."
    except Exception as e:
        return f"Error updating page: {str(e)}"


def add_database_row(database_id: str, properties_json: str) -> str:
    """Adds a new row to a Notion database with typed property values."""
    try:
        notion = get_notion_client()
        database_id = resolve_id(database_id)
        props_dict = json.loads(properties_json)

        db_schema = notion.databases.retrieve(database_id=database_id)
        db_props = db_schema.get("properties", {})

        notion_props = {}
        for prop_name, prop_value in props_dict.items():
            if prop_name not in db_props:
                continue
            prop_type = db_props[prop_name].get("type")

            try:
                if prop_type == "title":
                    notion_props[prop_name] = {"title": [{"text": {"content": str(prop_value)}}]}
                elif prop_type == "rich_text":
                    notion_props[prop_name] = {"rich_text": [{"text": {"content": str(prop_value)}}]}
                elif prop_type == "number":
                    notion_props[prop_name] = {"number": float(prop_value)}
                elif prop_type == "select":
                    notion_props[prop_name] = {"select": {"name": str(prop_value)}}
                elif prop_type == "multi_select":
                    options = [{"name": v.strip()} for v in str(prop_value).split(",")]
                    notion_props[prop_name] = {"multi_select": options}
                elif prop_type == "date":
                    notion_props[prop_name] = {"date": {"start": str(prop_value)}}
                elif prop_type == "checkbox":
                    notion_props[prop_name] = {"checkbox": bool(prop_value)}
                elif prop_type == "url":
                    notion_props[prop_name] = {"url": str(prop_value)}
            except Exception as type_err:
                return f"Error setting property '{prop_name}': {str(type_err)}"

        notion.pages.create(parent={"database_id": database_id}, properties=notion_props)
        return "Row added successfully to your database."
    except json.JSONDecodeError:
        return "Error: properties_json is not valid JSON."
    except Exception as e:
        return f"Error adding row: {str(e)}"


def update_database_row(row_id: str, properties_json: str) -> str:
    """Updates an existing database row's property values."""
    try:
        notion = get_notion_client()
        row_id = resolve_id(row_id)
        props_dict = json.loads(properties_json)

        row_page = notion.pages.retrieve(page_id=row_id)
        parent = row_page.get("parent", {})
        database_id = parent.get("database_id")
        if not database_id:
            return f"Error: Row is not part of a database."

        db_schema = notion.databases.retrieve(database_id=database_id)
        db_props = db_schema.get("properties", {})

        notion_props = {}
        for prop_name, prop_value in props_dict.items():
            if prop_name not in db_props:
                continue
            prop_type = db_props[prop_name].get("type")

            try:
                if prop_type == "title":
                    notion_props[prop_name] = {"title": [{"text": {"content": str(prop_value)}}]}
                elif prop_type == "rich_text":
                    notion_props[prop_name] = {"rich_text": [{"text": {"content": str(prop_value)}}]}
                elif prop_type == "number":
                    notion_props[prop_name] = {"number": float(prop_value)}
                elif prop_type == "select":
                    notion_props[prop_name] = {"select": {"name": str(prop_value)}}
                elif prop_type == "multi_select":
                    options = [{"name": v.strip()} for v in str(prop_value).split(",")]
                    notion_props[prop_name] = {"multi_select": options}
                elif prop_type == "date":
                    notion_props[prop_name] = {"date": {"start": str(prop_value)}}
                elif prop_type == "checkbox":
                    notion_props[prop_name] = {"checkbox": bool(prop_value)}
                elif prop_type == "url":
                    notion_props[prop_name] = {"url": str(prop_value)}
            except Exception as type_err:
                return f"Error setting property '{prop_name}': {str(type_err)}"

        notion.pages.update(page_id=row_id, properties=notion_props)
        return "Row updated successfully."
    except json.JSONDecodeError:
        return "Error: properties_json is not valid JSON."
    except Exception as e:
        return f"Error updating row: {str(e)}"


def add_database_property(database_id: str, property_name: str, property_type: str) -> str:
    """Adds a new column (property) to a Notion database."""
    try:
        notion = get_notion_client()
        database_id = resolve_id(database_id)
        type_map = {
            "text": {"rich_text": {}},
            "number": {"number": {"format": "number"}},
            "select": {"select": {"options": []}},
            "multi_select": {"multi_select": {"options": []}},
            "date": {"date": {}},
            "checkbox": {"checkbox": {}},
            "url": {"url": {}}
        }

        if property_type not in type_map:
            return f"Error: property_type must be one of: {', '.join(type_map.keys())}"

        type_schema = type_map[property_type]
        notion.databases.update(database_id=database_id, properties={property_name: type_schema})
        return f"Column '{property_name}' ({property_type}) added to your database."
    except Exception as e:
        return f"Error adding property: {str(e)}"
