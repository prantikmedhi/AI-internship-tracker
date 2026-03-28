#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from internship_agent.notion.setup import init_notion

try:
    init_notion()
    print("SUCCESS: init_notion completed")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()