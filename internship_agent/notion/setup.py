"""
Notion workspace initialization and internship database operations.

On first run, auto-provisions:
  - Root page: "AI Internship Agent"
  - Profile sub-pages: About Me, Skills, Projects, Resume, Preferences
  - Internship tracker database with full schema
"""

from datetime import datetime, timezone
from internship_agent.notion.client import get_notion
from internship_agent.log.logger import log
from config import (
    ROOT_PAGE_NAME,
    INTERNSHIP_DB_NAME,
    PROFILE_PAGES,
)


# Module-level cache to avoid re-fetching on every operation
_root_page_id: str | None = None
_db_id: str | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _rich_text(content: str) -> list:
    """Wraps a string in Notion rich_text format."""
    return [{"type": "text", "text": {"content": content}}]


def _get_title_from_page(page: dict) -> str:
    """Extract the plain-text title from a Notion page or database dict."""
    if page["object"] == "page":
        for prop in page.get("properties", {}).values():
            if prop.get("type") == "title" and prop["title"]:
                return prop["title"][0]["plain_text"]
    elif page["object"] == "database":
        try:
            return page["title"][0]["plain_text"]
        except Exception:
            pass
    return "Untitled"


def _search_by_name(name: str, obj_type: str = None) -> list:
    """Search workspace for pages/databases matching a name."""
    notion = get_notion()
    results = notion.search(query=name).get("results", [])
    matches = []
    for item in results:
        if obj_type and item["object"] != obj_type:
            continue
        if _get_title_from_page(item).lower() == name.lower():
            matches.append(item)
    return matches


# ─── Root Page ────────────────────────────────────────────────────────────────

def root_page_exists() -> bool:
    """Check if root page already exists in workspace."""
    global _root_page_id
    if _root_page_id:
        return True
    matches = _search_by_name(ROOT_PAGE_NAME, obj_type="page")
    if matches:
        _root_page_id = matches[0]["id"]
        return True
    return False


def _auto_detect_parent() -> str:
    """Finds the first accessible page in the workspace to use as a parent."""
    notion = get_notion()
    log.info("Auto-detecting parent page from workspace...")

    # Try search with filter first
    try:
        results = notion.search(
            sort={"direction": "descending", "timestamp": "last_edited_time"},
            filter={"property": "object", "value": "page"},
            page_size=20
        ).get("results", [])

        # Look for top-level pages (workspace parent)
        for item in results:
            if item.get("object") == "page":
                parent = item.get("parent", {})
                if parent.get("type") == "workspace":
                    log.success(f"Auto-detected top-level page: {item.get('id')}")
                    return item["id"]

        # Fallback: use first page found even if it's a child
        if results:
            log.success(f"Auto-detected page (child): {results[0].get('id')}")
            return results[0]["id"]
    except Exception as e:
        log.warning(f"Filtered search failed: {e}, trying broader search...")

    # Broader search without filter
    try:
        results = notion.search(
            sort={"direction": "descending", "timestamp": "last_edited_time"},
            page_size=20
        ).get("results", [])

        for item in results:
            if item.get("object") == "page":
                log.success(f"Auto-detected page from broad search: {item.get('id')}")
                return item["id"]
    except Exception as e:
        log.warning(f"Broad search failed: {e}")

    raise RuntimeError(
        "Auto-detect failed: No accessible pages found in your Notion workspace.\n"
        "Please share at least one page with your Notion integration, or set NOTION_PARENT_PAGE_ID in .env.\n\n"
        "To fix:\n"
        "1. Go to https://www.notion.com/my-integrations\n"
        "2. Find your integration and click 'Settings'\n"
        "3. Under 'Capabilities', make sure 'Insert content' is enabled\n"
        "4. Go to Notion and right-click a page → Share → Find your integration → Grant access\n"
        "5. Then run the bot again"
    )


def create_root_workspace(parent_id: str = None) -> str:
    """Creates the root 'AI Internship Agent' page under a detected or configured parent."""
    global _root_page_id
    from config import NOTION_PARENT_PAGE_ID

    if parent_id is None:
        parent_id = NOTION_PARENT_PAGE_ID.strip() if NOTION_PARENT_PAGE_ID else ""
    if not parent_id:
        parent_id = _auto_detect_parent()

    notion = get_notion()
    page = notion.pages.create(
        parent={"type": "page_id", "page_id": parent_id},
        properties={"title": {"title": _rich_text(ROOT_PAGE_NAME)}},
        children=[
            {
                "object": "block",
                "type": "callout",
                "callout": {
                    "rich_text": _rich_text("🤖 This workspace is managed by the AI Internship Agent bot. Do not rename or delete pages."),
                    "icon": {"type": "emoji", "emoji": "🤖"},
                    "color": "blue_background"
                }
            }
        ]
    )
    _root_page_id = page["id"]
    return _root_page_id


# ─── Profile Pages ────────────────────────────────────────────────────────────

def profile_pages_exist() -> bool:
    """Check if all profile pages already exist under root."""
    if not _root_page_id:
        return False
    try:
        notion = get_notion()
        children = notion.blocks.children.list(block_id=_root_page_id).get("results", [])
        child_titles = set()
        for child in children:
            if child["type"] == "child_page":
                child_titles.add(child["child_page"]["title"].lower())
        return all(p.lower() in child_titles for p in PROFILE_PAGES)
    except Exception:
        return False


def create_profile_pages() -> None:
    """Creates the 5 profile sub-pages under the root page."""
    notion = get_notion()
    default_content = {
        "About Me": "Tell the AI about yourself here — your name, background, and career goals.",
        "Skills": "List your technical and soft skills here, one per line.",
        "Projects": "Describe your past projects, links, and what you built.",
        "Resume": "Paste or summarize your resume content here.",
        "Preferences": "Specify internship preferences: location, remote/onsite, fields, salary expectations.",
    }
    for page_name in PROFILE_PAGES:
        notion.pages.create(
            parent={"page_id": _root_page_id},
            properties={"title": {"title": _rich_text(page_name)}},
            children=[
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": _rich_text(default_content.get(page_name, "Fill in your information here."))}
                }
            ]
        )


# ─── Internship Database ──────────────────────────────────────────────────────

def internship_db_exists() -> bool:
    """Check if internship database already exists."""
    global _db_id
    if _db_id:
        return True
    matches = _search_by_name(INTERNSHIP_DB_NAME, obj_type="database")
    if matches:
        _db_id = matches[0]["id"]
        return True
    return False


def _get_db_schema(retries: int = 0) -> dict:
    """Returns a dict of {property_name: property_type} for the internship DB.
    
    Args:
        retries: If > 0, will retry this many times with delays for eventual consistency.
    """
    db_id = get_db_id()
    if not db_id:
        log.error("_get_db_schema: No database ID found")
        return {}
    
    import time
    
    for attempt in range(1 + retries):
        try:
            notion = get_notion()
            
            # Try databases.retrieve first
            db = notion.databases.retrieve(database_id=db_id)
            props = db.get("properties", {})
            
            if props:
                schema = {name: prop["type"] for name, prop in props.items()}
                if attempt > 0:
                    log.info(f"_get_db_schema: Retrieved {len(schema)} properties on retry attempt {attempt}")
                return schema
            
            # databases.retrieve returned empty — try search to get fresh view
            # Note: Notion search doesn't support "database" filter, so search by name and match ID
            search_results = notion.search(
                query=INTERNSHIP_DB_NAME,
                page_size=10
            ).get("results", [])
            
            for item in search_results:
                if item.get("object") == "database":
                    # Match by ID (most reliable) or by exact title
                    item_id = item.get("id", "")
                    if item_id.replace("-", "") == db_id.replace("-", ""):
                        search_props = item.get("properties", {})
                        if search_props:
                            log.info(f"_get_db_schema: Found {len(search_props)} properties via search")
                            return {name: prop["type"] for name, prop in search_props.items()}
                    # Also try title match
                    try:
                        title = item.get("title", [])
                        if title and len(title) > 0:
                            title_text = title[0].get("plain_text", "")
                            if title_text == INTERNSHIP_DB_NAME:
                                search_props = item.get("properties", {})
                                if search_props:
                                    log.info(f"_get_db_schema: Found {len(search_props)} properties via title search")
                                    return {name: prop["type"] for name, prop in search_props.items()}
                    except:
                        pass
            
            if attempt < retries:
                log.info(f"_get_db_schema: attempt {attempt+1}/{retries+1} — DB {db_id} returned 0 properties, waiting 2s...")
                time.sleep(2)
                continue
            
            # Final attempt still empty — dump raw API response for debugging
            log.warning(f"_get_db_schema: Database {db_id} has no properties after {retries+1} attempt(s)")
            # Check if the DB object itself has other identifying info
            db_title = db.get("title", [])
            title_text = ""
            if db_title and isinstance(db_title, list) and len(db_title) > 0:
                title_text = db_title[0].get("plain_text", "")
            log.warning(f"_get_db_schema: raw DB id={db.get('id')}, title='{title_text}', object={db.get('object')}, archived={db.get('archived')}")
            
        except Exception as e:
            log.error(f"_get_db_schema error on attempt {attempt+1}: {e}")
            if attempt < retries:
                time.sleep(2)
    
    return {}

def _get_status_options() -> list:
    """Returns the list of available option names for the Status property."""
    db_id = get_db_id()
    if not db_id:
        return []
    try:
        notion = get_notion()
        db = notion.databases.retrieve(database_id=db_id)
        status_prop = db.get("properties", {}).get("Status", {})
        ptype = status_prop.get("type", "")
        if ptype == "select":
            return [o["name"] for o in status_prop.get("select", {}).get("options", [])]
        elif ptype == "status":
            opts = []
            for group in status_prop.get("status", {}).get("groups", []):
                opts += [o["name"] for o in group.get("options", [])]
            if not opts:
                opts = [o["name"] for o in status_prop.get("status", {}).get("options", [])]
            return opts
    except Exception as e:
        log.error(f"_get_status_options error: {e}")
    return []


def migrate_internship_database() -> None:
    """Adds any missing required columns to an existing Internship DB and updates Status options."""
    if not _db_id:
        return
    schema = _get_db_schema()
    needed = {
        "Role":           {"rich_text": {}},
        "Apply URL":      {"url": {}},
        "Location":       {"rich_text": {}},
        "Priority Score": {"number": {}},
        "Matched Skills": {"multi_select": {}},
        "Missing Skills": {"multi_select": {}},
        "Why This Fits":  {"rich_text": {}},
        "Blocker Reason": {"rich_text": {}},
        "Apply Timestamp":{"date": {}},
    }
    missing = {k: v for k, v in needed.items() if k not in schema}

    # Update Status options to include "Manual Verification Needed"
    try:
        notion = get_notion()
        if missing:
            log.info(f"Migrating DB — adding {len(missing)} missing column(s): {list(missing.keys())}")
            try:
                update_resp = notion.databases.update(database_id=_db_id, properties=missing)
                # Verify the update actually took effect by checking the response
                resp_props = update_resp.get("properties", {})
                log.info(f"Migration update response contains {len(resp_props)} properties")
                if not resp_props:
                    log.warning("Migration update response has no properties — API may not have persisted changes")
                    log.warning("Will attempt to add properties one by one with verification...")
                    import time
                    # Try adding properties one by one as fallback, with verification after each
                    for prop_name, prop_schema in missing.items():
                        try:
                            notion.databases.update(database_id=_db_id, properties={prop_name: prop_schema})
                            # Wait and verify this specific property was added
                            time.sleep(2)
                            db_check = notion.databases.retrieve(database_id=_db_id)
                            props_now = db_check.get("properties", {})
                            if prop_name in props_now:
                                log.info(f"  ✓ Verified: {prop_name} exists in schema")
                            else:
                                log.warning(f"  ✗ Not yet visible: {prop_name} (schema has {len(props_now)} props)")
                            log.info(f"  Added property: {prop_name}")
                        except Exception as prop_err:
                            log.error(f"  Failed to add property '{prop_name}': {type(prop_err).__name__}: {prop_err}")
            except Exception as update_err:
                log.error(f"databases.update FAILED: {type(update_err).__name__}: {update_err}")
                # Try adding properties one by one to identify which one fails
                for prop_name, prop_schema in missing.items():
                    try:
                        notion.databases.update(database_id=_db_id, properties={prop_name: prop_schema})
                        log.info(f"  Added property: {prop_name}")
                    except Exception as prop_err:
                        log.error(f"  Failed to add property '{prop_name}': {type(prop_err).__name__}: {prop_err}")

        # Always ensure Status has all required options
        status_updates = {
            "Status": {
                "select": {
                    "options": [
                        {"name": "New",                      "color": "blue"},
                        {"name": "Applied",                  "color": "yellow"},
                        {"name": "Manual Verification Needed", "color": "orange"},
                        {"name": "Interview",                "color": "green"},
                        {"name": "Rejected",                 "color": "red"},
                        {"name": "Saved",                    "color": "gray"},
                    ]
                }
            }
        }
        notion.databases.update(database_id=_db_id, properties=status_updates)
        
        # Verify migration by re-fetching schema with retries
        import time
        # Wait longer for Notion API to fully propagate all property changes
        log.info("Waiting 8 seconds for Notion API to propagate all property changes...")
        time.sleep(8)
        verified_schema = _get_db_schema(retries=5)
        
        if verified_schema:
            still_missing = [k for k in needed if k not in verified_schema]
            if still_missing:
                log.warning(f"Migration verification: still missing columns after retries: {still_missing}")
            else:
                log.success(f"Migration verified: {len(verified_schema)} properties confirmed")
        else:
            log.error("Migration verification FAILED: schema still empty after retries. "
                       "This indicates a Notion API issue — the update reports success but retrieve returns empty. "
                       "Possible causes: API rate limiting, eventual consistency delay, or integration permission issue.")
        
        if missing:
            log.success("Migration complete" if verified_schema else "Migration update sent but verification failed")
        else:
            log.success("DB schema is up to date")
    except Exception as e:
        log.error(f"Migration error: {e}")


def create_internship_database() -> str:
    """Creates the full Internship Tracker database with all properties in one call.
    
    Note: We include all properties at creation time to avoid the Notion API issue where
    databases.update() returns success but doesn't persist changes when called separately.
    """
    global _db_id
    notion = get_notion()
    
    log.info(f"Creating full database '{INTERNSHIP_DB_NAME}' with all columns...")
    
    # Include ALL properties in the initial creation to work around API bug
    db = notion.databases.create(
        parent={"type": "page_id", "page_id": _root_page_id},
        title=_rich_text(INTERNSHIP_DB_NAME),
        properties={
            "Company":        {"title": {}},
            "Role":           {"rich_text": {}},
            "Apply URL":      {"url": {}},
            "Location":       {"rich_text": {}},
            "Status":         {"select": {"options": [
                {"name": "New",                      "color": "blue"},
                {"name": "Applied",                  "color": "yellow"},
                {"name": "Manual Verification Needed", "color": "orange"},
                {"name": "Interview",                "color": "green"},
                {"name": "Rejected",                 "color": "red"},
                {"name": "Saved",                    "color": "gray"},
            ]}},
            "Priority Score": {"number": {}},
            "Matched Skills": {"multi_select": {}},
            "Missing Skills": {"multi_select": {}},
            "Why This Fits":  {"rich_text": {}},
            "Blocker Reason": {"rich_text": {}},
            "Apply Timestamp":{"date": {}},
        }
    )
    _db_id = db["id"]
    log.success(f"Database created: {_db_id}")
    log.success(f"Internship database '{INTERNSHIP_DB_NAME}' created with full schema")
    return _db_id


# ─── Master init ──────────────────────────────────────────────────────────────

def init_notion() -> None:
    """Auto-provisions the entire Notion workspace structure on startup."""
    try:
        log.info("Initializing Notion workspace...")

        if root_page_exists():
            log.success(f"Root page '{ROOT_PAGE_NAME}' already exists")
        else:
            create_root_workspace()
            log.success(f"Root page '{ROOT_PAGE_NAME}' created")

        if profile_pages_exist():
            log.success("Profile pages already exist")
        else:
            create_profile_pages()
            log.success("Profile pages created (About Me, Skills, Projects, Resume, Preferences)")

        if internship_db_exists():
            log.success(f"Internship database '{INTERNSHIP_DB_NAME}' already exists")
            migrate_internship_database()
        else:
            create_internship_database()
            log.success(f"Internship database '{INTERNSHIP_DB_NAME}' created with full schema")

        log.success("Notion fully configured and ready!")
    except Exception as e:
        log.error(f"Notion initialization failed: {e}")
        raise


# ─── Data Functions ───────────────────────────────────────────────────────────

def get_db_id() -> str | None:
    """
    Returns the internship database ID, attempting lazy discovery if not set.
    Searches the workspace for the database by name if _db_id is not cached.
    """
    global _db_id
    if _db_id:
        return _db_id
    # Attempt lazy discovery
    try:
        notion = get_notion()
        results = notion.search(
            query=INTERNSHIP_DB_NAME,
            page_size=5
        ).get("results", [])
        for item in results:
            if item.get("object") == "database":
                title = _get_title_from_page(item)
                if title == INTERNSHIP_DB_NAME:
                    _db_id = item["id"]
                    log.info(f"get_db_id: lazily discovered DB ID: {_db_id}")
                    return _db_id
    except Exception as e:
        log.warning(f"get_db_id: lazy discovery failed: {e}")
    return None


def get_internships() -> list:
    """Queries ALL rows in the Internship DB and returns them."""
    db_id = get_db_id()
    if not db_id:
        return []
    try:
        notion = get_notion()
        results = notion.databases.query(database_id=db_id).get("results", [])
        schema = _get_db_schema()

        # Find the title property by type (may be called "Company", "Name", etc.)
        title_prop_name = None
        for prop_name, prop_type in schema.items():
            if prop_type == "title":
                title_prop_name = prop_name
                break

        rows = []
        for page in results:
            props = page.get("properties", {})
            def _text(key):
                val = props.get(key, {})
                t = val.get("type", "")
                if t == "title":        return "".join(x["plain_text"] for x in val.get("title", []))
                if t == "rich_text":    return "".join(x["plain_text"] for x in val.get("rich_text", []))
                if t == "url":          return val.get("url", "") or ""
                if t == "select":       return (val.get("select") or {}).get("name", "")
                if t == "status":       return (val.get("status") or {}).get("name", "")
                if t == "number":       return val.get("number", 0)
                if t == "multi_select": return [s["name"] for s in val.get("multi_select", [])]
                return ""
            rows.append({
                "id":             page["id"],
                "company":        _text(title_prop_name) if title_prop_name else "",
                "role":           _text("Role"),
                "url":            _text("Apply URL"),
                "location":       _text("Location"),
                "status":         _text("Status"),
                "priority_score": _text("Priority Score"),
                "matched_skills": _text("Matched Skills"),
                "missing_skills": _text("Missing Skills"),
                "why_fits":       _text("Why This Fits"),
                "blocker":        _text("Blocker Reason"),
            })
        return rows
    except Exception as e:
        log.error(f"Error querying internships: {e}")
        return []


def create_internship(data: dict) -> str | None:
    """
    Creates a new row in the Internship DB. Adapts to the actual database schema.

    Args:
        data: Dictionary with internship details. Required fields:
            - company (str): Company name
            - role (str): Job role/title
            - url (str): Application URL
            - location (str): Job location

        Optional fields:
            - priority_score (int): Ranking score
            - matched_skills (list): Matching skills
            - missing_skills (list): Missing skills
            - why_fits (str): Why this role fits
            - blocker (str): Any blockers

    Returns:
        Page ID if successful, None if validation fails or error occurs
    """
    # ─── VALIDATION PHASE ───────────────────────────────────────────────────
    # Check for required fields that make a meaningful row
    required_fields = ["company", "role"]
    missing_fields = [f for f in required_fields if not data.get(f, "").strip()]

    if missing_fields:
        log.error(
            f"❌ create_internship: Cannot create row - missing required fields: {missing_fields}\n"
            f"   Data provided: {data}\n"
            f"   Required: company, role"
        )
        return None

    # Warn if optional ranking fields are missing
    optional_fields = ["matched_skills", "missing_skills", "why_fits", "blocker"]
    empty_optional = [f for f in optional_fields if not data.get(f)]
    if empty_optional:
        log.warning(
            f"⚠️  create_internship: Missing optional ranking fields: {empty_optional}\n"
            f"   Row will be created but ranking data will be empty"
        )

    # ─── CREATION PHASE ─────────────────────────────────────────────────────
    db_id = get_db_id()
    if not db_id:
        log.error("create_internship: Database ID not found. Run init_notion() first.")
        return None
    
    try:
        log.info(f"create_internship: Creating row for {data.get('company')} in DB {db_id}")
        notion = get_notion()
        schema = _get_db_schema(retries=3)  # {prop_name: prop_type}
        
        # Self-healing: if schema is empty, try to migrate/refresh it
        if not schema:
            log.warning("create_internship: DB schema is empty. Attempting migration/refresh...")
            migrate_internship_database()
            schema = _get_db_schema(retries=3)
            if not schema:
                log.error("create_internship: DB schema is still empty after migration and retries. Cannot proceed.")
                return None
        
        log.info(f"  Target database columns: {list(schema.keys())}")

        def _safe_skills(skills: list) -> list:
            """Splits comma-containing skill strings and strips commas for Notion multi_select."""
            result = []
            for s in skills[:10]:
                # If the skill itself contains commas, split into multiple tags
                parts = [p.strip() for p in str(s).replace(",", " /").split(" / ") if p.strip()]
                result.extend(parts)
            # Deduplicate, cap at 5, max 100 chars each
            seen = set()
            final = []
            for p in result:
                clean = p[:100]
                if clean not in seen:
                    seen.add(clean)
                    final.append({"name": clean})
                if len(final) >= 5:
                    break
            return final

        matched = _safe_skills(data.get("matched_skills", []))
        missing = _safe_skills(data.get("missing_skills", []))

        # Find the title property by type (may be called "Company", "Name", etc.)
        title_prop_name = None
        for prop_name, prop_type in schema.items():
            if prop_type == "title":
                title_prop_name = prop_name
                break

        if not title_prop_name:
            log.error("create_internship: No title property found in schema!")
            return None

        # Build a full candidate properties dict
        candidates = {
            title_prop_name:  {"title": _rich_text(data.get("company", "Unknown"))},
            "Role":           {"rich_text": _rich_text(data.get("role", ""))},
            "Apply URL":      {"url": data.get("url", "") or None},
            "Location":       {"rich_text": _rich_text(data.get("location", "Remote"))},
            "Priority Score": {"number": data.get("priority_score", 0)},
            "Matched Skills": {"multi_select": matched},
            "Missing Skills": {"multi_select": missing},
            "Why This Fits":  {"rich_text": _rich_text(data.get("why_fits", ""))},
            "Blocker Reason": {"rich_text": _rich_text(data.get("blocker", ""))},
            "Apply Timestamp": {"date": {"start": datetime.now(timezone.utc).isoformat()}},
        }

        # Handle Status separately — detect type and pick first valid option
        if "Status" in schema:
            status_opts = _get_status_options()
            first_opt = status_opts[0] if status_opts else "New"
            if schema["Status"] == "select":
                candidates["Status"] = {"select": {"name": first_opt}}
            elif schema["Status"] == "status":
                candidates["Status"] = {"status": {"name": first_opt}}

        # Only include properties that actually exist in the DB
        properties = {k: v for k, v in candidates.items() if k in schema}
        log.info(f"  Properties to save: {list(properties.keys())}")

        log.info(f"  Creating page in Notion...")
        page = notion.pages.create(
            parent={"database_id": db_id},
            properties=properties
        )
        page_id = page["id"]

        # Log what was actually saved for debugging
        saved_data = {
            "company": data.get("company"),
            "role": data.get("role"),
            "location": data.get("location", "Remote"),
            "priority_score": data.get("priority_score", 0),
            "has_matched_skills": len(data.get("matched_skills", [])) > 0,
            "has_missing_skills": len(data.get("missing_skills", [])) > 0,
            "has_why_fits": bool(data.get("why_fits", "").strip()),
            "has_blocker": bool(data.get("blocker", "").strip()),
        }
        log.success(f"  ✓ Created page: {page_id}")
        log.info(f"  Saved data: {saved_data}")
        return page_id

    except Exception as e:
        log.error(f"❌ Error creating internship row: {type(e).__name__}: {e}")
        log.error(f"   Attempted to save: {data}")
        import traceback
        log.error(f"   Traceback: {traceback.format_exc()}")
        return None


def update_status(page_id: str, status: str) -> bool:
    """Updates the Status field, handling both select and status property types."""
    try:
        notion = get_notion()
        schema = _get_db_schema()
        status_type = schema.get("Status", "select")
        if status_type == "status":
            prop_val = {"status": {"name": status}}
        else:
            prop_val = {"select": {"name": status}}
        notion.pages.update(page_id=page_id, properties={"Status": prop_val})
        return True
    except Exception as e:
        log.error(f"Error updating status: {e}")
        return False


def update_apply_timestamp(page_id: str) -> None:
    """Stamps the Apply Timestamp with the current datetime."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        notion = get_notion()
        notion.pages.update(
            page_id=page_id,
            properties={"Apply Timestamp": {"date": {"start": now}}}
        )
    except Exception:
        pass
