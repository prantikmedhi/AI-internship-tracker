"""
Notion AI Agent - Telegram bot powered by Ollama and Notion.

Main entry point combining Notion operations with LLM-powered AI.
"""
import os
import asyncio
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

from internship_agent.notion import get_notion, init_notion, create_internship
from internship_agent.notion.workspace import get_workspace_overview, search_workspace
from internship_agent.notion.reader import (
    read_page_blocks,
    read_database,
    read_file_attachments,
)
from internship_agent.notion.writer import (
    create_page,
    create_database,
    append_text_to_page,
)
from internship_agent.notion.database import add_row, update_row, add_column
from internship_agent.jobs import search_internships
from internship_agent.notion.profile import get_user_profile
from internship_agent.llm import rank_all, extract_search_keywords
from internship_agent.log.logger import log
import re

# Load environment
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")

# Initialize clients
try:
    notion = get_notion()
except ValueError:
    print("❌ Error: NOTION_API_KEY not set in .env file")
    notion = None

conversation_history = {}

# System prompt for Ollama
SYSTEM_PROMPT = """You are a general-purpose AI assistant for Notion, controlled via Telegram.

## CORE BEHAVIOR:
- User says something → Find it → Read it → Analyze it → Reply

## CRITICAL RULES:
1. NEVER ask for page IDs or UUIDs (they're pre-injected)
2. NEVER ask user to paste content (use read_notion_blocks or read_notion_file)
3. ALWAYS read immediately after finding a page
4. READ THEN ANALYZE without asking for more input

## TOOLS:
- Found a PAGE? → Call read_notion_blocks immediately
- Found a DATABASE? → Call read_notion_database immediately
- Page has files? → Call read_notion_file immediately

## REPLY STYLE:
- Be brief, natural, and friendly
- NEVER show raw UUIDs or page IDs
- Give ONE short confirmation sentence
- After analysis, give actual insight

## EXAMPLE REPLIES:
✅ "Your database is updated, check it out!"
✅ "Done! Added the new row to your tracker."
✅ "Here's your resume summary: [actual summary]"
❌ "Row added to database 32f89966-2ae5-8132-b42f-e89393af5150"
"""

# =============================================================================
# NATURAL LANGUAGE PROCESSING HELPERS
# =============================================================================

def is_greeting(message: str) -> bool:
    """Detect if message is a greeting."""
    greetings = [
        "hi", "hello", "hey", "hola", "namaste",
        "greetings", "yo", "what's up", "wassup",
        "good morning", "good afternoon", "good evening",
    ]
    message_lower = message.lower().strip()
    return any(msg in message_lower for msg in greetings) and len(message_lower) < 20

def parse_internship_query(message: str) -> tuple[str, str]:
    """
    Parse natural language internship search queries.

    Examples:
    - "I want to search internship in UK" → ("internship", "UK")
    - "find python developer roles in india" → ("python developer", "india")
    - "search for frontend jobs london" → ("frontend", "london")

    Returns: (keywords, location)
    """
    message_lower = message.lower()

    # Common location words
    locations = {
        "uk": "UK", "united kingdom": "UK",
        "us": "USA", "usa": "USA", "united states": "USA",
        "india": "India", "bangalore": "Bangalore", "mumbai": "Mumbai", "delhi": "Delhi",
        "london": "London", "manchester": "Manchester", "glasgow": "Glasgow",
        "canada": "Canada", "toronto": "Toronto", "vancouver": "Vancouver",
        "australia": "Australia", "sydney": "Sydney", "melbourne": "Melbourne",
        "singapore": "Singapore", "dubai": "Dubai", "uae": "UAE",
        "germany": "Germany", "france": "France", "japan": "Japan",
        "remote": "Remote", "work from home": "Remote",
    }

    # Extract location from message
    location = ""
    for loc_key, loc_name in locations.items():
        if loc_key in message_lower:
            location = loc_name
            break

    # Remove common phrases to extract keywords
    keywords = message_lower
    remove_phrases = [
        "i want to", "i'm looking for", "i am looking for",
        "search", "find", "find me", "show me",
        "internship", "internships", "job", "jobs",
        "in ", " in", "at ", " at",
        "please", "can you", "could you",
        "positions", "role", "roles",
        "opportunity", "opportunities",
    ]

    for phrase in remove_phrases:
        keywords = keywords.replace(phrase, " ")

    # Also remove extracted location from keywords
    if location:
        keywords = keywords.replace(location.lower(), " ")

    # Clean up stopwords
    stopwords = {
        "a", "an", "the", "and", "or", "but", "is", "are", "am",
        "for", "to", "of", "with", "on", "from", "as", "by",
        "me", "my", "i", "you", "your", "we", "they", "it",
    }

    words = [w.strip() for w in keywords.split() if w.strip() and len(w.strip()) > 2 and w.strip() not in stopwords]
    keywords = " ".join(words) if words else "internship"

    return keywords.strip(), location.strip()

def get_greeting_response() -> str:
    """Generate a friendly greeting response."""
    greetings = [
        "👋 Hey there! Ready to find your next internship?",
        "👋 Hi! I can help you find internships. Just tell me what you're looking for!",
        "👋 Hello! Want to search for internships or explore your Notion workspace?",
        "👋 Hey! Looking for internships? Tell me what role and location you're interested in!",
    ]
    import random
    return random.choice(greetings)

# =============================================================================
# TELEGRAM COMMANDS
# =============================================================================


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Start command - greeting and help."""
    await update.message.reply_text(
        "Hi! I'm your Notion AI agent. I can help you search, read, and manage your Notion workspace.\n"
        "Type /help to see all commands."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Help command - show available commands."""
    help_text = """
📋 Available Commands:

/search <query> - Search workspace for pages/databases
/read <page/db name> - Read page content or database rows
/add_page <parent> | <title> | <content> - Create a new page
/add_db <parent> | <title> - Create a new database
/append <page> | <text> - Append text to a page
/add_row <database> | <json> - Add database row
/update_row <row> | <json> - Update database row
/clear - Clear conversation memory

Or just send a message - I'll search Notion automatically!
"""
    await update.message.reply_text(help_text)


async def search_command(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Search workspace."""
    query = " ".join(context.args) if context.args else ""
    if not query:
        await update.message.reply_text("Usage: /search <query>")
        return

    result = search_workspace(query, notion)
    await update.message.reply_text(result[:4000])


async def read_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Read page or database."""
    target = " ".join(context.args) if context.args else ""
    if not target:
        await update.message.reply_text("Usage: /read <page or database name>")
        return

    # Try reading as page first
    result = read_page_blocks(target, notion)
    if "No readable" not in result:
        await update.message.reply_text(result[:4000])
    else:
        # Try as database
        result = read_database(target, notion)
        await update.message.reply_text(result[:4000])


async def add_page_command(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Add a new page."""
    if "|" not in update.message.text:
        await update.message.reply_text(
            "Usage: /add_page <parent> | <title> | <content>"
        )
        return

    parts = update.message.text.split("|")
    if len(parts) < 3:
        await update.message.reply_text(
            "Usage: /add_page <parent> | <title> | <content>"
        )
        return

    parent = parts[0].replace("/add_page", "").strip()
    title = parts[1].strip()
    content = parts[2].strip()

    result = create_page(parent, title, content, notion)
    await update.message.reply_text(result)


async def add_row_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Add a database row."""
    if "|" not in update.message.text:
        await update.message.reply_text(
            'Usage: /add_row <database> | <json>\n'
            'Example: /add_row Jobs | {"Company": "Google", "Status": "Applied"}'
        )
        return

    parts = update.message.text.split("|", 1)
    if len(parts) < 2:
        await update.message.reply_text("Invalid format.")
        return

    db = parts[0].replace("/add_row", "").strip()
    props_json = parts[1].strip()

    result = add_row(db, props_json, notion)
    await update.message.reply_text(result)


async def append_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Append text to a page."""
    if "|" not in update.message.text:
        await update.message.reply_text("Usage: /append <page> | <text>")
        return

    parts = update.message.text.split("|", 1)
    if len(parts) < 2:
        await update.message.reply_text("Invalid format.")
        return

    page = parts[0].replace("/append", "").strip()
    text = parts[1].strip()

    result = append_text_to_page(page, text, notion)
    await update.message.reply_text(result)


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Clear conversation memory."""
    chat_id = update.effective_chat.id
    if chat_id in conversation_history:
        conversation_history[chat_id] = []
    await update.message.reply_text("Memory cleared!")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle free-form messages - intelligently search Notion and respond.

    Supports:
    - Greetings: "hi", "hello", etc. → Friendly response
    - Internship queries: "find python in india", "I want internship in UK" → Searches and ranks
    - Generic search: "search <keyword>" → Searches Notion
    - Database read: "read <database>" → Reads database
    - Any other message → Smart Notion search or greeting
    """
    user_message = update.message.text.strip()
    chat_id = update.effective_chat.id

    if not notion:
        await update.message.reply_text(
            "❌ Error: Notion not connected. Check your NOTION_API_KEY in .env"
        )
        return

    # Show loading message
    status_msg = await update.message.reply_text("🔍 Processing your request...")

    try:
        # ─── DETECT USER INTENT ─────────────────────────────────────────────
        message_lower = user_message.lower()

        # Intent 0: Greeting
        if is_greeting(user_message):
            response = get_greeting_response()
            await status_msg.edit_text(response)
            return

        # Intent 1: Find/Search Internships (Profile-First + AI Ranking)
        # Check for explicit internship keywords OR natural language internship queries
        is_internship_query = any(word in message_lower for word in ["find intern", "search intern", "internship", "job", "role"])
        is_natural_language = any(phrase in message_lower for phrase in ["want to", "looking for", "search for", "find me"])

        if is_internship_query or (is_natural_language and any(word in message_lower for word in ["intern", "job", "role", "position"])):

            # ── Step 1: Read user profile ───────────────────────────────────────
            await status_msg.edit_text("📊 Reading your Notion profile...")
            profile = {}
            try:
                profile = get_user_profile()
            except Exception as e:
                log.warning(f"get_user_profile failed: {e}")

            # If profile pages are empty, scan workspace for resume/CV pages
            has_profile = any(v.strip() for v in profile.values())
            if not has_profile:
                await status_msg.edit_text("📄 No profile found — scanning workspace for resume/CV...")
                try:
                    from internship_agent.notion.profile import scan_and_sync_profile
                    sync_result = scan_and_sync_profile()
                    log.info(f"Profile sync result: {sync_result}")
                    profile = get_user_profile()  # reload after sync
                except Exception as e:
                    log.warning(f"scan_and_sync_profile failed: {e}")

            # ── Step 2: Extract search keywords from message and profile ──────
            await status_msg.edit_text("🧠 Extracting search keywords...")
            keywords = ""
            location = ""

            # Try natural language parsing first
            try:
                parsed_keywords, parsed_location = parse_internship_query(user_message)
                if parsed_keywords and parsed_keywords != "internship":
                    keywords = parsed_keywords
                    location = parsed_location
                    log.info(f"Parsed keywords: '{keywords}', location: '{location}'")
            except Exception as e:
                log.warning(f"parse_internship_query failed: {e}")

            # If natural language parsing didn't get keywords, use LLM
            if not keywords:
                try:
                    keywords, location, reason = extract_search_keywords(profile, hint=user_message)
                    log.info(f"LLM keywords: '{keywords}', location: '{location}', reason: {reason}")
                except Exception as e:
                    log.warning(f"extract_search_keywords failed: {e}")

            # Final fallback
            if not keywords or keywords.isspace():
                keywords = "software engineering intern"

            # ── Step 3: Scrape jobs ──────────────────────────────────────────────
            await status_msg.edit_text(f"🔍 Searching for **{keywords}** internships{f' in {location}' if location else ''}...")
            try:
                online_jobs = await search_internships(keywords, location or "remote", limit=10)
            except Exception as e:
                log.error(f"search_internships failed: {e}")
                online_jobs = []

            if online_jobs:
                # ── Step 4: Rank all jobs against user profile ───────────────────
                await status_msg.edit_text(f"🤖 Analyzing {len(online_jobs)} jobs against your profile...")
                ranked_jobs = online_jobs  # fallback: use raw if ranking fails
                try:
                    ranked_jobs = await asyncio.get_event_loop().run_in_executor(
                        None, rank_all, profile, online_jobs
                    )
                    log.info(f"Ranked {len(ranked_jobs)} jobs successfully")
                except Exception as e:
                    log.warning(f"rank_all failed, saving without ranking: {e}")

                # ── Step 5: Save enriched jobs to Notion ────────────────────────
                result = f"🔍 Found {len(online_jobs)} internships for: **{keywords}**{f' in {location.upper()}' if location else ''}\n\n"
                result += "💼 **Online Listings (ranked by fit):**\n"

                saved_count = 0
                for idx, job in enumerate(ranked_jobs[:8], 1):
                    company = job.get("company", "Unknown")
                    role = job.get("role", "Unknown")
                    url = job.get("url", "")
                    location_job = job.get("location", "Remote")
                    score = job.get("priority_score", 0)

                    try:
                        created_id = create_internship(job)
                        if created_id:
                            saved_count += 1
                    except Exception as e:
                        log.error(f"Failed to save {company} to Notion: {e}")

                    score_label = f" | 🎯 {score}%" if score else ""
                    result += f"{idx}. **{company}** - {role}\n"
                    result += f"   📍 {location_job}{score_label} | [Apply →]({url})\n"
                    result += f"   {job.get('description', '')[:80]}...\n\n"

                if saved_count > 0:
                    result += f"✅ **Saved {saved_count} jobs to your Notion 'Internship Tracker' with skills analysis.**"
                else:
                    result += "⚠️ Found jobs, but failed to save them to Notion. Check logs."

                response = result
            else:
                response = f"❌ No internships found for '{keywords}'. Try:\n• Different keywords\n• Different location\n• Use /search to browse your Notion workspace"

        # Intent 2: Generic search
        elif message_lower.startswith("search "):
            query = user_message.replace("search ", "").strip()
            response = search_workspace(query, notion)

        # Intent 3: Read a database
        elif message_lower.startswith("read "):
            db_name = user_message.replace("read ", "").strip()
            response = read_database(db_name, notion)

        # Intent 4: Read a page
        elif message_lower.startswith("show "):
            page_name = user_message.replace("show ", "").strip()
            response = read_page_blocks(page_name, notion)

        # Intent 5: Workspace overview
        elif message_lower in ["overview", "show all", "workspace"]:
            response = get_workspace_overview(notion)

        # Intent 6: Smart search based on keywords
        else:
            # Extract meaningful keywords from message
            stopwords = {
                "what", "how", "where", "when", "why", "is", "the", "a", "an",
                "and", "or", "but", "show", "find", "search", "get", "tell",
                "me", "my", "i", "you", "can", "do", "please", "thanks",
            }
            words = [
                w for w in message_lower.split()
                if len(w) > 3 and w not in stopwords
            ]

            if words:
                query = " ".join(words[:3])  # Use top 3 keywords
                response = f"🔍 Searching your Notion for: **{query}**\n\n"
                response += search_workspace(query, notion)
            else:
                # No clear intent - provide helpful guidance
                response = (
                    "👋 I can help you with a few things:\n\n"
                    "**Search for Internships:**\n"
                    "• \"find python internship\"\n"
                    "• \"I want to search for frontend jobs in UK\"\n"
                    "• \"find machine learning internship in india\"\n\n"
                    "**Notion Commands:**\n"
                    "• `search <keyword>` - Search your Notion workspace\n"
                    "• `read <database>` - Read a database\n"
                    "• `show <page>` - Show a page content\n\n"
                    "Or just tell me what you're looking for! 😊"
                )

        # ─── SEND RESPONSE ──────────────────────────────────────────────────
        # Cap response to Telegram limit (4096 chars)
        if len(response) > 4000:
            response = response[:3900] + "\n\n... (truncated)"

        await status_msg.edit_text(response)

    except Exception as e:
        error_msg = f"❌ Error processing request: {str(e)}\n\nTry using specific commands like /search or /read"
        try:
            await status_msg.edit_text(error_msg)
        except Exception:
            await update.message.reply_text(error_msg)


def main() -> None:
    """Start the Telegram bot."""
    if not TELEGRAM_BOT_TOKEN:
        print("Error: TELEGRAM_BOT_TOKEN not found in .env")
        return

    # Initialize Notion workspace (create DB and headers if missing)
    if notion:
        try:
            init_notion()
        except Exception as e:
            print(f"⚠️ Notion init warning: {e}")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Add handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("search", search_command))
    app.add_handler(CommandHandler("read", read_command))
    app.add_handler(CommandHandler("add_page", add_page_command))
    app.add_handler(CommandHandler("add_row", add_row_command))
    app.add_handler(CommandHandler("append", append_command))
    app.add_handler(CommandHandler("clear", clear_command))
    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    print("Starting Notion AI Agent on Telegram...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    main()
