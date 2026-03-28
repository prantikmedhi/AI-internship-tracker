"""
Notion integration module — client, profile, CRUD, and setup.
"""

from internship_agent.notion.client import get_notion, resolve_id, dashify
from internship_agent.notion.profile import get_user_profile, _parse_profile_fields, scan_and_sync_profile, write_profile_pages
from internship_agent.notion.setup import (
    init_notion,
    create_root_workspace,
    create_profile_pages,
    create_internship_database,
    get_internships,
    create_internship,
    update_status,
    update_apply_timestamp,
)

# New modular readers and writers
from internship_agent.notion.resolver import resolve_page_id
from internship_agent.notion.reader import (
    read_page_blocks,
    read_database,
    read_file_attachments,
)
from internship_agent.notion.workspace import (
    get_workspace_overview,
    search_workspace,
)
from internship_agent.notion.writer import (
    create_page,
    create_database,
    append_text_to_page,
    delete_block,
    update_page,
)
from internship_agent.notion.database import (
    add_row,
    update_row,
    add_column,
)

__all__ = [
    # Legacy exports
    "get_notion",
    "resolve_id",
    "dashify",
    "get_user_profile",
    "_parse_profile_fields",
    "scan_and_sync_profile",
    "write_profile_pages",
    "init_notion",
    "create_root_workspace",
    "create_profile_pages",
    "create_internship_database",
    "get_internships",
    "create_internship",
    "update_status",
    "update_apply_timestamp",
    # New modular exports
    "resolve_page_id",
    "read_page_blocks",
    "read_database",
    "read_file_attachments",
    "get_workspace_overview",
    "search_workspace",
    "create_page",
    "create_database",
    "append_text_to_page",
    "delete_block",
    "update_page",
    "add_row",
    "update_row",
    "add_column",
]
