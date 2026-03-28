#!/usr/bin/env python3
"""Check children of root page to find the database."""
import sys
sys.path.insert(0, '.')

from internship_agent.notion.client import get_notion

notion = get_notion()

# Find root page
results = notion.search(query="AI Internship Agent", page_size=5).get("results", [])
root_page_id = next((item.get("id") for item in results if item.get("object") == "page"), None)
print(f"Root page: {root_page_id}")

# Get children
children = notion.blocks.children.list(block_id=root_page_id).get("results", [])
print(f"Children: {len(children)}")

databases = []
for child in children:
    if child.get("type") == "child_database":
        db_id = child.get("id")
        title = child.get("child_database", {}).get("title", "Unknown")
        databases.append((db_id, title))
        print(f"  DB: {title} ({db_id})")

if databases:
    # Check the last one (most recently created)
    db_id, title = databases[-1]
    print(f"\n--- Checking latest DB: {db_id} ({title}) ---")
    
    db = notion.databases.retrieve(database_id=db_id)
    props = db.get("properties", {})
    print(f"Properties: {list(props.keys())}")
    print(f"Count: {len(props)}")
    
    # Try to add a row
    print(f"\n--- Trying to add a row ---")
    try:
        row = notion.pages.create(
            parent={"database_id": db_id},
            properties={
                "Company": {"title": [{"text": {"content": "Test Company"}}]}
            }
        )
        print(f"SUCCESS: Row created: {row.get('id')}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")