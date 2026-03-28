"""
Resume analysis using Ollama — extracts structured data from profile.
"""

from internship_agent.llm.client import call_llm, extract_json_from_response
from internship_agent.log.logger import log
from internship_agent.notion.client import get_notion
from config import OLLAMA_TIMEOUT_SLOW

# All text-bearing Notion block types that can contain resume data
TEXT_BLOCK_TYPES = {
    "paragraph", "heading_1", "heading_2", "heading_3",
    "bulleted_list_item", "numbered_list_item",
    "callout", "quote", "to_do", "toggle",
}


def _search_resume_content() -> str:
    """
    Searches entire Notion workspace for resume-related content.
    Looks for pages with 'resume', 'cv', 'experience', 'skills', or 'about' in title or content.
    Returns combined text from all matching pages.
    """
    try:
        notion = get_notion()
        resume_content = []
        found_pages = set()

        # Search for pages with resume-related keywords
        keywords = ["resume", "cv", "experience", "skills", "about", "background", "career", "education", "work", "project"]

        for keyword in keywords:
            try:
                results = notion.search(query=keyword, page_size=15).get("results", [])
                log.info(f"DEBUG: Search '{keyword}' returned {len(results)} results")

                for item in results:
                    if item["object"] == "page":
                        page_id = item["id"]

                        # Skip duplicates
                        if page_id in found_pages:
                            continue
                        found_pages.add(page_id)

                        # Extract page title
                        title = "Untitled"
                        props = item.get("properties", {})
                        for prop_data in props.values():
                            if prop_data.get("type") == "title" and prop_data.get("title"):
                                title = prop_data["title"][0]["plain_text"]
                                break

                        log.info(f"DEBUG: Processing page: {title}")

                        # Extract page content (supports all text-bearing block types)
                        try:
                            blocks = notion.blocks.children.list(block_id=page_id).get("results", [])
                            log.info(f"DEBUG:   Page has {len(blocks)} blocks")

                            block_count = 0
                            for block in blocks:
                                btype = block.get("type")
                                if btype in TEXT_BLOCK_TYPES:
                                    rich_text = block.get(btype, {}).get("rich_text", [])
                                    if rich_text:
                                        text = "".join([rt.get("text", {}).get("content", "") for rt in rich_text])
                                        if text.strip() and "Paste or summarize" not in text:
                                            resume_content.append(text)
                                            block_count += 1

                            if block_count > 0:
                                log.info(f"DEBUG:   Extracted {block_count} text blocks from {title}")
                        except Exception as e:
                            log.info(f"DEBUG:   Error reading {title}: {e}")
            except Exception as e:
                log.info(f"DEBUG: Search error for '{keyword}': {e}")

        result = "\n\n".join(resume_content)
        log.info(f"DEBUG: Workspace search total: {len(found_pages)} pages processed, {len(result)} chars extracted")
        return result
    except Exception as e:
        log.error(f"Error searching for resume content: {e}")
        return ""


RESUME_ANALYSIS_PROMPT = """You are a resume parser. Read the resume/profile content below and extract structured data.

Return ONLY a valid JSON object (no markdown, no explanation):
{{
  "technical_skills": [<list of technical skills, languages, frameworks>],
  "tools": [<list of tools, platforms, software>],
  "education": "<degree, institution, graduation year>",
  "experience_level": "<fresher / 0-1 years / 1-2 years>",
  "projects": [<list of project names or brief descriptions>],
  "certifications": [<list of certifications or courses>],
  "career_goal": "<what kind of role they are targeting>"
}}

Profile Content:
{profile_text}
"""


def analyze_resume(profile: dict = None) -> str:
    """
    Analyzes resume/profile content from Notion and uses Ollama
    to extract structured resume data. Returns a formatted string for use
    in ranking and keyword prompts. Returns empty string if insufficient content.

    Args:
        profile: Optional dict with keys like "Resume", "About Me", etc.

    Returns:
        Formatted string with extracted resume data, or empty string if failed
    """
    # Try to get resume content from multiple sources
    resume_text = ""
    about_me = ""

    if profile:
        resume_text = profile.get("Resume", "").strip() or ""
        about_me = profile.get("About Me", "").strip() or ""
        log.info(f"DEBUG: Profile keys: {list(profile.keys())}")
        log.info(f"DEBUG: Resume text length: {len(resume_text)}, About Me length: {len(about_me)}")

    combined = (resume_text + "\n\n" + about_me).strip()
    log.info(f"DEBUG: Combined text length: {len(combined)}")

    # Check if content is mostly/only placeholder text
    placeholder_phrases = [
        "Paste or summarize your resume",
        "Tell the AI about yourself here",
        "List your technical and soft skills",
        "Describe your past projects",
        "Specify internship preferences"
    ]
    is_mostly_placeholder = any(phrase in combined for phrase in placeholder_phrases)

    # If limited content OR only placeholder text, search entire Notion workspace
    if len(combined) < 50 or is_mostly_placeholder:
        log.info("Searching Notion workspace for resume content...")
        workspace_content = _search_resume_content()
        log.info(f"DEBUG: Workspace search returned {len(workspace_content)} chars")
        if workspace_content:
            combined = workspace_content
            log.info(f"DEBUG: Using workspace content, new combined length: {len(combined)}")
        else:
            log.warning("No resume content found in workspace. Please fill in your Notion pages with actual content.")

    # Skip only if completely empty or just default placeholder
    # Remove placeholder text before checking length
    filtered = combined.replace("Paste or summarize your resume content here.", "").replace("Tell the AI about yourself here — your name, background, and career goals.", "").strip()

    log.info(f"DEBUG: Filtered text length: {len(filtered)}, combined before filter: {len(combined)}")
    if len(combined) > 0:
        log.info(f"DEBUG: Sample of combined text: {combined[:200]}...")

    if len(filtered) < 20:
        log.warning(f"Resume too short ({len(filtered)} chars after filtering). Skipping analysis.")
        return ""

    log.info(f"Analyzing resume ({len(filtered)} chars)...")
    prompt = RESUME_ANALYSIS_PROMPT.format(profile_text=filtered[:4000])
    content = call_llm(prompt, timeout=OLLAMA_TIMEOUT_SLOW)
    result = extract_json_from_response(content)

    if not result:
        log.warning("Failed to extract JSON from Ollama response")

    if result:
        # Format as readable text
        formatted = "[Extracted Resume Data]\n"
        if result.get("technical_skills"):
            formatted += f"Skills: {', '.join(result['technical_skills'])}\n"
        if result.get("tools"):
            formatted += f"Tools: {', '.join(result['tools'])}\n"
        if result.get("education"):
            formatted += f"Education: {result['education']}\n"
        if result.get("experience_level"):
            formatted += f"Experience: {result['experience_level']}\n"
        if result.get("projects"):
            formatted += f"Projects: {', '.join(result['projects'][:3])}\n"
        if result.get("certifications"):
            formatted += f"Certifications: {', '.join(result['certifications'][:2])}\n"
        if result.get("career_goal"):
            formatted += f"Goal: {result['career_goal']}\n"
        return formatted.strip()

    return ""


# ─── Profile Extraction for Workspace Sync ────────────────────────────────

PROFILE_EXTRACTION_PROMPT = """You are a resume/profile parser. Extract structured profile information from the text below.

Return ONLY a valid JSON object (no markdown, no explanation):
{{
  "name": "<full name, or empty string if not found>",
  "about_me": "<2-4 sentence professional summary: who they are, background, career goal>",
  "skills": ["<skill 1>", "<skill 2>", "<etc — include both technical and soft skills>"],
  "education": [
    {{
      "degree": "<degree name>",
      "institution": "<college/university name>",
      "year": "<graduation year or expected year>"
    }}
  ],
  "experience": [
    {{
      "title": "<job/intern title>",
      "company": "<company name>",
      "duration": "<dates or duration>",
      "description": "<one sentence summary>"
    }}
  ],
  "projects": [
    {{
      "name": "<project name>",
      "description": "<one sentence description>",
      "tech": "<comma-separated technologies used>"
    }}
  ],
  "certifications": ["<cert 1>", "<cert 2>"],
  "preferences": "<preferred internship locations, remote/onsite, domains, salary expectations>",
  "career_goal": "<one sentence: what kind of role or industry they are targeting>"
}}

If a field has no data, use an empty string or empty list.

Resume/Profile Content:
{raw_text}
"""


def extract_and_write_profile(raw_text: str) -> str:
    """
    Uses LLM to extract structured profile fields from raw resume text,
    then writes the structured data back to the 5 Notion profile pages.

    Args:
        raw_text: Combined raw text from all scanned resume pages

    Returns:
        Summary string describing what was written, or error message
    """
    log.info("Extracting profile data with LLM...")

    # Truncate to 5000 chars for Ollama
    raw_text = raw_text[:5000]

    prompt = PROFILE_EXTRACTION_PROMPT.format(raw_text=raw_text)
    log.info(f"Sending {len(prompt)} char prompt to Ollama...")

    content = call_llm(prompt, timeout=OLLAMA_TIMEOUT_SLOW * 2)
    structured_data = extract_json_from_response(content)

    if not structured_data:
        log.error("Failed to parse profile JSON from LLM")
        return "Could not parse profile data from your resume. The LLM response was invalid. Please try again."

    # Validate minimum content
    has_content = any([
        structured_data.get("about_me", "").strip(),
        len(structured_data.get("skills", [])) > 0,
        len(structured_data.get("education", [])) > 0,
        len(structured_data.get("experience", [])) > 0,
    ])

    if not has_content:
        return "No structured profile data was extracted. Please ensure your resume/profile pages have sufficient content."

    log.info("Writing extracted profile to Notion pages...")

    # Import locally to avoid circular dependency
    from internship_agent.notion.profile import write_profile_pages

    success = write_profile_pages(structured_data)

    if not success:
        return "Profile data extracted but failed to write to Notion. Check permissions."

    # Build summary
    name_part = f" for {structured_data.get('name', '')}" if structured_data.get('name', '').strip() else ""
    skills_count = len(structured_data.get('skills', []))
    projects_count = len(structured_data.get('projects', []))

    summary = (
        f"✅ Profile synced{name_part}!\n"
        f"  • {skills_count} skills extracted\n"
        f"  • {projects_count} projects extracted\n"
        f"  • Education, experience, preferences updated\n"
        f"  • All 5 profile pages rewritten in Notion"
    )

    log.success(summary)
    return summary
