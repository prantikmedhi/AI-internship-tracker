"""
LLM-powered text extraction — search keywords and cover letters.
"""

import re
from internship_agent.llm.client import call_llm, extract_json_from_response
from internship_agent.log.logger import log
from config import OLLAMA_TIMEOUT_SLOW, OLLAMA_TIMEOUT_FAST


KEYWORD_PROMPT = """You are an internship search assistant. Read the user's profile and their search hint, then extract:
1. The best internship search keyword (role/skills focused, 2-5 words)
2. The location the user wants (city, country, or "Remote")

Return ONLY a JSON object — no markdown, no explanation:
{{
  "keyword": "<2-5 word role/skill query, NO location words>",
  "location": "<city or country name, or 'Remote' if unspecified>",
  "reason": "<one sentence why this keyword fits the profile>"
}}

Examples:
- User hint "find python intern india" → {{"keyword": "python developer intern", "location": "India", "reason": "..."}}
- User hint "find machine learning" → {{"keyword": "machine learning intern", "location": "Remote", "reason": "..."}}
- User hint "find frontend london" → {{"keyword": "frontend developer intern", "location": "London", "reason": "..."}}

User Profile:
{profile}

User's search hint: "{hint}"
If hint has no location, use the Preferences page location or default to "Remote".
"""


COVER_LETTER_PROMPT = """You are an expert career coach. Write a professional, personalized internship cover letter for the user below.

Use specific details from their Skills, Projects, and Resume to demonstrate genuine fit. Address the company and role directly. Keep it under 300 words. Return ONLY the cover letter text — no subject line, no "Dear Hiring Manager" boilerplate, no JSON.

User Profile:
Skills: {skills}
Projects: {projects}
Resume Summary: {resume}

Target Role: {role} at {company}
Job Description: {description}
"""


def extract_search_keywords(profile: dict, hint: str = "") -> tuple[str, str, str]:
    """
    Uses Ollama to read profile + hint and return (keyword, location, reason).
    Falls back gracefully if Ollama is unavailable.

    Args:
        profile: User profile dict
        hint: User's search query (e.g., "find python interns india")

    Returns:
        Tuple of (keyword, location, reason)
    """
    # Try to parse location from hint directly (fast path, no Ollama needed)
    KNOWN_LOCATIONS = [
        "india", "usa", "uk", "canada", "germany", "australia", "singapore",
        "london", "new york", "bangalore", "mumbai", "delhi", "hyderabad",
        "remote", "turkey", "dubai", "france", "japan", "china", "malaysia",
    ]
    hint_lower = hint.lower()
    quick_location = ""
    for loc in KNOWN_LOCATIONS:
        if loc in hint_lower:
            quick_location = loc.title()
            break

    profile_text = "\n".join(
        f"[{key}]\n{val}" for key, val in profile.items() if val and val.strip()
    ) or ""

    if not profile_text and not hint:
        return "software engineering intern", quick_location or "Remote", "No profile data — using generic keyword."

    prompt = KEYWORD_PROMPT.format(profile=profile_text[:3000], hint=hint)
    content = call_llm(prompt, timeout=OLLAMA_TIMEOUT_FAST)
    result = extract_json_from_response(content)

    if result:
        kw = result.get("keyword", "").strip()
        loc = result.get("location", "").strip() or quick_location or "Remote"
        reason = result.get("reason", "")
        if kw:
            return kw, loc, reason

    # Fallback: strip known location words from hint for keyword
    keyword = hint
    for loc in KNOWN_LOCATIONS:
        keyword = re.sub(rf'\b{loc}\b', '', keyword, flags=re.IGNORECASE).strip()
    keyword = keyword.strip() or "software engineering intern"
    return keyword, quick_location or "Remote", "Fallback — using user input."


def generate_cover_letter(profile: dict, job: dict) -> str:
    """
    Calls Ollama to produce a personalized cover letter for the given job.
    Falls back to a generic cover letter if Ollama is unavailable.

    Args:
        profile: User profile dict (with Skills, Projects, Resume)
        job: Job listing dict (with role, company, description)

    Returns:
        Generated cover letter text (max 2000 chars)
    """
    prompt = COVER_LETTER_PROMPT.format(
        skills=profile.get("Skills", "")[:1000],
        projects=profile.get("Projects", "")[:1000],
        resume=profile.get("Resume", "")[:1000],
        role=job.get("role", "Internship"),
        company=job.get("company", "the company"),
        description=job.get("description", "")[:800],
    )

    content = call_llm(prompt, timeout=OLLAMA_TIMEOUT_SLOW)
    if content:
        return content[:2000]

    # Generic fallback
    return (
        f"I am writing to express my interest in the {job.get('role', 'internship')} "
        f"position at {job.get('company', 'your company')}. "
        f"{profile.get('About Me', '')[:300]}"
    )
