# Complete App Setup & Run Guide

## 🎯 What This App Does

This is a **Notion AI Agent** that:
- Connects to your Notion workspace via Telegram
- Reads/writes pages and databases
- Searches your Notion content
- Manages internship applications
- Uses AI to rank and analyze jobs

---

## 📋 Prerequisites

You need:
1. **Python 3.8+** (check: `python3 --version`)
2. **Telegram Account** (to control the bot)
3. **Notion Account** (to manage data)
4. **API Keys** (from Telegram & Notion)

---

## 🔑 Step 1: Get API Keys

### A. Telegram Bot Token

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts:
   - Bot name: "Notion Agent" (or whatever you want)
   - Bot username: "notion_agent_yourname" (must be unique)
4. **Copy the token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### B. Notion API Key

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"Create new integration"**
3. Fill in:
   - Name: "Notion MCP" or "Claude Code"
   - Logo: (optional)
   - Associated workspace: (select yours)
4. Click **Create**
5. On the next page, copy the **Internal Integration Token** (looks like: `secret_abc123def456...`)

### C. Notion Parent Page ID (Optional)

1. Open your Notion workspace
2. Create a page called "AI Internship Agent" (or use existing)
3. Click the **•••** menu → **Copy link**
4. Extract the ID from the URL:
   - URL: `https://www.notion.so/your-workspace-abc123def456?v=xyz...`
   - ID: `abc123def456` (the part after workspace name)

---

## ⚙️ Step 2: Configure `.env` File

1. Open `.env` file in your editor:
   ```bash
   nano /Users/prantikpratimmedhi/Projects/notion-mcp-phase1/.env
   ```

2. Fill in your tokens:
   ```env
   # REQUIRED - Get from @BotFather on Telegram
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

   # REQUIRED - Get from Notion Integrations
   NOTION_API_KEY=secret_abc123def456ghi789jkl012mno345pqr

   # OPTIONAL - For AI features (leave as-is if you don't have Ollama)
   OLLAMA_API_URL=http://localhost:11434/api/generate
   OLLAMA_MODEL=qwen2.5:3b

   # OPTIONAL - For internship tracking
   NOTION_PARENT_PAGE_ID=abc123def456  # Your page ID from step 1C
   ROOT_PAGE_NAME=AI Internship Agent
   INTERNSHIP_DB_NAME=Internship Tracker
   ```

3. Save and exit (Ctrl+X, then Y, then Enter if using nano)

---

## 🚀 Step 3: Run the Complete App

### Option A: Using Setup Script (Easiest)

```bash
cd /Users/prantikpratimmedhi/Projects/notion-mcp-phase1 && bash setup.sh
```

Then choose **option [1]** to start the bot.

### Option B: Manual Start

```bash
# Navigate to project
cd /Users/prantikpratimmedhi/Projects/notion-mcp-phase1

# Activate virtual environment
source venv/bin/activate

# Run the app
python app.py
```

### Option C: One-Line Command

```bash
cd /Users/prantikpratimmedhi/Projects/notion-mcp-phase1 && source venv/bin/activate && python app.py
```

---

## ✅ Verify It's Running

When the app starts, you should see:
```
Starting Notion AI Agent on Telegram...
```

The bot is now **listening for messages** on Telegram.

---

## 🤖 Step 4: Test in Telegram

1. Open Telegram
2. Search for your bot: **@your_bot_username**
3. Send these commands:

### Test Commands

```
/start
```
Response: "Hi! I'm your Notion AI agent..."

```
/help
```
Response: Shows all available commands

```
/search resume
```
Response: Searches your Notion workspace for "resume"

```
/read My Database
```
Response: Shows rows from "My Database"

---

## 📚 Available Commands

| Command | What It Does | Example |
|---------|-------------|---------|
| `/start` | Start the bot | `/start` |
| `/help` | Show all commands | `/help` |
| `/search <query>` | Search Notion | `/search Python internship` |
| `/read <page>` | Read a page or database | `/read Internship Tracker` |
| `/add_page <parent> \| <title> \| <content>` | Create page | `/add_page Workspace \| New Job \| Applied to Google` |
| `/add_row <db> \| <json>` | Add database row | `/add_row Jobs \| {"Company": "Google", "Status": "Applied"}` |
| `/append <page> \| <text>` | Add text to page | `/append Notes \| New note here` |
| `/clear` | Clear memory | `/clear` |

### Command Examples

**Search for a page:**
```
/search resume
```

**Read your internship tracker:**
```
/read Internship Tracker
```

**Add a new job:**
```
/add_row Jobs | {"Company": "Microsoft", "Role": "SWE Intern", "Status": "New"}
```

---

## 🧪 Step 5: Test Different Features

### A. Test Notion Connection

```
/search test
```
Should return search results from your Notion workspace.

### B. Test Database Reading

```
/read Internship Tracker
```
Should show your internship database (if it exists).

### C. Test Creating a Page

```
/add_page Workspace | Test Page | This is a test
```
Should create a new page in Notion.

### D. Test Adding Database Row

```
/add_row Jobs | {"Company": "TestCorp", "Role": "Tester", "Status": "New"}
```
Should add a row to your Jobs database.

---

## 🛑 Troubleshooting

### Issue: "Notion client not initialized"

**Solution**: Check that `NOTION_API_KEY` is set in `.env`
```bash
grep NOTION_API_KEY .env
```

Should show: `NOTION_API_KEY=secret_abc123...`

### Issue: Bot doesn't respond

**Solution**: Check the token in `.env`
```bash
grep TELEGRAM_BOT_TOKEN .env
```

Should show: `TELEGRAM_BOT_TOKEN=123456789:ABC...`

### Issue: "Permission denied" errors

**Solution**: Share your Notion pages with the integration
1. Go to the page in Notion
2. Click **Share** button
3. Find "Notion MCP" (or your integration name)
4. Click to share

### Issue: "Module not found" errors

**Solution**: Reinstall dependencies
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: App crashes immediately

**Solution**: Check the logs
```bash
python app.py 2>&1 | head -50
```

---

## 📊 Architecture Overview

```
Your Telegram Message
        ↓
app.py (Telegram Handler)
        ↓
internship_agent/ (Modular Components)
├── notion/          (Read/Write Notion)
├── llm/             (AI & Ranking)
├── jobs/            (Job Search)
└── apply/           (Auto-Apply)
        ↓
Notion API
        ↓
Your Notion Workspace
```

---

## 🔄 Full Workflow Example

### 1. Start the App
```bash
python app.py
```

### 2. Search for Internships (in Telegram)
```
/search python internship
```

### 3. App Searches Notion
The app searches your Notion workspace for Python internships.

### 4. Read Your Tracker
```
/read Internship Tracker
```

### 5. View Results
Shows all saved internships with scores and details.

---

## ⏸️ Stop the App

Press **Ctrl+C** in the terminal:
```
^C
```

This will:
- Stop the bot
- Close the Telegram connection
- Exit gracefully

---

## 🎉 You're Done!

Now you have a fully functional **Notion AI Agent** that:
✅ Connects via Telegram
✅ Reads/writes Notion pages
✅ Searches databases
✅ Tracks internships
✅ Uses AI to rank jobs

---

## 📖 Next Steps

1. **Explore the code**: Check `ARCHITECTURE.md`
2. **Learn internship tracking**: Check `INTERNSHIP_TRACKER_GUIDE.md`
3. **Understand the fix**: Check `FIX_SUMMARY.md`
4. **Customize**: Edit `app.py` to add more features

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start app | `python app.py` |
| Setup | `bash setup.sh` |
| Edit config | `nano .env` |
| Check logs | `python app.py 2>&1` |
| Stop app | `Ctrl+C` |
| View docs | `cat ARCHITECTURE.md` |

---

**Happy coding! 🚀**
