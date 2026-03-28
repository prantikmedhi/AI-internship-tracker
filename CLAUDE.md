# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Notion AI Internship Agent**: A Telegram bot that uses Notion as a workspace management tool and AI (Ollama/Gemini) to help users find and track internships. The agent:
- Reads user profile data from Notion (Resume, Skills, Projects, Education, Preferences)
- Scrapes internship listings from LinkedIn, Internshala, and RemoteOK
- Ranks internships against user profile using LLM
- Saves ranked results to Notion with detailed analysis (matched/missing skills, priority score)
- Can automate job applications across platforms

**Core Stack**: Python 3.14 | Telegram Bot API | Notion API v1 | Ollama/Gemini LLM | Playwright (job automation)

## Architecture

### Module Structure

```
internship_agent/
├── llm/                 # LLM integration: Ollama + Gemini with fallback
│   ├── client.py       # call_ollama(), call_gemini(), call_llm() dispatcher
│   ├── ranking.py      # rank_internship() — evaluates job fit against profile
│   ├── resume.py       # analyze_resume() — extracts structured data from profile
│   ├── extraction.py   # extract_search_keywords(), generate_cover_letter()
│   └── search.py       # LinkedInJobSearch (legacy)
├── notion/             # Notion API client and workspace operations
│   ├── client.py       # get_notion() — authenticated NotionClient
│   ├── setup.py        # init_notion(), create/manage databases
│   ├── profile.py      # get_user_profile(), write_profile_pages()
│   ├── reader.py       # read_page_blocks(), read_database(), read_file_attachments()
│   ├── writer.py       # create_page(), append_text_to_page(), update_page()
│   ├── database.py     # add_row(), update_row(), add_column()
│   ├── workspace.py    # get_workspace_overview(), search_workspace()
│   └── resolver.py     # resolve_page_id() — page UUID resolution
├── jobs/               # Internship scraping and normalization
│   ├── search.py       # scrape_internshala(), scrape_linkedin(), scrape_remoteok()
│   └── normalize.py    # normalize_internship() — standardize job schema
├── apply/              # Job application automation (Playwright)
│   ├── engine.py       # Application workflow automation
│   ├── internshala.py  # Internshala-specific application flow
│   ├── fields.py       # Form field filling strategies
│   └── verifier.py     # Email verification handling
├── log/                # Structured logging
│   └── logger.py       # log.info(), log.success(), log.error(), log.step()
├── state/              # Session/conversation state
│   └── session.py      # Conversation history management
├── common/             # Utilities
│   └── helpers.py
└── types.py            # Type definitions

app.py                   # Main Telegram bot entry point
config.py              # Environment configuration
```

### Data Flow: Profile-First Job Ranking

1. **User Command**: `find [keyword] [location]`
2. **Read Profile**: `get_user_profile()` → scans 5 profile pages (About Me, Skills, Projects, Resume, Preferences)
3. **Extract Keywords**: `extract_search_keywords()` → LLM parses user intent
4. **Scrape Jobs**: `scrape_linkedin()`, `scrape_internshala()`, `scrape_remoteok()` → raw job listings
5. **Normalize**: `normalize_internship()` → standardize to {company, role, location, description, url}
6. **Rank**: `rank_all(profile, jobs)` → LLM evaluates each job against profile
7. **Enrich**: Add matched_skills, missing_skills, priority_score, why_fits, blocker to each job
8. **Save**: `create_internship()` → write to Notion database with dynamic title property detection

### LLM Provider Strategy (call_llm() Dispatcher)

- **Default (Ollama)**: Fast local LLM, no external API calls
- **Gemini Fallback**: Google's generative AI, used if Ollama returns empty string
- **Configurable**: `LLM_PROVIDER` env var ("ollama" or "gemini")

Configuration in `config.py`:
```python
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # "ollama" or "gemini"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
```

## Setup and Running

### Environment Setup

1. **Create `.env` file** (see `.env` in repo for template):
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   NOTION_API_KEY=ntn_...
   NOTION_PARENT_PAGE_ID=  # Optional: parent page for workspace creation
   OLLAMA_MODEL=qwen2.5:3b  # Or your preferred model
   OLLAMA_API_URL=http://localhost:11434/api/chat
   GEMINI_API_KEY=  # Optional: leave empty to skip Gemini
   GEMINI_MODEL=gemini-2.0-flash
   LLM_PROVIDER=ollama  # "ollama" or "gemini"
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start Ollama** (if using local LLM):
   ```bash
   # On macOS: brew services start ollama
   # Or: ollama serve
   ollama run qwen2.5:3b  # Download and run model
   ```

4. **Run the bot**:
   ```bash
   python app.py
   ```

### Common Development Commands

```bash
# Test LLM provider setup
python3 -c "from internship_agent.llm import call_llm; print(call_llm('say hello'))"

# Test Notion connection
python3 -c "from internship_agent.notion import get_notion; n = get_notion(); print(n.users.me())"

# View logs during execution
tail -f logs/  # See log.py for log output format

# Test job scraping (dry run)
DRY_RUN=true python -c "from internship_agent.jobs import search_internships; print(search_internships('python', 'india'))"

# Install new dependency
pip install <package> && pip freeze > requirements.txt
```

## Critical Implementation Details

### Notion Database Schema Flexibility

**Key Issue**: Column names are not fixed. The "Company" column might be named "Name" or "Title" depending on database setup.

**Solution**: Dynamic title property detection (see `internship_agent/notion/setup.py:527-550`):
```python
# Find title property by type, not by name
title_prop_name = None
for prop_name, prop_type in schema.items():
    if prop_type == "title":
        title_prop_name = prop_name
        break

# Use dynamically detected name when reading/writing
candidates = {
    title_prop_name: {"title": _rich_text(data.get("company", "Unknown"))},
    ...
}
```

**Implication**: When modifying `create_internship()` or `get_internships()`, always iterate schema to find property types rather than assuming column names.

### Resume/Profile Analysis Workflow

The `resume.py` module has two functions:

1. **`analyze_resume(profile: dict)`**: Extracts structured fields from raw resume text (skills, tools, experience_level, projects). Used for quick ranking context.

2. **`extract_and_write_profile(raw_text: str)`**: Deep LLM analysis that writes structured data back to 5 Notion profile pages. Splits response into: name, about_me, skills, education, experience, projects, certifications, preferences, career_goal.

**Key Detail**: If profile pages have less than 50 chars of content, the function auto-searches entire workspace for resume-related pages (searching keywords: "resume", "cv", "experience", "skills", etc.). This allows the agent to find resume content even if user hasn't filled the structured profile pages.

### Job Ranking Rubric

Ollama/Gemini receive explicit scoring instructions in `ranking.py:10-28`:
- 90-100: Exceptional match (role title exact, 80%+ skills match, well-known company, location fits)
- 75-89: Good match (relevant role, 50-70% skills match, some stretch)
- 55-74: Average (partial overlap, 30-50% skills missing)
- 35-54: Poor (significant differences, <30% skill overlap)
- 1-34: Skip (completely irrelevant)

**Implementation Note**: Strict rubric prevents score inflation. Most jobs should score 50-75; exceptional ones 80-95.

### Playwright Job Application Automation

`internship_agent/apply/engine.py` handles automated job applications using Playwright:
- Site-specific submodules (e.g., `internshala.py`) implement form-filling logic
- `DRY_RUN=true` env var allows testing without actual submissions
- Email verification flow in `verifier.py` handles verification email retrieval

**Key Constraint**: Playwright requires actual browser interaction; headless mode may fail on CAPTCHA-protected sites.

## Testing Strategy

No formal test suite exists. Testing is manual:

1. **Unit-like tests**: Test individual functions in Python REPL
   ```python
   from internship_agent.llm import extract_search_keywords
   result = extract_search_keywords({"Skills": "Python"}, "find python india")
   print(result)  # Expect ("python developer intern", "India", reason)
   ```

2. **Integration tests**: Run bot commands and verify Notion updates
   - `/search python` → Check Internship Tracker database for new rows with ranking data

3. **LLM testing**: Compare Ollama vs Gemini responses
   ```bash
   LLM_PROVIDER=ollama python app.py &
   # Test a command, check output
   LLM_PROVIDER=gemini python app.py &
   # Test same command, compare quality
   ```

## Common Pitfalls and Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Internship data not saving | Hardcoded "Company" column name doesn't exist | Detect title property by type, not name |
| Columns empty (matched_skills, priority_score) | Job search skips profile analysis | Implement profile-first workflow: read profile before scraping |
| Ollama timeouts | Model is slow or API URL incorrect | Check `OLLAMA_API_URL` and `OLLAMA_TIMEOUT_SLOW` settings |
| Gemini API fails silently | API key missing or invalid | Set `GEMINI_API_KEY` in .env; check `call_gemini()` error logs |
| Job scraping returns 0 results | Website HTML changed or user-agent blocked | Update selectors in `jobs/search.py` or add rotating user-agents |

## Debugging

**Enable verbose logging**:
```python
# In any module:
from internship_agent.log.logger import log
log.info(f"DEBUG: value = {value}")  # Info-level (always shown)
log.error(f"Error: {e}")             # Error-level
log.success("Operation complete")   # Success message
log.step(1, 10, "Processing item")  # Progress indicator
```

**Inspect Notion schema**:
```python
from internship_agent.notion import get_notion
notion = get_notion()
db = notion.databases.retrieve(database_id="...")
for prop_name, prop_obj in db["properties"].items():
    print(f"{prop_name}: {prop_obj['type']}")
```

**Test LLM directly**:
```python
from internship_agent.llm import call_llm, call_ollama, call_gemini
# Test primary provider
print(call_llm("Hello, respond with 'OK'"))
# Test specific provider
print(call_ollama("Hello, respond with 'OK'"))
print(call_gemini("Hello, respond with 'OK'"))
```

## Code Style and Conventions

- **Logging**: Always use `log.*` from `internship_agent.log.logger`, not `print()`
- **Error Handling**: Return sensible defaults on LLM failure (e.g., empty string or fallback score of 50)
- **Notion Properties**: Detect property type dynamically, never assume column names
- **JSON Parsing**: Use `extract_json_from_response()` for all LLM outputs
- **Timeouts**: Use `OLLAMA_TIMEOUT_FAST` (60s) for quick tasks, `OLLAMA_TIMEOUT_SLOW` (120s) for ranking/analysis
- **Type Hints**: Use for function signatures where helpful; not required for internal functions

## Key Files to Know

| File | Purpose | When to Modify |
|------|---------|---|
| `config.py` | Env variable parsing and defaults | Adding new config options |
| `app.py` | Telegram bot event handlers | Adding new bot commands or intents |
| `internship_agent/llm/client.py` | LLM provider dispatcher | Changing LLM strategy or adding new providers |
| `internship_agent/llm/ranking.py` | Job ranking logic | Tuning scoring rubric or improving job matching |
| `internship_agent/llm/resume.py` | Profile analysis | Changing how resume data is extracted or written |
| `internship_agent/notion/setup.py` | Internship database CRUD | Fixing column handling or adding new job fields |
| `internship_agent/jobs/search.py` | Web scraping logic | Adding new job sources or fixing scraper selectors |

## Known Limitations

1. **Column Name Flexibility**: While title property is now detected dynamically, other columns are still referenced by fixed names (e.g., "Role", "Location"). If user renames these, values won't populate.

2. **Job Scraping**: HTML-based scraping is fragile; website redesigns break selectors. Consider using official job APIs if available.

3. **Playwright Limitations**: CAPTCHA and JavaScript-heavy pages can block automation. Manual intervention may be needed.

4. **LLM Context Limits**: Ollama and Gemini have token limits. Long resumes are truncated to 5000 chars before analysis.

5. **Notion Rate Limits**: Notion API is subject to rate limits. High-volume updates may fail; consider batching or adding retry logic.

## Related Documentation

- Notion API: https://developers.notion.com/reference/intro
- python-telegram-bot: https://python-telegram-bot.readthedocs.io/
- Ollama: https://ollama.ai/
- Google Generative AI: https://ai.google.dev/
