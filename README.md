# 🚀 Notion AI Internship Agent

An AI-powered Telegram bot that helps you find, rank, and apply for internships automatically. Uses your Notion workspace as the central hub for profile management and job tracking.

**Status**: Active Development | **License**: MIT

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [How It Works](#how-it-works)
3. [Features](#features)
4. [Setup Instructions](#setup-instructions)
5. [Using the Bot](#using-the-bot)
6. [Notion Workspace Setup](#notion-workspace-setup)
7. [Telegram Commands](#telegram-commands)
8. [LLM Configuration](#llm-configuration)
9. [Troubleshooting](#troubleshooting)
10. [Architecture](#architecture)

---

## 🎯 Quick Start

### What You Need
- Telegram account
- Notion workspace
- Ollama (local) OR Gemini API key (Google)
- Python 3.12+

### 5-Minute Setup

```bash
# 1. Clone repo
git clone <repo-url>
cd notion-mcp-phase1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env file
cp .env.example .env
# Edit .env with your API keys (see Setup Instructions below)

# 4. Start Ollama (if using local LLM)
ollama run qwen2.5:3b

# 5. Run the bot
python app.py
```

Then message your bot on Telegram: `/start`

---

## 🔍 How It Works

### The Complete Workflow

```
User Message → Bot Reads Notion Profile → AI Extracts Keywords →
Bot Scrapes Jobs → AI Ranks by Your Skills → Results Saved to Notion →
User Reviews & Applies
```

### Step-by-Step Breakdown

#### 1️⃣ **You Upload Your Resume/Profile to Notion**
- Bot reads from 5 profile pages: About Me, Skills, Projects, Resume, Preferences
- Stores your technical skills, experience level, career goals

#### 2️⃣ **You Search for Internships via Telegram**
```
You: "find python internship india"
Bot: "📊 Searching for jobs... (using your profile)"
```

#### 3️⃣ **Bot Extracts What You Want**
- AI parses your message to understand the role and location
- Example: "python internship india" →
  - Role: "Python Developer Intern"
  - Location: "India"

#### 4️⃣ **Bot Scrapes Job Listings**
- Searches LinkedIn, Internshala, RemoteOK
- Collects 50-100+ job listings matching your criteria
- Extracts: Company, Role, Location, Job Description, URL

#### 5️⃣ **AI Ranks Jobs Against Your Profile**
- **Ollama** (local) or **Gemini** (Google) reads each job
- Compares job requirements with your skills
- Assigns a **Priority Score** (1-100)
  - 90-100: Perfect match
  - 75-89: Great fit
  - 55-74: Good candidate
  - 35-54: Possible stretch
  - 1-34: Not for you

#### 6️⃣ **Results Auto-Save to Notion**
- Creates rows in "Internship Tracker" database
- Fills columns: Company, Role, Location, Priority Score, Matched Skills, Missing Skills, Why This Fits, Blocker Reason
- Links to original job posting
- You can then apply, bookmark, or reject

#### 7️⃣ **Optional: Auto-Apply (Experimental)**
- Bot can fill out applications automatically
- Currently supports: Internshala
- Uses headless browser (Playwright)

---

## ✨ Features

### Core Features ✅
- ✅ **Profile Management**: Upload resume/CV to Notion, AI extracts structured data
- ✅ **AI Job Ranking**: LLM evaluates job-to-profile fit with skill matching
- ✅ **Multi-Source Scraping**: LinkedIn, Internshala, RemoteOK
- ✅ **Notion Integration**: All results stored in Notion database
- ✅ **Telegram Bot**: Commands from your phone/desktop
- ✅ **Flexible LLM**: Use local Ollama OR cloud Gemini (with fallback)
- ✅ **Keyword Extraction**: AI understands "find python india" vs "find frontend london"
- ✅ **Cover Letter Generation**: AI writes personalized cover letters (experimental)

### Premium Features (Coming Soon)
- ⏳ Auto-apply to jobs with form filling
- ⏳ Email integration for verification codes
- ⏳ Job alert subscriptions
- ⏳ Salary negotiation tips

---

## 🛠️ Setup Instructions

### Prerequisites

**System Requirements:**
- macOS, Linux, or Windows (with WSL)
- Python 3.12 or newer
- 4GB RAM minimum (8GB recommended)

**API Keys Needed:**
1. **Telegram Bot Token** — Create at [@BotFather](https://t.me/botfather)
2. **Notion API Key** — Get at https://www.notion.so/my-integrations
3. **Ollama** (free, local) OR **Gemini API Key** (free tier available)

---

### Step 1: Clone & Install

```bash
git clone <repo-url>
cd notion-mcp-phase1

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### Step 2: Create `.env` File

Create a new file named `.env` in the root directory:

```env
# Telegram
TELEGRAM_BOT_TOKEN=<your-bot-token-from-botfather>

# Notion
NOTION_API_KEY=ntn_<your-api-key-from-notion>
NOTION_PARENT_PAGE_ID=  # Optional: Leave blank for now

# LLM: Ollama (local, free) or Gemini (cloud)
# --- Ollama Setup (Default) ---
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_API_URL=http://localhost:11434/api/chat
OLLAMA_TIMEOUT_FAST=60
OLLAMA_TIMEOUT_SLOW=120

# --- Gemini Setup (Optional) ---
GEMINI_API_KEY=  # Leave blank if using Ollama only
GEMINI_MODEL=gemini-2.0-flash

# --- Which LLM to use ---
LLM_PROVIDER=ollama  # "ollama" or "gemini"

# Optional: Application automation
DRY_RUN=false  # Set to "true" to test without submitting
```

---

### Step 3: Get Your API Keys

#### 🤖 Telegram Bot Token

1. Open Telegram and search for **@BotFather**
2. Send: `/newbot`
3. Choose a name: "My Internship Bot"
4. Choose a username: "my_internship_bot" (must be unique)
5. Copy the token → Paste in `.env` as `TELEGRAM_BOT_TOKEN`

#### 📄 Notion API Key

1. Go to https://www.notion.so/my-integrations
2. Click **"New Integration"**
3. Name: "Internship Agent"
4. Click **"Submit"**
5. Copy the "Internal Integration Token" → Paste in `.env` as `NOTION_API_KEY`

#### 🌐 Gemini API Key (Optional)

If you want to use Google's Gemini instead of Ollama:

1. Go to https://ai.google.dev/
2. Click **"Get API Key"**
3. Create a new project or select existing
4. Copy the API key → Paste in `.env` as `GEMINI_API_KEY`
5. Set `LLM_PROVIDER=gemini` in `.env`

**Or use Ollama (Local, Free):**
- Download from https://ollama.ai/
- Run: `ollama serve` in a terminal
- Download model: `ollama run qwen2.5:3b`
- Bot will use this automatically if `LLM_PROVIDER=ollama`

---

### Step 4: Create Your Notion Workspace

The bot will auto-create a workspace on first run, but here's what it creates:

**Root Page**: "AI Internship Agent"
- **5 Profile Pages** (fill these with your info):
  - 📝 About Me
  - 🎯 Skills
  - 🚀 Projects
  - 📋 Resume
  - ⚙️ Preferences

- **Database**: "Internship Tracker"
  - Columns: Name, Role, Location, Status, Priority Score, Matched Skills, Missing Skills, Why This Fits, Blocker Reason, Apply URL, Apply Timestamp

---

### Step 5: Run the Bot

```bash
python app.py
```

You should see:
```
✅ Telegram bot started, listening for messages...
```

---

## 👥 Using the Bot

### First Time Setup

1. **Open Telegram** and find your bot (the username you created)
2. **Send**: `/start`
3. Bot responds with welcome message and available commands

---

### Profile Setup (Important!)

#### Step 1: Create Profile Pages in Notion

After running `python app.py` once, check your Notion workspace. You'll see a page called **"AI Internship Agent"** with 5 sub-pages.

#### Step 2: Fill Your Profile

Go to each page and add your info:

**📝 About Me** (1-2 sentences about yourself)
```
Hi! I'm a 3rd year CS student passionate about backend development.
Looking for internships in India to grow my skills in Python and databases.
```

**🎯 Skills** (comma-separated, or one per line)
```
Python
Django
PostgreSQL
REST APIs
Git
Linux
```

**🚀 Projects** (project name + brief description)
```
Weather App - Built a real-time weather dashboard using React and OpenWeather API
Blog Platform - Created a Django-based blog with user authentication and comments
Machine Learning Model - Trained a neural network for image classification using TensorFlow
```

**📋 Resume** (paste your resume or summary)
```
[Your resume content here - can be text, list format, or full document text]

Experience:
- Intern at TechCorp (3 months) - Worked on backend APIs
- Freelance developer - Built 5+ web projects

Education:
- B.Tech Computer Science, XYZ University (Expected 2025)
```

**⚙️ Preferences** (location, remote/onsite, salary, etc.)
```
Location: India (preferably Bangalore, Mumbai)
Type: Remote preferred, onsite also okay
Duration: 3-6 months
Salary: ₹20,000-40,000/month
Focus: Backend, DevOps, Data Science
```

#### Step 3: Upload Resume File (Optional)

You can also upload a PDF/Word resume file to the "Resume" page:
1. In Notion, open the **Resume** page
2. Click the **+** icon to add a file
3. Upload your PDF/DOCX resume
4. Bot will read and extract data automatically

---

## 🤖 Telegram Commands

Send these commands to your bot:

### Basic Commands

```
/start                          Show welcome message
/help                           Show all available commands
```

### Job Search

```
/find python                    Find Python internships (uses your location)
/find frontend london           Find Frontend internships in London
/find machine learning india    Find ML internships in India
/find data science              Find Data Science internships (remote)

# Format: /find [role/skill] [location]
# If no location, uses your Preferences page location or defaults to Remote
```

### Profile Management

```
/profile                        Show your extracted profile (skills, experience, goals)
/update_profile                 Re-scan Notion pages and update profile
/sync_resume                    Upload resume to all 5 profile pages
```

### Job Tracking

```
/my_jobs                        Show jobs you've found (stored in Notion)
/apply [job_id]                 Apply to a specific job (auto-fill form)
/status [job_id] applied        Mark job as "applied", "rejected", "accepted", etc.
```

### Advanced

```
/cover_letter [job_id]          Generate a personalized cover letter
/search_hint find python        (Used internally for keyword extraction)
```

---

## 📊 Notion Workspace Setup

### Auto-Created Structure

When you run the bot for the first time, it creates:

```
AI Internship Agent (Root Page)
├── About Me (Text page - fill with your intro)
├── Skills (Text page - list your skills)
├── Projects (Text page - describe your projects)
├── Resume (Text page - paste your resume)
├── Preferences (Text page - location, remote/onsite, salary)
└── Internship Tracker (Database)
    ├── Name (Title - Company Name)
    ├── Role (Text - Job Title)
    ├── Location (Text - Job Location)
    ├── Status (Select - New/Applied/Rejected/Accepted)
    ├── Priority Score (Number 1-100)
    ├── Matched Skills (Text - Your skills that match)
    ├── Missing Skills (Text - Skills you need to learn)
    ├── Why This Fits (Text - Why the job is good for you)
    ├── Blocker Reason (Text - Why you might not be suitable)
    ├── Apply URL (URL - Link to apply)
    └── Apply Timestamp (Date - When you applied)
```

### How to Read Your Results

After searching for jobs:

1. Open **Notion**
2. Go to **"Internship Tracker"** database
3. Sort by **"Priority Score"** (highest first)
4. Review **"Why This Fits"** and **"Matched Skills"**
5. Click **"Apply URL"** to go to the job posting
6. Update **"Status"** column as you apply

### Example Job Entry

```
Name:              TechCorp - Backend Intern
Role:              Backend Developer Intern
Location:          Bangalore, India
Status:            New
Priority Score:    92
Matched Skills:    Python, Django, PostgreSQL, REST APIs
Missing Skills:    Docker, Kubernetes
Why This Fits:     Your Python and Django skills match perfectly. They need REST API experience, which you have.
Blocker Reason:    They prefer candidates with DevOps experience (Docker/K8s), which you're learning.
Apply URL:         https://internshala.com/job/...
Apply Timestamp:   2025-03-28
```

---

## 🧠 LLM Configuration

The bot uses AI to rank jobs and extract data. You can choose:

### Option 1: Ollama (Local, Free, Private) — **Recommended for Privacy**

**What it is**: Local LLM running on your computer (no data sent anywhere)

**Setup**:
```bash
# 1. Download Ollama from https://ollama.ai/

# 2. Install and start it (opens background service)
ollama serve

# 3. Download a small model (one-time, ~2GB)
ollama run qwen2.5:3b

# 4. In your .env:
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_API_URL=http://localhost:11434/api/chat
LLM_PROVIDER=ollama
```

**Pros**: Free, private, fast, works offline
**Cons**: Needs 4GB+ RAM, slower on first request
**Speed**: 30-60 seconds per job ranking

---

### Option 2: Gemini (Cloud, Free Tier, Faster) — **Recommended for Speed**

**What it is**: Google's AI API, 60 requests/min free tier

**Setup**:
```bash
# 1. Go to https://ai.google.dev/
# 2. Click "Get API Key"
# 3. Create a new project
# 4. Copy the API key to .env:

GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.0-flash
LLM_PROVIDER=gemini

# 5. Leave OLLAMA keys in .env, they'll be used as fallback
```

**Pros**: Fast (3-5 sec per job), free tier, no local setup
**Cons**: Data sent to Google, rate limit (60 req/min), needs internet
**Speed**: 3-5 seconds per job ranking

---

### Option 3: Hybrid (Recommended for Production)

Use Gemini primary, Ollama as fallback:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key-here

# If Gemini is down or rate-limited, Ollama kicks in automatically
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_API_URL=http://localhost:11434/api/chat
```

**Benefit**: Fast most of the time, always works even if one provider is down

---

## 🐛 Troubleshooting

### "Bot not responding"

**Problem**: You send a message but bot doesn't reply

**Solutions**:
```bash
# 1. Check if bot is running
python app.py
# Should show: ✅ Telegram bot started, listening for messages...

# 2. Check if token is correct
# Go to .env, verify TELEGRAM_BOT_TOKEN starts with numbers, contains colon

# 3. Try sending /start command
# If that doesn't work, bot token is wrong

# 4. Check logs for errors
# Look at terminal output, should show message received
```

---

### "Notion workspace not created"

**Problem**: Bot runs but no "AI Internship Agent" page in Notion

**Solutions**:
```bash
# 1. Check if NOTION_API_KEY is correct
# Should start with "ntn_" and be very long

# 2. Check if bot shared with your Notion
# In Notion, click Share → Add the bot integration

# 3. Try initializing manually
python3 -c "
from internship_agent.notion import init_notion
init_notion()
print('Workspace created!')
"

# 4. Check Notion settings for API key
# https://www.notion.so/my-integrations → Copy full token
```

---

### "No internships found" when searching

**Problem**: You search but get 0 results

**Solutions**:
```bash
# 1. Check if profile is filled
/profile
# Should show your skills and experience

# 2. Try a simpler search
/find internship        # Too generic, try more specific

# 3. Check if web scraping is working
# LinkedIn/Internshala might have changed HTML
# Check app.py logs for scraping errors

# 4. Try a different location
/find python remote     # Instead of very specific location
```

---

### "LLM keeps timing out"

**Problem**: Bot says "Ollama error" or "timeout"

**Solutions**:

**If using Ollama**:
```bash
# 1. Check if Ollama is running
# Should see "Serving on http://localhost:11434"

# 2. Check model is loaded
ollama list
# Should show qwen2.5:3b

# 3. Restart Ollama
pkill ollama
ollama serve
```

**If using Gemini**:
```bash
# 1. Check API key is correct
# Should start with "AIza..." or "ai_..."

# 2. Check rate limit
# Free tier: 60 requests/minute
# If hitting limit, wait 1 minute

# 3. Try Ollama fallback
# Install Ollama as backup
```

---

### "Internship data not saving to Notion"

**Problem**: Bot says "found 20 jobs" but nothing appears in database

**Solutions**:
```bash
# 1. Check Notion integration has database access
# In Notion, right-click database → Share → Bot should be invited

# 2. Verify database schema
# In Notion, check "Internship Tracker" has columns:
#   - Name (Title)
#   - Role
#   - Location
#   - Status
#   - etc.

# 3. Check logs for schema errors
# Terminal should show "Creating internship..." messages

# 4. Manual check - Add a row
# From Telegram: /test_save
# Should create a test row in Notion
```

---

### "GEMINI_API_KEY is blank or missing"

**Problem**: Error says "GEMINI_API_KEY not set"

**Solutions**:
```bash
# 1. If you don't want to use Gemini, set this in .env:
LLM_PROVIDER=ollama
# And ensure Ollama is running

# 2. If you want Gemini:
# Go to https://ai.google.dev/
# Click "Get API Key" → Create project
# Copy full key into .env:
GEMINI_API_KEY=AIza...your...key...here
```

---

## 🏗️ Architecture

### How Data Flows

```
┌─────────────────────────────────────────────────┐
│ TELEGRAM USER                                   │
│ "find python india"                             │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ BOT (app.py)                                    │
│ 1. Parse command                                │
│ 2. Extract keywords (AI)                        │
│ 3. Search jobs (web scraping)                   │
│ 4. Rank jobs (AI against profile)               │
└──────────────┬──────────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
  ┌────────┐      ┌──────────────┐
  │ NOTION │      │ OLLAMA/GEMINI│
  │        │      │ AI Engine    │
  │Profile │      │              │
  │Database│      │- Rank jobs   │
  │        │      │- Extract     │
  └────────┘      │- Cover letter│
                  └──────────────┘
```

### Component Structure

| Component | Purpose | Tech |
|-----------|---------|------|
| **Telegram Bot** | User interface | python-telegram-bot |
| **Notion API** | Data storage | notion-client |
| **Job Scraping** | Collect listings | Playwright, BeautifulSoup |
| **LLM Ranking** | AI evaluation | Ollama or Gemini |
| **Profile Parser** | Extract resume data | LLM + regex |
| **Auto-Apply** | Form filling | Playwright |

---

## 📈 Performance & Limits

| Task | Time | Limit |
|------|------|-------|
| Search + Rank 50 jobs | 2-5 min | 100 jobs/search |
| Generate cover letter | 5-10 sec | Unlimited |
| Save to Notion | 1-2 sec per job | Notion rate limits |
| Profile parsing | 10 sec | 5000 chars (auto-truncated) |

---

## 🔐 Privacy & Security

### What Data is Stored?

**On Your Computer**:
- `.env` file (API keys) — Never commit to git

**In Notion** (you control):
- Resume/profile
- Job listings
- Application status
- Your analysis

**In Ollama** (local):
- Nothing — all processing on your machine

**In Gemini** (if using):
- Your job description text
- Your resume text (truncated to 5000 chars)
- Temporary, not stored

### Safety Tips

1. **Never commit `.env` to git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Rotate your API keys if they leak**
   - Telegram: Create new bot at @BotFather
   - Notion: Revoke at notion.so/my-integrations
   - Gemini: Delete at console.cloud.google.com

3. **Use Ollama for private resumes**
   - Ollama never sends data to cloud

---

## 📚 Examples

### Example Search Queries

```
/find python               → Python internships, remote
/find backend india        → Backend role, India
/find frontend london      → Frontend, London
/find data science remote  → Data Science, Remote
/find devops              → DevOps, your preferred location
/find machine learning    → ML, your preferred location
```

### Example Profile (What to Fill)

**About Me**:
> I'm a 3rd year CS student at XYZ University, passionate about backend development and scalable systems. Currently learning Django and PostgreSQL, seeking 3-month internship to grow professionally.

**Skills**:
> Python, Django, Flask, PostgreSQL, MySQL, REST APIs, Git, Linux, Docker, JavaScript

**Projects**:
> - Weather Dashboard (React, OpenWeather API, real-time updates)
> - Blog CMS (Django, user auth, comments, search)
> - Stock Trading Bot (Python, data analysis, ML model)

**Resume**:
> [Paste your full resume here]

**Preferences**:
> Location: India, specifically Bangalore/Pune
> Type: Hybrid (remote + onsite)
> Duration: 3-6 months
> Salary: ₹25,000-50,000/month
> Focus: Backend/DevOps/Data Science

---

## 🤝 Contributing

Found a bug? Have an idea? Open an issue on GitHub!

---

## 📞 Support

- **Bot not working?** Check [Troubleshooting](#troubleshooting) section
- **Question about features?** Read the [Using the Bot](#using-the-bot) section
- **Issue with Notion?** Check your API key and database schema
- **LLM problems?** Try switching providers (Ollama ↔ Gemini)

---

## 📜 License

MIT License — use freely, no warranties

---

## 🚀 What's Next?

**Coming Soon**:
- ✅ Email verification for auto-apply
- ✅ Advanced job filters (salary, remote, duration)
- ✅ Job alert subscriptions
- ✅ Interview prep tips
- ✅ Salary negotiation assistant

---

## 🎓 How This Helps You

1. **Saves Time**: No more manually applying to 50+ jobs
2. **Smart Matching**: AI finds jobs that fit YOUR skills
3. **Organized**: Everything tracked in Notion
4. **Personalized**: Uses your real resume, not generic templates
5. **Free (mostly)**: Ollama is free, Gemini has free tier
6. **Private**: Your choice of local or cloud LLM

---

## 📝 Quick Reference Card

```
SETUP:
1. pip install -r requirements.txt
2. Create .env with API keys
3. python app.py
4. Message bot: /start

USAGE:
- Fill Notion profile pages (5 minutes)
- Search: /find python india
- Review results in Notion
- Apply via links

IF STUCK:
- /help (in Telegram)
- Check .env file
- Verify API keys
- Check Notion workspace
- See Troubleshooting section
```

---

**Made with ❤️ to help you land your dream internship!**
