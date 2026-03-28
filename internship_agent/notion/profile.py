"""
User profile retrieval and parsing from Notion.
"""

import re
from internship_agent.notion.client import get_notion, resolve_id
from internship_agent.log.logger import log
from config import PROFILE_PAGES

# All text-bearing Notion block types that can contain resume/profile data
TEXT_BLOCK_TYPES = {
    "paragraph", "heading_1", "heading_2", "heading_3",
    "bulleted_list_item", "numbered_list_item",
    "callout", "quote", "to_do", "toggle",
}


def get_user_profile() -> dict:
    """
    Reads all profile pages from Notion and returns structured profile dict.
    Profile pages: About Me, Skills, Projects, Resume, Preferences
    Returns: {page_name: page_content_text, ...}
    """
    notion = get_notion()
    profile = {}

    # First, find the root "AI Internship Agent" page
    try:
        root_results = notion.search(query="AI Internship Agent", page_size=10).get("results", [])
        root_id = None
        for page in root_results:
            if page["object"] == "page":
                props = page.get("properties", {})
                for prop_data in props.values():
                    if prop_data.get("type") == "title" and prop_data.get("title"):
                        title = prop_data["title"][0]["plain_text"]
                        if title == "AI Internship Agent":
                            root_id = page["id"]
                            break

        if not root_id:
            # If not found, try to use resolve_id as fallback
            root_id = resolve_id("AI Internship Agent")
    except Exception as e:
        root_id = None

    # Get all children of root page
    child_pages = {}
    if root_id:
        try:
            children = notion.blocks.children.list(block_id=root_id).get("results", [])
            for child in children:
                if child["type"] == "child_page":
                    child_title = child.get("child_page", {}).get("title", "")
                    child_id = child["id"]
                    child_pages[child_title] = child_id
        except Exception as e:
            pass

    # Now read content from each profile page
    for page_name in PROFILE_PAGES:
        try:
            # Try to get from child_pages first, then fall back to resolve_id
            if page_name in child_pages:
                page_id = child_pages[page_name]
                log.info(f"Found {page_name} in child pages")
            else:
                page_id = resolve_id(page_name)
                log.info(f"Resolved {page_name} via search")

            blocks = notion.blocks.children.list(block_id=page_id).get("results", [])
            log.info(f"DEBUG: {page_name} has {len(blocks)} blocks")

            # Extract text content from blocks (supports all text-bearing block types)
            content_lines = []
            block_types_found = set()
            for block in blocks:
                btype = block.get("type")
                block_types_found.add(btype)
                if btype in TEXT_BLOCK_TYPES:
                    rich_text = block.get(btype, {}).get("rich_text", [])
                    if rich_text:
                        text = "".join([rt.get("text", {}).get("content", "") for rt in rich_text])
                        if text.strip():  # Only add non-empty lines
                            content_lines.append(text)

            log.info(f"DEBUG: {page_name} block types: {block_types_found}, extracted {len(content_lines)} text blocks")
            profile[page_name] = "\n".join(content_lines) if content_lines else ""
            if profile[page_name]:
                log.info(f"DEBUG: {page_name} content length: {len(profile[page_name])}")
        except Exception as e:
            log.error(f"Error reading {page_name}: {e}")
            profile[page_name] = ""

    return profile


# ─── Block Builders for Notion Pages ───────────────────────────────────────

def _heading_block(text: str, level: int = 2) -> dict:
    """Creates a Notion heading block (heading_1, heading_2, or heading_3)."""
    if not text:
        return {}
    htype = f"heading_{level}"
    return {
        "object": "block",
        "type": htype,
        htype: {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]}
    }


def _paragraph_block(text: str) -> dict:
    """Creates a Notion paragraph block."""
    if not text:
        return {}
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]}
    }


def _bullet_block(text: str) -> dict:
    """Creates a Notion bullet list item block."""
    if not text:
        return {}
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]}
    }


def _clear_page_blocks(page_id: str) -> None:
    """Deletes all blocks on a page."""
    notion = get_notion()
    try:
        results = notion.blocks.children.list(block_id=page_id).get("results", [])
        for block in results:
            try:
                notion.blocks.delete(block_id=block["id"])
            except Exception as e:
                log.warning(f"Could not delete block {block['id']}: {e}")
    except Exception as e:
        log.error(f"Could not list blocks for page {page_id}: {e}")


def _append_blocks_batched(page_id: str, blocks: list) -> None:
    """Appends blocks to a page in batches of 100 (Notion API limit)."""
    notion = get_notion()
    batch_size = 100
    for i in range(0, len(blocks), batch_size):
        batch = [b for b in blocks[i:i + batch_size] if b]  # Filter out empty dicts
        if batch:
            notion.blocks.children.append(block_id=page_id, children=batch)


def write_profile_pages(structured_data: dict) -> bool:
    """
    Clears and rewrites all 5 AI profile pages with structured content.

    Args:
        structured_data: Dict with keys: name, about_me, skills, education, experience, projects, certifications, preferences, career_goal

    Returns:
        True if all 5 pages written successfully, False if any failed
    """
    log.info("Writing profile pages to Notion...")
    notion = get_notion()

    # Step 1: Discover root page and collect child page IDs
    try:
        root_results = notion.search(query="AI Internship Agent", page_size=10).get("results", [])
        root_id = None
        for page in root_results:
            if page["object"] == "page":
                props = page.get("properties", {})
                for prop_data in props.values():
                    if prop_data.get("type") == "title" and prop_data.get("title"):
                        title = prop_data["title"][0]["plain_text"]
                        if title == "AI Internship Agent":
                            root_id = page["id"]
                            break

        if not root_id:
            root_id = resolve_id("AI Internship Agent")
    except Exception as e:
        log.error(f"write_profile_pages: Could not find root page: {e}")
        return False

    # Get all child page IDs
    child_pages = {}
    try:
        children = notion.blocks.children.list(block_id=root_id).get("results", [])
        for child in children:
            if child["type"] == "child_page":
                child_title = child.get("child_page", {}).get("title", "")
                child_id = child["id"]
                child_pages[child_title] = child_id
    except Exception as e:
        log.error(f"write_profile_pages: Could not list child pages: {e}")

    # Step 2: Build page content for each profile page
    page_content_map = {}

    # About Me page
    blocks = [_heading_block("About Me", level=1)]
    name = structured_data.get("name", "").strip()
    about_me = structured_data.get("about_me", "").strip()
    career_goal = structured_data.get("career_goal", "").strip()

    if name:
        blocks.append(_paragraph_block(f"Name: {name}"))
    if about_me:
        blocks.append(_paragraph_block(about_me))
    if career_goal:
        blocks.append(_heading_block("Career Goal", level=2))
        blocks.append(_paragraph_block(career_goal))
    if not (name or about_me):
        blocks.append(_paragraph_block("Tell the AI about yourself here — your name, background, and career goals."))

    page_content_map["About Me"] = [b for b in blocks if b]

    # Skills page
    blocks = [_heading_block("Skills", level=1)]
    skills = structured_data.get("skills", [])
    if isinstance(skills, str):
        skills = [skills]
    skills = [s for s in skills if s]

    if skills:
        blocks.append(_heading_block("Technical & Soft Skills", level=2))
        for skill in skills[:50]:
            blocks.append(_bullet_block(str(skill)))
    else:
        blocks.append(_paragraph_block("List your technical and soft skills here, one per line."))

    page_content_map["Skills"] = [b for b in blocks if b]

    # Projects page
    blocks = [_heading_block("Projects", level=1)]
    projects = structured_data.get("projects", [])
    if projects:
        for project in projects:
            if isinstance(project, dict):
                name = project.get("name", "").strip()
                desc = project.get("description", "").strip()
                tech = project.get("tech", "").strip()
            else:
                name = str(project).strip()
                desc = ""
                tech = ""

            if name:
                blocks.append(_heading_block(name, level=3))
            if desc:
                blocks.append(_paragraph_block(desc))
            if tech:
                blocks.append(_paragraph_block(f"Tech: {tech}"))
    else:
        blocks.append(_paragraph_block("Describe your past projects, links, and what you built."))

    page_content_map["Projects"] = [b for b in blocks if b]

    # Resume page
    blocks = [_heading_block("Resume", level=1)]

    education = structured_data.get("education", [])
    if education:
        blocks.append(_heading_block("Education", level=2))
        for edu in education:
            if isinstance(edu, dict):
                degree = edu.get("degree", "").strip()
                institution = edu.get("institution", "").strip()
                year = edu.get("year", "").strip()
                line = f"{degree} — {institution} ({year})"
            else:
                line = str(edu).strip()
            if line.strip(" —()"):
                blocks.append(_bullet_block(line.strip(" —()")))

    experience = structured_data.get("experience", [])
    if experience:
        blocks.append(_heading_block("Experience", level=2))
        for exp in experience:
            if isinstance(exp, dict):
                title = exp.get("title", "").strip()
                company = exp.get("company", "").strip()
                duration = exp.get("duration", "").strip()
                description = exp.get("description", "").strip()
                title_line = f"{title} at {company} — {duration}"
            else:
                title_line = str(exp).strip()
                description = ""
            if title_line.strip(" at—"):
                blocks.append(_bullet_block(title_line.strip(" at—")))
            if description:
                blocks.append(_paragraph_block(description))

    certifications = structured_data.get("certifications", [])
    if certifications:
        blocks.append(_heading_block("Certifications", level=2))
        for cert in certifications:
            if cert:
                blocks.append(_bullet_block(str(cert)))

    if not (education or experience or certifications):
        blocks.append(_paragraph_block("Paste or summarize your resume content here."))

    page_content_map["Resume"] = [b for b in blocks if b]

    # Preferences page
    blocks = [_heading_block("Preferences", level=1)]
    preferences = structured_data.get("preferences", "").strip()
    if preferences:
        blocks.append(_paragraph_block(preferences))
    else:
        blocks.append(_paragraph_block("Specify internship preferences: location, remote/onsite, fields, salary expectations."))

    page_content_map["Preferences"] = [b for b in blocks if b]

    # Step 3: Write to each page
    success_count = 0
    for page_name, page_blocks in page_content_map.items():
        # Find page ID
        page_id = child_pages.get(page_name)
        if not page_id:
            try:
                page_id = resolve_id(page_name)
            except:
                log.warning(f"write_profile_pages: Could not find page ID for '{page_name}'")
                continue

        try:
            _clear_page_blocks(page_id)
            _append_blocks_batched(page_id, page_blocks)
            success_count += 1
            log.success(f"Wrote {len(page_blocks)} blocks to '{page_name}'")
        except Exception as e:
            log.error(f"write_profile_pages: Failed to write '{page_name}': {e}")

    return success_count == 5


def scan_and_sync_profile() -> str:
    """
    Scans the entire Notion workspace for resume/CV/profile pages,
    extracts their text content, and syncs to the AI bot's profile pages.

    Returns:
        A human-readable summary string
    """
    log.info("Scanning workspace for resume/profile content...")
    notion = get_notion()

    # Build exclusion set of bot-owned pages
    bot_page_ids = set()
    try:
        root_results = notion.search(query="AI Internship Agent", page_size=10).get("results", [])
        for page in root_results:
            if page["object"] == "page":
                bot_page_ids.add(page["id"])
                # Also get all its children
                try:
                    children = notion.blocks.children.list(block_id=page["id"]).get("results", [])
                    for child in children:
                        if child["type"] == "child_page":
                            bot_page_ids.add(child["id"])
                except:
                    pass
    except Exception as e:
        log.warning(f"Could not build bot page exclusion set: {e}")

    # Search for resume-related pages
    RESUME_SEARCH_KEYWORDS = [
        "resume", "my resume", "cv", "curriculum vitae",
        "profile", "about me", "skills", "background",
        "experience", "education", "work", "career", "project"
    ]

    found_pages = {}  # {page_id: page_title}

    for keyword in RESUME_SEARCH_KEYWORDS:
        try:
            results = notion.search(query=keyword, page_size=15).get("results", [])

            for item in results:
                if item["object"] == "page":
                    page_id = item["id"]

                    if page_id in bot_page_ids or page_id in found_pages:
                        continue

                    # Extract title
                    title = "Untitled"
                    props = item.get("properties", {})
                    for prop_data in props.values():
                        if prop_data.get("type") == "title" and prop_data.get("title"):
                            title = prop_data["title"][0]["plain_text"]
                            break

                    found_pages[page_id] = title
                    log.info(f"Found candidate page: {title}")
        except Exception as e:
            log.warning(f"Search error for '{keyword}': {e}")

    log.info(f"Found {len(found_pages)} candidate pages")

    # Extract text from candidate pages
    page_texts = {}
    for page_id, page_title in found_pages.items():
        try:
            blocks = notion.blocks.children.list(block_id=page_id).get("results", [])

            content_lines = []
            for block in blocks:
                btype = block.get("type")
                if btype in TEXT_BLOCK_TYPES:
                    rich_text = block.get(btype, {}).get("rich_text", [])
                    if rich_text:
                        text = "".join([rt.get("text", {}).get("content", "") for rt in rich_text])
                        if text.strip():
                            content_lines.append(text)

            if content_lines:
                page_text = "\n".join(content_lines)
                if len(page_text) > 30:
                    page_texts[page_title] = page_text
                    log.info(f"Extracted {len(page_text)} chars from '{page_title}'")
        except Exception as e:
            log.warning(f"Could not extract from {page_title}: {e}")

    if not page_texts:
        return "No resume/profile content found in your Notion workspace. Please create a page with your resume, CV, or profile information."

    # Combine all text
    combined_raw = "\n\n---\n\n".join(
        f"[Source: {title}]\n{text}"
        for title, text in sorted(page_texts.items())
    )

    log.info(f"Combined {len(combined_raw)} chars from {len(page_texts)} pages")

    # Call LLM extractor with local import to avoid circular dependency
    from internship_agent.llm.resume import extract_and_write_profile

    return extract_and_write_profile(combined_raw)


def _parse_profile_fields(profile: dict) -> dict:
    """
    Parses structured fields from freeform Notion profile text.
    Extracts: name, email, phone, linkedin, github, portfolio, college, grad_year
    Returns a dict ready for form-filling.
    """

    def extract_field(text: str, pattern: str, default: str = "") -> str:
        """Extracts first regex match from text."""
        m = re.search(pattern, text or "", re.IGNORECASE)
        return m.group().strip() if m else default

    preferences = profile.get("Preferences", "")
    about_me = profile.get("About Me", "")
    resume = profile.get("Resume", "")

    return {
        "name": (
            next(
                (
                    line.removeprefix("Name:").strip()
                    for line in about_me.split("\n")
                    if line.strip() and line.strip().lower() not in ("about me",)
                ),
                "Applicant"
            )
        )[:60],
        "email": extract_field(
            preferences + "\n" + about_me,
            r'[\w.+-]+@[\w-]+\.\w+'
        ),
        "phone": extract_field(
            preferences + "\n" + resume,
            r'(\+?\d[\d\s\-().]{7,}\d)'
        ),
        "linkedin": extract_field(
            preferences + "\n" + about_me,
            r'https?://(?:www\.)?linkedin\.com/in/[\w\-]+/?'
        ),
        "github": extract_field(
            preferences + "\n" + about_me,
            r'https?://(?:www\.)?github\.com/[\w\-]+/?'
        ),
        "portfolio": extract_field(
            preferences + "\n" + about_me,
            r'https?://[\w\-.]+\.\w{2,}(?:/[\w\-./?=&]*)?'
        ),
        "college": extract_field(
            resume + "\n" + about_me,
            r'(?:B\.?Tech|B\.?E|B\.?Sc|M\.?Tech|BCA|MCA|pursuing)[^\n,;]{0,80}',
            default=""
        ),
        "grad_year": extract_field(
            resume,
            r'\b(20[2-3]\d)\b'
        ),
    }
