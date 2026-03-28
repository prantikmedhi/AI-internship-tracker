# Quick Start - New Modular Structure

## What Changed?

**Old**: `main.py` (1310 lines of mixed code)
**New**: Clean modular structure with human-readable names

## File Organization

```
Notion Operations:
├── resolver.py      - Resolve page IDs
├── reader.py        - Read pages/databases/files
├── writer.py        - Create & update pages
├── database.py      - Database row operations
└── workspace.py     - Search & browse workspace

AI & Internships:
├── llm/search.py    - Smart context search
└── jobs/tracker.py  - [TODO] Job tracking

Main Entry Point:
└── app.py          - Clean Telegram bot (50 lines!)
```

## How to Use

### Import from modules (not main.py)

**Before** (old way - don't use):
```python
from main import read_notion_database, add_database_row
```

**After** (new way - use this):
```python
from internship_agent.notion import read_database, add_row

# Use it with Notion client
from internship_agent.notion import get_notion

notion = get_notion(api_key)
result = read_database("My Database", notion)
rows = add_row("Database Name", '{"Name": "Test"}', notion)
```

## Function Name Changes

| Old Name | New Name | Module |
|----------|----------|--------|
| `read_notion_blocks()` | `read_page_blocks()` | `notion/reader.py` |
| `read_notion_database()` | `read_database()` | `notion/reader.py` |
| `read_notion_file()` | `read_file_attachments()` | `notion/reader.py` |
| `create_notion_page()` | `create_page()` | `notion/writer.py` |
| `append_text_to_notion()` | `append_text_to_page()` | `notion/writer.py` |
| `delete_notion_block()` | `delete_block()` | `notion/writer.py` |
| `update_notion_page()` | `update_page()` | `notion/writer.py` |
| `add_database_row()` | `add_row()` | `notion/database.py` |
| `update_database_row()` | `update_row()` | `notion/database.py` |
| `add_database_property()` | `add_column()` | `notion/database.py` |
| `search_notion()` | `search_workspace()` | `notion/workspace.py` |
| `get_workspace_overview()` | `get_workspace_overview()` | `notion/workspace.py` |
| `resolve_id()` | `resolve_page_id()` | `notion/resolver.py` |

## Common Tasks

### Read a Database
```python
from internship_agent.notion import get_notion, read_database

notion = get_notion("your-api-key")
result = read_database("Internship Tracker", notion)
print(result)  # Shows all rows with column headers
```

### Add a Row
```python
from internship_agent.notion import get_notion, add_row

notion = get_notion("your-api-key")
properties = '{"Company": "Google", "Role": "SWE", "Status": "Applied"}'
result = add_row("Jobs Database", properties, notion)
```

### Search Pages
```python
from internship_agent.notion import get_notion, search_workspace

notion = get_notion("your-api-key")
result = search_workspace("resume", notion)
print(result)  # Shows matching pages with IDs
```

### Create a Page
```python
from internship_agent.notion import get_notion, create_page

notion = get_notion("your-api-key")
result = create_page(
    parent_id="My Workspace",
    title="New Page Title",
    content="Page content here",
    client=notion
)
```

## What's New?

### Better Database Display
The `read_database()` function now shows:
- ✅ Column headers clearly displayed
- ✅ All rows in table format
- ✅ Blank cells marked as `[blank]` (not hidden)
- ✅ Row IDs for reference

**Example output**:
```
COLUMNS: Company | Role | Status | Date
─────────────────────────────────────
Row 1 [ID: abc...]: Google | SWE | Applied | 2026-03-27
Row 2 [ID: def...]: Microsoft | PM | [blank] | [blank]
```

### Human-Readable Names
- ❌ `resolve_id()` → ✅ `resolve_page_id()`
- ❌ `read_notion_blocks()` → ✅ `read_page_blocks()`
- ❌ `add_database_row()` → ✅ `add_row()`

## Telegram Bot

**New entry point**: `app.py` (clean & readable!)

```bash
python app.py
```

**Available commands**:
- `/search <query>` - Search workspace
- `/read <page>` - Read page or database
- `/add_page <parent> | <title> | <content>` - Create page
- `/add_row <db> | <json>` - Add database row
- `/clear` - Clear memory

## Common Issues

### "Module not found" error?
Make sure you're importing from the right place:
```python
# ❌ Wrong
from main import read_notion_database

# ✅ Right
from internship_agent.notion import read_database
```

### Function signature changed?
Most functions now require `client` parameter:
```python
# ❌ Old (won't work)
read_notion_database("My DB")

# ✅ New (correct)
from internship_agent.notion import get_notion, read_database
notion = get_notion(api_key)
read_database("My DB", notion)
```

## Troubleshooting

### Database showing blank rows/columns?
That's **fixed**! The new `read_database()` function now shows:
- All column headers
- All rows with `[blank]` for empty cells
- Better formatting

### Files not extracting properly?
Make sure you have dependencies:
```bash
pip install pymupdf python-docx pandas python-pptx
```

## Next Steps

1. ✅ Replace imports in your code
2. ✅ Test with new module names
3. ✅ Delete old `main.py` when ready
4. ✅ Update any integration code

---

For full architecture details, see `ARCHITECTURE.md`
