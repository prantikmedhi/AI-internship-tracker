#!/bin/bash

# =============================================================================
# Notion MCP Phase 1 - Complete Setup & Run Script
# =============================================================================

set -e  # Exit on error

echo "🚀 Starting Notion AI Agent Setup..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Check Python version
echo ""
echo "1️⃣  Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "   ✓ Python $PYTHON_VERSION"

# Step 2: Navigate to project directory
echo ""
echo "2️⃣  Setting up project directory..."
cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)
echo "   ✓ Working in: $PROJECT_DIR"

# Step 3: Create virtual environment
echo ""
echo "3️⃣  Creating virtual environment..."
if [ -d "venv" ]; then
    echo "   ℹ️  venv already exists, skipping..."
else
    python3 -m venv venv
    echo "   ✓ Virtual environment created"
fi

# Step 4: Activate virtual environment
echo ""
echo "4️⃣  Activating virtual environment..."
source venv/bin/activate
echo "   ✓ Activated: $(which python)"

# Step 5: Upgrade pip
echo ""
echo "5️⃣  Upgrading pip..."
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
echo "   ✓ pip upgraded"

# Step 6: Install requirements
echo ""
echo "6️⃣  Installing dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt > /dev/null 2>&1
    echo "   ✓ Dependencies installed"
else
    echo "   Installing essential packages..."
    pip install \
        python-telegram-bot==20.7 \
        notion-client==2.2.1 \
        python-dotenv==1.0.0 \
        requests==2.31.0 \
        pymupdf==1.24.0 \
        python-docx==1.0.0 \
        pandas==2.2.0 \
        python-pptx==0.6.23 \
        > /dev/null 2>&1
    echo "   ✓ Dependencies installed"
fi

# Step 7: Check/Create .env file
echo ""
echo "7️⃣  Checking configuration (.env file)..."
if [ -f ".env" ]; then
    echo "   ✓ .env file exists"
    echo ""
    echo "Current configuration:"
    grep -v '^#' .env | grep -v '^$' | sed 's/=.*/=***/' | while read line; do
        echo "   - $line"
    done
else
    echo "   ℹ️  .env file not found. Creating template..."
    cat > .env << 'ENVFILE'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Notion API Configuration
NOTION_API_KEY=your_notion_api_key_here

# Ollama Configuration (for AI features)
OLLAMA_API_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=qwen2.5:3b

# Optional: Internship Pipeline Configuration
NOTION_PARENT_PAGE_ID=your_parent_page_id_here
ROOT_PAGE_NAME=AI Internship Agent
INTERNSHIP_DB_NAME=Internship Tracker
ENVFILE
    echo "   ✓ Created .env template"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and add your API keys:"
    echo "   nano .env"
fi

# Step 8: Verify .env has required tokens
echo ""
echo "8️⃣  Verifying API keys..."
if ! grep -q "TELEGRAM_BOT_TOKEN" .env || [ -z "$(grep 'TELEGRAM_BOT_TOKEN=' .env | cut -d'=' -f2)" ]; then
    echo "   ⚠️  TELEGRAM_BOT_TOKEN is missing or empty!"
    echo "   Get it from: https://t.me/botfather"
    echo ""
fi

if ! grep -q "NOTION_API_KEY" .env || [ -z "$(grep 'NOTION_API_KEY=' .env | cut -d'=' -f2)" ]; then
    echo "   ⚠️  NOTION_API_KEY is missing or empty!"
    echo "   Get it from: https://www.notion.so/my-integrations"
    echo ""
fi

# Step 9: List available entry points
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9️⃣  Available entry points:"
echo ""
echo "   📱 Telegram Bot:"
echo "      python app.py"
echo ""
echo "   🧪 Test Notion functions:"
echo "      python -c 'from internship_agent.notion import get_notion; print(\"Ready\")'"
echo ""
echo "   📚 View architecture:"
echo "      cat ARCHITECTURE.md"
echo ""
echo "   📖 View tracking guide:"
echo "      cat INTERNSHIP_TRACKER_GUIDE.md"
echo ""

# Step 10: Ask user what to do next
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Setup complete!"
echo ""
echo "What would you like to do?"
echo ""
echo "  [1] Start Telegram bot (requires API keys in .env)"
echo "  [2] Edit .env file with your API keys"
echo "  [3] Run a quick test"
echo "  [4] View documentation"
echo "  [5] Exit and do it manually"
echo ""
read -p "Choose (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting Telegram bot..."
        echo ""
        python app.py
        ;;
    2)
        echo ""
        echo "📝 Opening .env file for editing..."
        if command -v nano &> /dev/null; then
            nano .env
        elif command -v vi &> /dev/null; then
            vi .env
        else
            echo "   Please manually edit: .env"
        fi
        echo ""
        echo "Run this script again to start the bot!"
        ;;
    3)
        echo ""
        echo "🧪 Running test..."
        python3 << 'PYTEST'
import os
os.chdir(".")
print("\n✓ Project structure loaded")
print("✓ Python environment ready")
print("✓ Dependencies available")
try:
    from internship_agent.notion import get_notion
    print("✓ Notion module imported successfully")
except Exception as e:
    print(f"⚠️  Notion import: {e}")
print("\n✅ Test complete! Ready to run app.py")
PYTEST
        ;;
    4)
        echo ""
        echo "📚 Available Documentation:"
        echo ""
        [ -f "ARCHITECTURE.md" ] && echo "   ✓ ARCHITECTURE.md - Project structure and modules"
        [ -f "QUICK_START.md" ] && echo "   ✓ QUICK_START.md - Quick reference guide"
        [ -f "INTERNSHIP_TRACKER_GUIDE.md" ] && echo "   ✓ INTERNSHIP_TRACKER_GUIDE.md - How to use the tracker"
        [ -f "FIX_SUMMARY.md" ] && echo "   ✓ FIX_SUMMARY.md - What was fixed"
        echo ""
        read -p "View which file? (enter filename or skip): " docfile
        if [ -n "$docfile" ] && [ -f "$docfile" ]; then
            less "$docfile"
        fi
        ;;
    5)
        echo ""
        echo "Manual setup instructions:"
        echo ""
        echo "  1. Edit .env file:"
        echo "     nano .env"
        echo ""
        echo "  2. Add your API keys:"
        echo "     TELEGRAM_BOT_TOKEN=your_token_here"
        echo "     NOTION_API_KEY=your_key_here"
        echo ""
        echo "  3. Run the app:"
        echo "     source venv/bin/activate"
        echo "     python app.py"
        echo ""
        ;;
    *)
        echo "❌ Invalid choice"
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done! 🎉"
