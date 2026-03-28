"""
Job search and normalization module — scrapers and filtering.
"""

import asyncio
from internship_agent.jobs.search import _scrape_internshala, _scrape_linkedin, _search_remoteok
from internship_agent.jobs.normalize import dedup_by_url, filter_live_listings, normalize_listings
from internship_agent.log.logger import log


async def search_internships(keyword: str, location: str = "", limit: int = 30) -> list:
    """
    Searches for internships from all sources in parallel: Internshala, LinkedIn, RemoteOK.
    Returns deduplicated and verified-live results.

    Args:
        keyword: Search keyword (e.g., "python developer")
        location: Optional location (e.g., "bangalore")
        limit: Max results to return (fetches ~limit/2 from each source)

    Returns:
        List of normalized job dicts, sorted by source order
    """
    loc_display = location if location else "Anywhere"
    log.info(f"Searching: '{keyword}' | Location: {loc_display}")

    per_source = max(limit // 2, 15)  # fetch ~15 from each Playwright source

    async def _run_playwright():
        r1, r2 = await asyncio.gather(
            _scrape_internshala(keyword, location=location, limit=per_source),
            _scrape_linkedin(keyword, location=location, limit=per_source),
            return_exceptions=True
        )
        out = []
        if isinstance(r1, list):
            log.success(f"Internshala: {len(r1)} found")
            out += r1
        else:
            log.error(f"Internshala failed: {r1}")
        if isinstance(r2, list):
            log.success(f"LinkedIn: {len(r2)} found")
            out += r2
        else:
            log.error(f"LinkedIn failed: {r2}")
        return out

    try:
        results = await _run_playwright()
    except Exception as e:
        log.error(f"Playwright error: {e}")
        results = []

    # Always add RemoteOK
    remoteok = _search_remoteok(keyword, limit=per_source)
    log.success(f"RemoteOK: {len(remoteok)} found")
    results += remoteok

    # Normalize: dedup + verify live
    live = normalize_listings(results)
    return live


__all__ = [
    "search_internships",
    "_scrape_internshala",
    "_scrape_linkedin",
    "_search_remoteok",
    "dedup_by_url",
    "filter_live_listings",
    "normalize_listings",
]
