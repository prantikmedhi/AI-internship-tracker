# Notion MCP Phase 1 - Project Architecture

## Overview

This project is organized into clean, modular components with human-readable names and clear separation of concerns.

## Directory Structure

```
notion-mcp-phase1/
├── app.py                          # Main entry point - Telegram bot
├── ARCHITECTURE.md                 # This file
│
├── internship_agent/               # Main application package
│   ├── __init__.py
│   │
│   ├── common/                     # Shared utilities
│   │   ├── __init__.py
│   │   └── helpers.py              # UUID formatting, title extraction
│   │
│   ├── notion/                     # Notion API integration
│   │   ├── __init__.py
│   │   ├── client.py               # Notion client setup (existing)
│   │   ├── profile.py              # User profile management (existing)
│   │   ├── setup.py                # Workspace initialization (existing)
│   │   ├── crud.py                 # Legacy CRUD operations (existing)
│   │   │
│   │   ├── resolver.py             # ID resolution & page lookup
│   │   ├── reader.py               # Read pages, databases, files
│   │   ├── writer.py               # Create & update pages
│   │   ├── database.py             # Row & column operations
│   │   └── workspace.py            # Search & workspace browse
│   │
│   ├── llm/                        # AI & LLM operations
│   │   ├── __init__.py
│   │   ├── client.py               # LLM client setup (existing)
│   │   ├── extraction.py           # Data extraction (existing)
│   │   ├── ranking.py              # Job ranking (existing)
│   │   ├── resume.py               # Resume analysis (existing)
│   │   └── search.py               # Smart context search
│   │
│   ├── jobs/                       # Job search & applications
│   │   ├── __init__.py
│   │   ├── search.py               # Job search (existing)
│   │   ├── normalize.py            # Job normalization (existing)
│   │   └── tracker.py              # [TODO] Job tracking functions
│   │
│   ├── apply/                      # Application automation
│   │   ├── __init__.py
│   │   ├── engine.py               # Auto-apply engine (existing)
│   │   ├── fields.py               # Form field mapping (existing)
│   │   ├── internshala.py          # Internshala integration (existing)
│   │   └── verifier.py             # Application verification (existing)
│   │
│   ├── log/                        # Logging
│   │   ├── __init__.py
│   │   └── logger.py               # Logger setup (existing)
│   │
│   ├── state/                      # State management
│   │   ├── __init__.py
│   │   └── session.py              # Session state (existing)
│   │
│   ├── bot/                        # [TODO] Bot orchestration
│   │   └── __init__.py
│   │
│   └── types.py                    # Type definitions (existing)
│
├── .agent/                         # Agent scripts (existing)
│   ├── scripts/
│   └── skills/
│
└── tests/                          # [TODO] Unit tests
```

## Key Modules

### `internship_agent/common/helpers.py`
**Purpose**: Shared utility functions

**Functions**:
- `format_uuid(val: str)` - Format UUID to standard form
- `extract_uuid(text: Any)` - Extract UUID from text
- `extract_page_title(page: dict)` - Get title from page/database object

### `internship_agent/notion/resolver.py`
**Purpose**: Resolve page identifiers to UUIDs

**Functions**:
- `resolve_page_id(identifier, client)` - Convert page name or UUID to UUID

**Key Feature**: Smart auto-lookup if exact UUID not provided

### `internship_agent/notion/reader.py`
**Purpose**: Read content from Notion

**Functions**:
- `read_page_blocks(page_id, client)` - Read text blocks from a page
- `read_database(database_id, client)` - Read rows & columns from database
- `read_file_attachments(page_id, client)` - Extract text from attached files

**Supported Formats**: PDF, DOCX, XLSX, CSV, PPTX

### `internship_agent/notion/writer.py`
**Purpose**: Create and modify Notion content

**Functions**:
- `create_page(parent_id, title, content, client)` - Create new page
- `create_database(parent_page_id, title, client)` - Create new database
- `append_text_to_page(page_id, text, client)` - Add text to page
- `delete_block(block_id, client)` - Delete page/block
- `update_page(page_id, title, content, client)` - Update page

### `internship_agent/notion/database.py`
**Purpose**: Database row and column operations

**Functions**:
- `add_row(database_id, properties_json, client)` - Insert new row
- `update_row(row_id, properties_json, client)` - Modify row
- `add_column(database_id, name, type, client)` - Add column to database

**Supported Column Types**: text, number, select, multi_select, date, checkbox, url

### `internship_agent/notion/workspace.py`
**Purpose**: Workspace search and navigation

**Functions**:
- `get_workspace_overview(client)` - List 30 recent items
- `search_workspace(query, client)` - Search for pages/databases

### `internship_agent/llm/search.py`
**Purpose**: AI-powered context extraction

**Functions**:
- `extract_search_context(user_message, client)` - Find relevant pages from message

**Smart Features**:
- Quoted phrase extraction: `"my resume"`
- Possessive patterns: `my skills`
- Meaningful noun extraction

## Usage Examples

### Reading a Database
```python
from internship_agent.notion import get_notion, read_database

notion = get_notion(api_key)
result = read_database("Internship Tracker", notion)
print(result)
```

### Adding a Row
```python
from internship_agent.notion import add_row

properties = '{"Company": "Google", "Status": "Applied", "Score": 95}'
result = add_row("Jobs Database", properties, notion)
```

### Creating a Page
```python
from internship_agent.notion import create_page

result = create_page(
    parent_id="My Workspace",
    title="New Project",
    content="Project details here",
    client=notion
)
```

## Old vs New

### Old Structure (`main.py`)
- ❌ 1310 lines in single file
- ❌ Mixed concerns (Telegram, Notion, AI, Jobs)
- ❌ Functions scattered randomly
- ❌ Hard to test and maintain
- ❌ Difficult to reuse code

### New Structure (`app.py` + modules)
- ✅ Clean separation of concerns
- ✅ 50-line entry point (human-readable)
- ✅ Reusable modules
- ✅ Easy to test
- ✅ Clear dependency flow
- ✅ Human-readable function/file names

## Migration Path

### For Existing Code
Old `main.py` functions → New modules:

| Old Function | New Module | New Function |
|---|---|---|
| `read_notion_blocks()` | `notion/reader.py` | `read_page_blocks()` |
| `read_notion_database()` | `notion/reader.py` | `read_database()` |
| `read_notion_file()` | `notion/reader.py` | `read_file_attachments()` |
| `create_notion_page()` | `notion/writer.py` | `create_page()` |
| `add_database_row()` | `notion/database.py` | `add_row()` |
| `search_notion()` | `notion/workspace.py` | `search_workspace()` |
| `auto_search_context()` | `llm/search.py` | `extract_search_context()` |

### For New Code
Use the new modular imports:
```python
from internship_agent.notion import (
    read_page_blocks,
    read_database,
    read_file_attachments,
    create_page,
    add_row,
)
```

## Running the App

```bash
# Set up environment
export TELEGRAM_BOT_TOKEN="your-token"
export NOTION_API_KEY="your-key"
export OLLAMA_API_URL="http://localhost:11434/api/generate"

# Run the bot
python app.py
```

## Future Enhancements

1. **Tests** (`tests/`)
   - Unit tests for each module
   - Integration tests with mock Notion API

2. **Telegram Handlers** (`internship_agent/bot/`)
   - Centralized handler management
   - Better command routing

3. **Job Tracker** (`internship_agent/jobs/tracker.py`)
   - Find, rank, and track applications

4. **Error Handling**
   - Graceful fallbacks
   - Better error messages

5. **Logging**
   - Structured logging
   - Debug mode

## Contributing

When adding new features:
1. Follow the module organization
2. Use human-readable function names
3. Add docstrings with examples
4. Keep files under 300 lines
5. Separate concerns (don't mix Notion + AI + Bot logic)

---

**Last Updated**: 2026-03-27
**Architecture Version**: 1.0
