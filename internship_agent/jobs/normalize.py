"""
Job listing normalization — deduplication and freshness validation.
"""

import requests
from internship_agent.log.logger import log


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
}


def dedup_by_url(jobs: list) -> list:
    """
    Removes duplicate job listings based on URL.

    Args:
        jobs: List of job dicts

    Returns:
        Deduplicated list (preserves first occurrence of each URL)
    """
    seen = set()
    deduped = []
    for job in jobs:
        url = job.get("url", "")
        if url and url in seen:
            continue
        seen.add(url)
        deduped.append(job)
    return deduped


def filter_live_listings(jobs: list) -> list:
    """
    Filters out closed/expired listings by checking HTTP status and page content.

    Args:
        jobs: List of job dicts

    Returns:
        Filtered list containing only live (non-404, non-closed) listings
    """
    closed_keywords = [
        "no longer accepting", "position has been filled", "job has expired",
        "this job is closed", "listing has expired", "internship is closed",
        "application closed", "no longer available", "posting has expired",
    ]

    live = []
    for job in jobs:
        url = job.get("url", "")
        if not url:
            live.append(job)
            continue

        try:
            resp = requests.head(url, headers=HEADERS, timeout=6, allow_redirects=True)
            if resp.status_code == 404:
                log.info(f"Closed (404): {job.get('company')} — {url[:60]}")
                continue

            # For Internshala, do a lightweight GET to check page text
            if "internshala.com" in url:
                r = requests.get(url, headers=HEADERS, timeout=8)
                body = r.text.lower()
                if any(k in body for k in closed_keywords):
                    log.info(f"Closed (text): {job.get('company')}")
                    continue

        except Exception:
            pass  # network error → assume live

        live.append(job)

    return live


def normalize_listings(jobs: list) -> list:
    """
    Runs full normalization pipeline: dedup + filter_live.

    Args:
        jobs: Raw list of job dicts from scrapers

    Returns:
        Normalized, deduplicated, and verified-live list
    """
    deduped = dedup_by_url(jobs)
    log.info(f"Deduped: {len(deduped)} listings")
    live = filter_live_listings(deduped)
    log.success(f"Live: {len(live)} / {len(deduped)} listings verified")
    return live
