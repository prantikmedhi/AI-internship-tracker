# Telegram Bot - Complete Features & Usage Guide

## 🤖 What Your Bot Can Do

Your Telegram bot is now fully functional with intelligent message handling.

---

## 📱 How to Use (3 Ways)

### Method 1: Commands (Explicit)
Use `/command` format for precise control:

```
/search python internship
/read Internship Tracker
/add_row Jobs | {"Company": "Google", "Status": "Applied"}
```

### Method 2: Natural Language (AI-Powered)
Just type normally, bot understands intent:

```
find internship
search python
read my database
show workspace
```

### Method 3: Combination
Mix both - whatever feels natural:

```
show me internships
find a job
tell me about my tracker
```

---

## 🎯 Features & Examples

### 1️⃣ Find/Search Internships

**What it does**: Searches your Notion workspace for internships

**Natural language examples:**
```
find internship
search internship
find python internship
search backend job
find remote position
```

**With command:**
```
/search python internship
```

**Response:**
```
🔍 Searching for internships related to: python internship

Search results:
- [PAGE] Google SWE Intern | ID: abc123... | Last edited: 2026-03-27
- [DATABASE] Internship Tracker | ID: def456... | Last edited: 2026-03-27
- [PAGE] Python Projects | ID: ghi789... | Last edited: 2026-03-26
```

---

### 2️⃣ Read Databases

**What it does**: Shows all rows and columns from a database

**Natural language examples:**
```
read internship tracker
show my jobs
read database
```

**With command:**
```
/read Internship Tracker
```

**Response:**
```
COLUMNS: Company | Role | Status | Date
─────────────────────────────────────
Row 1 [ID: abc...]: Google | SWE Intern | Applied | 2026-03-27
Row 2 [ID: def...]: Microsoft | PM Intern | [blank] | [blank]
Row 3 [ID: ghi...]: Meta | Backend Eng | New | [blank]
```

---

### 3️⃣ Read Pages

**What it does**: Shows text content from a page

**Natural language examples:**
```
show resume
read my skills
read about me
```

**With command:**
```
/read My Resume
```

**Response:**
```
[uuid | heading_1] My Resume
[uuid | paragraph] I am a software engineer with 3 years of experience...
[uuid | bullet_list_item] Python, JavaScript, Go
[uuid | bullet_list_item] System design, databases
```

---

### 4️⃣ Workspace Overview

**What it does**: Shows 30 most recently edited pages in your workspace

**Natural language examples:**
```
show workspace
overview
show all
```

**Response:**
```
Workspace Overview (Recent 30 items):
- [PAGE] Resume | ID: abc123... | URL: https://notion.so/...
- [DATABASE] Jobs | ID: def456... | URL: https://notion.so/...
- [PAGE] Skills | ID: ghi789... | URL: https://notion.so/...
...
```

---

### 5️⃣ Add Database Row

**What it does**: Creates a new row in your database

**Format:**
```
/add_row <database_name> | <json_properties>
```

**Examples:**
```
/add_row Jobs | {"Company": "Google", "Role": "SWE", "Status": "Applied"}

/add_row Internship Tracker | {"Company": "Microsoft", "Role": "PM", "Location": "Seattle"}
```

**Response:**
```
✓ Row added successfully to your database.
```

---

### 6️⃣ Create Page

**What it does**: Creates a new page in Notion

**Format:**
```
/add_page <parent_page> | <title> | <content>
```

**Examples:**
```
/add_page Workspace | New Job Notes | Applied to Google for SWE position

/add_page My Workspace | Project Ideas | AI-powered Notion integration
```

**Response:**
```
✓ Page 'New Job Notes' created successfully.
```

---

### 7️⃣ Append Text to Page

**What it does**: Adds text to an existing page

**Format:**
```
/append <page_name> | <text_to_add>
```

**Examples:**
```
/append My Notes | Added new consideration about remote work

/append Job Ideas | Google SWE position seems like a good fit
```

**Response:**
```
✓ Content appended successfully.
```

---

## 🧠 Smart Intent Detection

The bot understands **what you're trying to do** without explicit commands:

### Internship Search
**Triggers:**
- Contains "intern"
- Contains "job"
- Contains "find"
- Contains "search" + job-related words

**Examples that trigger:**
```
find internship
search job
finding python internship
look for backend jobs
```

### Database/Page Reading
**Triggers:**
- Starts with "read"
- Starts with "show"
- Database/page name in message

**Examples that trigger:**
```
read tracker
show database
what's in my jobs
```

### Workspace Overview
**Triggers:**
- "overview"
- "show all"
- "workspace"

**Examples that trigger:**
```
show workspace
give me an overview
what's recent
```

### Generic Search
**Triggers:**
- Any message that doesn't match above
- Extracts keywords and searches

**Examples:**
```
python skills
where is my resume
tell me about databases
```

---

## ✅ Successful Response Examples

### Search Success
```
🔍 Searching for internships related to: python

Search results:
- [PAGE] Python Internships | ID: abc123 | Last edited: 2026-03-27
- [PAGE] Backend Positions | ID: def456 | Last edited: 2026-03-26
```

### Database Read Success
```
COLUMNS: Company | Role | Status | Applied Date
────────────────────────────────────────────────
Row 1: Google | SWE Intern | Applied | 2026-03-27
Row 2: Microsoft | PM Intern | New | [blank]
```

### Page Creation Success
```
✓ Page 'My New Job' created successfully.
```

---

## ❌ Error Handling

### Missing Database
```
❌ Error querying database [database_name]: Could not resolve page ID
```
**Solution**: Make sure the database name is correct

### Missing Page
```
❌ Error: Could not find any Notion page matching 'xyz'
```
**Solution**: Check the exact page name in Notion

### API Error
```
❌ Notion client not initialized. Check your NOTION_API_KEY in .env
```
**Solution**: Verify API key in `.env` file

### Invalid JSON (for /add_row)
```
❌ Error: properties_json is not valid JSON.
Example: '{"Name": "Alice", "Status": "Active"}'
```
**Solution**: Use proper JSON format

---

## 🎯 Common Use Cases

### Case 1: Track a New Internship

**Step 1**: Find it
```
find python internship at google
```

**Step 2**: Add to tracker
```
/add_row Internship Tracker | {"Company": "Google", "Role": "SWE", "Status": "New"}
```

**Step 3**: Read tracker to verify
```
read internship tracker
```

---

### Case 2: Update Job Status

**Step 1**: Read tracker
```
read jobs
```

**Step 2**: Update the row
```
/update_row <row_id> | {"Status": "Applied", "AppliedDate": "2026-03-27"}
```

---

### Case 3: Search and Document

**Step 1**: Search for topic
```
search python skills
```

**Step 2**: Create notes
```
/add_page My Notes | Python Learning | Areas to focus on...
```

**Step 3**: Append findings
```
/append Python Learning | Found this great resource...
```

---

## 📊 Command Reference

| Intent | Natural Language | Command | Result |
|--------|-----------------|---------|--------|
| Search internships | `find internship` | `/search internship` | Lists matching pages |
| Search anything | `search python` | `/search python` | Searches Notion |
| Read database | `read jobs` | `/read Jobs` | Shows all rows |
| Read page | `show resume` | `/read Resume` | Shows page content |
| Workspace | `overview` | (auto) | Shows recent items |
| Add row | N/A | `/add_row Jobs \| {...}` | Creates row |
| Add page | N/A | `/add_page Parent \| Title \| Content` | Creates page |
| Append | N/A | `/append Page \| Text` | Adds text |
| Help | `help` | `/help` | Shows commands |
| Clear memory | `clear` | `/clear` | Clears history |

---

## 🔐 Privacy & Safety

- **Your data stays in Notion** - Bot only reads/writes what you authorize
- **No data is logged** - Messages are processed but not stored
- **API key is secure** - Only used for Notion authentication
- **Telegram secure** - Uses official Telegram Bot API

---

## 🚀 Starting the Bot

```bash
# Navigate to project
cd /Users/prantikpratimmedhi/Projects/notion-mcp-phase1

# Activate environment
source venv/bin/activate

# Run the bot
python app.py
```

You should see:
```
Starting Notion AI Agent on Telegram...
```

---

## 📝 Full Example Workflow

```
User: find internship
Bot: 🔍 Searching for internships related to: internship

    Search results:
    - [PAGE] Google SWE Intern | ID: abc123
    - [DATABASE] Internship Tracker | ID: def456

User: read internship tracker
Bot: COLUMNS: Company | Role | Status | Date
    ─────────────────────────────────────
    Row 1: Google | SWE | Applied | 2026-03-27
    Row 2: Microsoft | PM | New | [blank]

User: /add_row Internship Tracker | {"Company": "Meta", "Role": "Backend", "Status": "Interested"}
Bot: ✓ Row added successfully to your database.

User: read internship tracker
Bot: COLUMNS: Company | Role | Status | Date
    ─────────────────────────────────────
    Row 1: Google | SWE | Applied | 2026-03-27
    Row 2: Microsoft | PM | New | [blank]
    Row 3: Meta | Backend | Interested | [blank]
```

---

## 🎉 Features Summary

✅ **Search**: Find anything in your Notion workspace
✅ **Read**: View pages and databases
✅ **Create**: Add pages and database rows
✅ **Smart Intent**: Understand natural language
✅ **Error Handling**: Clear error messages
✅ **Format Support**: Works with JSON, text, timestamps
✅ **Caching**: Shows recent items fast
✅ **Safe**: No data storage, secure API keys

---

**Now your bot is fully functional and ready to use!** 🚀
