import os
from dotenv import load_dotenv

load_dotenv()

# ──── Telegram ────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# ──── Notion ────
NOTION_API_KEY = os.getenv("NOTION_API_KEY", "")
NOTION_PARENT_PAGE_ID = os.getenv("NOTION_PARENT_PAGE_ID", "")
ROOT_PAGE_NAME = "AI Internship Agent"
INTERNSHIP_DB_NAME = "Internship Tracker"
PROFILE_PAGES = ["About Me", "Skills", "Projects", "Resume", "Preferences"]

# ──── LLM (Ollama) ────
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/chat")
OLLAMA_TIMEOUT_FAST = int(os.getenv("OLLAMA_TIMEOUT_FAST", "60"))
OLLAMA_TIMEOUT_SLOW = int(os.getenv("OLLAMA_TIMEOUT_SLOW", "120"))

# ──── LLM (Gemini fallback) ────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # "ollama" or "gemini"

# ──── Playwright / Apply ────
SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", "screenshots")
DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"
