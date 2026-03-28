# 🚀 Running the New Modular AI Internship Agent

This is a **completely fresh system** using only the new `internship_agent/` modular package.
It does **NOT** import any old files (main.py, apply.py, etc.).

## Quick Start

### 1. Install Dependencies

```bash
# Python packages
pip install python-dotenv requests telegram python-telegram-bot

# Notion + Playwright (for full functionality)
pip install notion-client playwright
python -m playwright install chromium
```

### 2. Set Up `.env` File

Create a `.env` file in the project root with your credentials:

```env
# Notion Integration
NOTION_API_KEY=your_notion_integration_token_here
NOTION_PARENT_PAGE_ID=optional_your_workspace_page_id

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Ollama LLM
OLLAMA_API_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_FAST=60
OLLAMA_TIMEOUT_SLOW=120

# Optional
SCREENSHOTS_DIR=screenshots
DRY_RUN=false
```

### 3. Start Services

**Terminal 1 — Ollama (for LLM reasoning):**
```bash
ollama serve
# In another terminal: ollama pull qwen2.5:3b
```

**Terminal 2 — Notion (optional but recommended):**
```bash
# Make sure your Notion workspace has a page shared with your integration
# The bot will auto-create the workspace structure on first run
```

### 4. Run the Bot

```bash
python3 run_new_agent.py
```

You should see:
```
======================================================================
AI INTERNSHIP AGENT (NEW MODULAR SYSTEM)
======================================================================

[HH:MM:SS] INFO     Initializing AI Internship Agent...
[HH:MM:SS] INFO     Setting up Notion workspace...
[HH:MM:SS] SUCCESS  Notion ready
[HH:MM:SS] SUCCESS  Telegram bot initialized
[HH:MM:SS] INFO     Starting bot polling... Press Ctrl+C to stop
[HH:MM:SS] INFO     DRY_RUN mode: false
```

## Usage Examples

Open Telegram and chat with your bot:

### Find Internships
```
User: find python interns india
Bot:  ✅ Found 45 internships for 'python developer intern' in India. Top 10:
      1. Google — Python Intern (Bangalore) [Score: 95]
      2. Microsoft — Backend Intern (India) [Score: 88]
      3. Amazon — Data Intern (Remote) [Score: 82]
      ...
      💡 Try: 'apply to internship 2' or 'apply to all'
```

### Analyze Your Resume
```
User: analyze my resume
Bot:  📊 Your Resume Analysis:
      [Extracted Resume Data]
      Skills: Python, JavaScript, React, Node.js, PostgreSQL
      Tools: Git, Docker, AWS, VS Code
      Education: B.Tech Computer Science, IITD, 2025
      Experience: 1-2 years
      Projects: InternshipFinder (web app), ChatGPT CLI
      Goal: Software engineering roles in startup
```

### Apply to Jobs
```
User: apply to internship 2
Bot:  📨 Applying to 1 internship(s)... (this will take a few minutes)
      [Playwright automation runs...]
      📋 Application Results:
      ✅ Microsoft — Backend Intern
         APPLIED_SUCCESSFULLY
```

### Apply to Multiple
```
User: apply to all
Bot:  📨 Applying to 10 internship(s)... (this will take a few minutes)
      ✅ Google — Python Intern: APPLIED_SUCCESSFULLY
      ⚠️ Microsoft — Backend Intern: PARTIALLY_COMPLETED
      ✅ Amazon — Data Intern: APPLIED_SUCCESSFULLY
      ...
```

## Architecture

```
run_new_agent.py (entry point, 200 lines)
    ├── internship_agent.notion      (profile, CRUD, setup)
    ├── internship_agent.llm         (resume, ranking, keywords)
    ├── internship_agent.jobs        (search, normalize)
    ├── internship_agent.apply       (form filling, truthful verification)
    ├── internship_agent.state       (session storage)
    ├── internship_agent.log         (structured logging)
    └── internship_agent.agent       (prompts)
```

**Key Features:**
- ✅ **Truthful Verification** — ApplyStatus enum detects actual submission
- ✅ **Session State** — "apply to internship 2" works via numeric selection
- ✅ **Structured Logging** — `[HH:MM:SS] LEVEL  message` format
- ✅ **Clean Modular Code** — 9 independent layers, no circular imports
- ✅ **Profile Auto-Detection** — Finds "python interns" by analyzing your Resume page

## Troubleshooting

### "NOTION_API_KEY not set"
```bash
# Make sure your .env has:
NOTION_API_KEY=ntn_xxxxx...

# And the bot will auto-create the workspace
```

### "TELEGRAM_BOT_TOKEN not set"
```bash
# Create a Telegram bot at @BotFather, then add to .env:
TELEGRAM_BOT_TOKEN=123456:ABCxyz...
```

### "Playwright timed out"
- The first apply() takes longer (browser startup)
- DRY_RUN=true to skip actual submission and just fill forms

### "Ollama connection refused"
```bash
# Start Ollama in another terminal
ollama serve
# Pull the model
ollama pull qwen2.5:3b
```

### "No Notion profile found"
- Create these pages in your Notion workspace:
  - About Me (your name, background)
  - Skills (list of technical skills)
  - Projects (past projects and links)
  - Resume (resume content)
  - Preferences (location, remote/onsite, etc.)

## Environment Variables Reference

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `NOTION_API_KEY` | ✅ Yes | `ntn_xxxxx...` | Notion integration token |
| `NOTION_PARENT_PAGE_ID` | ❌ No | `abc123...` | Workspace page (auto-detected if omitted) |
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | `123456:ABC...` | Telegram bot token from @BotFather |
| `OLLAMA_API_URL` | ✅ Yes | `http://localhost:11434/api/chat` | Ollama endpoint |
| `OLLAMA_MODEL` | ✅ Yes | `qwen2.5:3b` | LLM model name |
| `OLLAMA_TIMEOUT_FAST` | ❌ No | `60` | Fast query timeout (seconds) |
| `OLLAMA_TIMEOUT_SLOW` | ❌ No | `120` | Slow query timeout (seconds) |
| `SCREENSHOTS_DIR` | ❌ No | `screenshots` | Where to save Playwright screenshots |
| `DRY_RUN` | ❌ No | `false` | If `true`, don't actually submit forms |

## Testing Individual Modules

```python
# Test logger
python3 -c "from internship_agent.log.logger import log; log.success('Works!')"

# Test session
python3 -c "
from internship_agent.state.session import Session
s = Session()
s.last_results = [{'company': 'Google'}, {'company': 'Microsoft'}]
print(s.resolve('2'))  # → {'company': 'Microsoft'}
"

# Test all modules
python3 test_modular_package.py
```

## Next Steps

1. **Text-based testing** (no Telegram yet):
   - Create `test_interactions.py` to test agent logic
   - Test search, ranking, apply flows

2. **Gradual feature addition**:
   - Add more job sources
   - Improve form field matching
   - Better error messages

3. **Production deployment**:
   - Move bot to cloud (Heroku, AWS Lambda, etc.)
   - Set up persistent Notion workspace
   - Configure Ollama on server

## File Structure

```
project/
├── run_new_agent.py          ← Main entry point (NEW, FRESH)
├── test_modular_package.py   ← Module tests
├── .env                       ← Your secrets (git-ignored)
└── internship_agent/          ← Modular package (18 files)
    ├── __init__.py
    ├── types.py               ← Data types
    ├── log/
    │   ├── __init__.py
    │   └── logger.py          ← Structured logging
    ├── notion/
    │   ├── __init__.py
    │   ├── client.py          ← Notion API
    │   ├── profile.py         ← Resume parsing
    │   ├── crud.py            ← 13 CRUD operations
    │   └── setup.py           ← Workspace init
    ├── llm/
    │   ├── __init__.py
    │   ├── client.py          ← Ollama wrapper
    │   ├── resume.py          ← Resume analysis
    │   ├── ranking.py         ← Job ranking
    │   └── extraction.py      ← Keywords + cover letters
    ├── jobs/
    │   ├── __init__.py
    │   ├── search.py          ← Scrapers
    │   └── normalize.py       ← Dedup + verify
    ├── apply/
    │   ├── __init__.py
    │   ├── fields.py          ← Form filling
    │   ├── verifier.py        ← Truthful verification ✨
    │   ├── internshala.py     ← Internshala handler
    │   └── engine.py          ← Main apply logic
    ├── state/
    │   ├── __init__.py
    │   └── session.py         ← Per-chat state
    ├── agent/
    │   ├── __init__.py
    │   └── prompt.py          ← System prompt
    └── bot/
        └── __init__.py        ← Package stub
```

---

**Questions?** Check the terminal logs with `[HH:MM:SS]` timestamps — they show exactly what's happening at each step.
