"""
Internship ranking engine — evaluates job fit against user profile.
"""

from internship_agent.llm.client import call_llm, extract_json_from_response
from internship_agent.log.logger import log
from config import OLLAMA_TIMEOUT_SLOW


RANKING_PROMPT = """You are a strict internship-to-resume matching AI. Score HONESTLY using the rubric below.

**Scoring Rubric** (be strict — most listings should score 50-75, great ones 80-95, perfect ones 96-100):
- 90-100: EXCEPTIONAL — Role title matches exactly, 80%+ skills match, company is well-known, location fits
- 75-89: GOOD — Role is relevant, 50-70% skills match, some stretch required
- 55-74: AVERAGE — Role partially overlaps, but 30-50% skills missing or location is wrong
- 35-54: POOR — Role differs significantly, less than 30% skill overlap
- 1-34: SKIP — Completely irrelevant or requires skills the user doesn't have at all

DO NOT give every listing the same score. Spread them out. Use the full range.

Return ONLY a valid compact JSON object (no markdown, no explanation):
{{
  "priority_score": <integer 1-100, follow rubric strictly>,
  "matched_skills": [<max 5 actual matching skills>],
  "missing_skills": [<max 5 skills required but user lacks>],
  "why_fits": "<one specific sentence about the match, mention actual skills>",
  "blocker": "<one specific sentence about the biggest gap>"
}}

User Resume / Profile:
{profile}

Internship to evaluate:
Company: {company}
Role: {role}
Location: {location}
Description: {description}
"""


def rank_internship(profile: dict, internship: dict) -> dict:
    """
    Uses Ollama to rank one internship against the user profile.
    Returns a dict with ranking metadata.

    Args:
        profile: User profile dict (from get_user_profile())
        internship: Job listing dict with company, role, location, description

    Returns:
        Dict with keys: priority_score, matched_skills, missing_skills, why_fits, blocker
    """
    profile_text = "\n".join(
        f"[{key}]\n{val}" for key, val in profile.items() if val.strip()
    ) or "No profile data provided."

    prompt = RANKING_PROMPT.format(
        profile=profile_text,
        company=internship.get("company", "Unknown"),
        role=internship.get("role", ""),
        location=internship.get("location", "Remote"),
        description=internship.get("description", "")[:1500],
    )

    content = call_llm(prompt, timeout=OLLAMA_TIMEOUT_SLOW)
    result = extract_json_from_response(content)

    if result:
        return {
            "priority_score": int(result.get("priority_score", 50)),
            "matched_skills": result.get("matched_skills", []),
            "missing_skills": result.get("missing_skills", []),
            "why_fits": result.get("why_fits", ""),
            "blocker": result.get("blocker", ""),
        }

    # Fallback defaults if Ollama fails
    log.error(f"Could not rank {internship.get('company', 'Unknown')} — using fallback")
    return {
        "priority_score": 50,
        "matched_skills": [],
        "missing_skills": [],
        "why_fits": "Could not rank — Ollama unavailable.",
        "blocker": "",
    }


def rank_all(profile: dict, internships: list) -> list:
    """
    Ranks a list of internships and returns them sorted by priority_score desc.

    Args:
        profile: User profile dict
        internships: List of job listing dicts

    Returns:
        List of dicts (merged internships + ranking data), sorted by score descending
    """
    ranked = []
    for i, internship in enumerate(internships, 1):
        ranking = rank_internship(profile, internship)
        merged = {**internship, **ranking}
        ranked.append(merged)
        log.step(i, len(internships), f"Ranked {internship.get('company', 'N/A')} — score {ranking['priority_score']}")

    return sorted(ranked, key=lambda x: x.get("priority_score", 0), reverse=True)
