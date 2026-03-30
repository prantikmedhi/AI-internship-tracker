# Notion Internship Agent

A Telegram bot that finds, ranks, and tracks internships using your Notion workspace as a personal career database.

---

## What it does

1. Reads your profile from Notion (skills, resume, preferences)
2. Scrapes internship listings from LinkedIn, Internshala, and RemoteOK
3. Ranks each listing against your profile using an LLM
4. Saves ranked results back to Notion with matched skills, missing skills, and a priority score

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Bot | [grammY](https://grammy.dev/) — Telegram Bot framework |
| Notion integration | [Notion MCP](https://mcp.notion.com) + direct Notion API v1 fallback |
| LLM | [Ollama](https://ollama.ai/) (local) with [Gemini](https://ai.google.dev/) fallback |
| Scraping | [Playwright](https://playwright.dev/) + [Chromium](https://www.chromium.org/) |
| HTML parsing | [Cheerio](https://cheerio.js.org/) |
| Auth | Notion OAuth 2.0 via Telegram deep-link flow |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |

---

## Prerequisites

- Node.js 20+
- A Telegram bot token — create one via [@BotFather](https://t.me/BotFather)
- A Notion OAuth app — create one at [notion.so/my-integrations](https://www.notion.so/my-integrations)
- Ollama running locally — `ollama serve` — or a Gemini API key

---

## Setup

**1. Clone and install**

```bash
git clone <repo-url>
cd notion-internship-agent
npm install
npx playwright install chromium
```

**2. Configure environment**

Create `.env.local`:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Notion OAuth
NOTION_CLIENT_ID=your_notion_client_id
NOTION_CLIENT_SECRET=your_notion_client_secret
NOTION_REDIRECT_URI=https://yourdomain.com/api/auth/notion/callback

# LLM — choose one
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_API_URL=http://localhost:11434/api/chat

# Optional Gemini fallback
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

**3. Run**

```bash
# Development (Next.js + bot)
npm run dev
npm run bot:dev

# Production
npm run build
npm run start
npm run bot:start
```

---

## Bot commands

| Command | Description |
|---------|-------------|
| `/start` | Connect your Notion account via OAuth |
| `/find [keyword] [location]` | Search and rank internships |
| `/profile` | View your Notion profile summary |
| `/read [page]` | Read a Notion page |
| `/help` | List all commands |

---

## Architecture

```
app/                  Next.js pages and API routes
bot/                  Telegram bot (grammY handlers + intents)
lib/
  mcp/               Notion MCP client + direct API fallback
  llm/               Ollama/Gemini dispatcher, ranking, extraction
  notion/            OAuth, workspace setup, profile, scraper
  jobs/              Job scraper (LinkedIn, Internshala, RemoteOK)
```

The bot authenticates each user via Notion OAuth, then uses their access token for all Notion operations. No shared API keys are stored beyond the OAuth app credentials.

---

## LLM models

The ranking and extraction pipeline is model-agnostic. Recommended models:

| Use case | Recommended |
|----------|-------------|
| Local (fast) | `qwen2.5:3b` via Ollama |
| Local (quality) | `llama3.1:8b` via Ollama |
| Cloud | `gemini-2.0-flash` |

Set `LLM_PROVIDER=gemini` and add `GEMINI_API_KEY` to switch to Gemini.

---

## Notion workspace structure

On first use, the bot auto-creates:

- **Profile** page — About Me, Skills, Projects, Resume, Preferences
- **Internship Tracker** database — Role, Company, Location, Priority Score, Matched Skills, Missing Skills, Status

---

## License

MIT
