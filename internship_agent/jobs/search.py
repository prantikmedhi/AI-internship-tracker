"""
Internship scraping — Internshala, LinkedIn Jobs, RemoteOK.
"""

import re
import asyncio
import requests
from urllib.parse import quote
from playwright.async_api import async_playwright
from internship_agent.log.logger import log


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
}

# LinkedIn geoId map for common locations
LINKEDIN_GEO_IDS = {
    "india":     "102713980",
    "usa":       "103644278",
    "uk":        "101165590",
    "canada":    "101174742",
    "germany":   "101282230",
    "australia": "101452733",
    "singapore": "102454443",
    "turkey":    "102105699",
    "dubai":     "106204383",
    "france":    "105015875",
    "japan":     "101355337",
    "london":    "90009496",
    "bangalore": "105214831",
    "mumbai":    "102714165",
    "delhi":     "102713747",
    "hyderabad": "104093990",
    "new york":  "105080838",
    "malaysia":  "102358726",
}


def _clean(text: str) -> str:
    """Clean HTML and excess whitespace from text."""
    text = re.sub(r'<[^>]+>', ' ', text or '')
    return re.sub(r'\s+', ' ', text).strip()


async def _safe_text(element, selector: str) -> str:
    """Safely extract text from element using selector."""
    try:
        el = await element.query_selector(selector)
        if el:
            return (await el.inner_text()).strip()
    except Exception:
        pass
    return ""


# ─── Internshala ──────────────────────────────────────────────────────────────

async def _scrape_internshala(keyword: str, location: str = "", limit: int = 10) -> list:
    """
    Scrapes Internshala with keyword and optional city-level location in URL.

    Args:
        keyword: Search keyword (e.g., "python developer")
        location: Optional location (e.g., "bangalore")
        limit: Max results to extract

    Returns:
        List of job dicts with company, role, url, location, description, tags
    """
    slug_kw  = keyword.strip().lower().replace(" ", "-")
    if not slug_kw.endswith("-internship"):
        slug_kw += "-internship"
    slug_loc = location.strip().lower().replace(" ", "-") if location and location.lower() != "remote" else ""

    if slug_loc:
        url          = f"https://internshala.com/internships/in/{slug_loc}/{slug_kw}/"
        fallback_url = f"https://internshala.com/internships/{slug_kw}/"
    else:
        url          = f"https://internshala.com/internships/{slug_kw}/"
        fallback_url = None

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=HEADERS["User-Agent"])
        page    = await context.new_page()
        try:
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")

            # Check for login wall before attempting to query cards
            page_body = (await page.inner_text("body")).lower()
            if "login" in page.url or "sign in to continue" in page_body:
                log.warning("Internshala: login wall detected — skipping")
                await browser.close()
                return []

            # Wait for job cards to load with proper selector
            try:
                await page.wait_for_selector(
                    "[data-internship-id], .individual_internship",
                    timeout=12000
                )
            except Exception:
                log.warning("Internshala: card selector timed out — proceeding with query")

            cards = await page.query_selector_all(
                "[data-internship-id], .individual_internship"
            )
            # If location URL gave no results, fall back to generic keyword URL
            if not cards and fallback_url:
                log.info("Internshala: 0 at location URL — retrying without location...")
                await page.goto(fallback_url, timeout=20000, wait_until="domcontentloaded")
                try:
                    await page.wait_for_selector(
                        "[data-internship-id], .individual_internship",
                        timeout=10000
                    )
                except Exception:
                    log.warning("Internshala fallback: card selector timed out — proceeding with query")
                cards = await page.query_selector_all(
                    "[data-internship-id], .individual_internship"
                )

            for card in cards[:limit]:
                try:
                    role    = await _safe_text(card, ".profile a, .profile h3 a, .profile h3, h3 a, h3")
                    company = await _safe_text(card, ".company_and_premium_logo .company_name a, .company_name a, .company_name, h4")
                    loc     = await _safe_text(card, ".location_names .location_link, .other_detail_item_link, .location_link, .other_detail_item span")
                    href_el = await card.query_selector("a.view_detail_button, a[href*='/internship/detail'], a[href*='/internships/']")
                    link    = ""
                    if href_el:
                        link = await href_el.get_attribute("href") or ""
                        if link and not link.startswith("http"):
                            link = "https://internshala.com" + link
                    if not role and not company:
                        continue
                    results.append({
                        "company":     company or "Unknown",
                        "role":        role or keyword + " Intern",
                        "url":         link,
                        "location":    loc or location or "India",
                        "description": f"{role} internship at {company}. Location: {loc}.",
                        "tags":        ["internship", keyword.lower()],
                    })
                except Exception:
                    continue
        except Exception as e:
            log.error(f"Internshala scrape error: {e}")
        finally:
            await browser.close()
    return results


# ─── LinkedIn Jobs ────────────────────────────────────────────────────────────

async def _scrape_linkedin(keyword: str, location: str = "", limit: int = 10) -> list:
    """
    Scrapes LinkedIn Jobs public listing page with location filter.

    Args:
        keyword: Search keyword (e.g., "python developer")
        location: Optional location (e.g., "bangalore")
        limit: Max results to extract

    Returns:
        List of job dicts
    """
    encoded_kw  = quote(keyword + " intern")
    loc_lower   = location.strip().lower()
    geo_id      = LINKEDIN_GEO_IDS.get(loc_lower, "")
    encoded_loc = quote(location) if location and loc_lower != "remote" else ""

    if geo_id:
        url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={encoded_kw}&location={encoded_loc}&geoId={geo_id}&f_JT=I&f_E=1"
        )
    elif encoded_loc:
        url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={encoded_kw}&location={encoded_loc}&f_JT=I&f_E=1"
        )
    else:
        url = f"https://www.linkedin.com/jobs/search/?keywords={encoded_kw}&f_JT=I&f_E=1"

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=HEADERS["User-Agent"])
        page    = await context.new_page()
        try:
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")

            # Check for auth wall before attempting to query cards
            if any(p in page.url for p in ["authwall", "/login", "/checkpoint"]):
                log.warning("LinkedIn: auth wall detected — returning empty")
                await browser.close()
                return []

            # Wait for job cards to load with proper selector
            try:
                await page.wait_for_selector(
                    ".jobs-search__results-list li, .job-card-container, [data-job-id]",
                    timeout=15000
                )
            except Exception:
                log.warning("LinkedIn: card selector timed out — proceeding with query")

            cards = await page.query_selector_all(".jobs-search__results-list li, .job-card-container, [data-job-id]")
            for card in cards[:limit]:
                try:
                    role    = await _safe_text(card, "a.job-card-list__title, h3.job-card-list__title, h3.base-search-card__title, h3")
                    company = await _safe_text(card, ".job-card-container__primary-description, h4.base-search-card__subtitle, h4")
                    loc     = await _safe_text(card, ".job-card-container__metadata-wrapper span, .job-search-card__location")
                    href_el = await card.query_selector("a.job-card-list__title, a.base-card__full-link, a[href*='/jobs/view']")
                    link    = ""
                    if href_el:
                        link = (await href_el.get_attribute("href") or "").split("?")[0]
                    if not role:
                        continue
                    results.append({
                        "company":     company or "Unknown",
                        "role":        role,
                        "url":         link,
                        "location":    loc or location or "Remote",
                        "description": f"{role} at {company}. Location: {loc}.",
                        "tags":        ["internship", keyword.lower()],
                    })
                except Exception:
                    continue
        except Exception as e:
            log.error(f"LinkedIn scrape error: {e}")
        finally:
            await browser.close()
    return results


# ─── RemoteOK API ─────────────────────────────────────────────────────────────

def _search_remoteok(keyword: str, limit: int = 10) -> list:
    """
    Queries RemoteOK API for remote internship listings.

    Args:
        keyword: Search keyword
        limit: Max results to return

    Returns:
        List of job dicts
    """
    try:
        resp = requests.get("https://remoteok.com/api", headers=HEADERS, timeout=15)
        resp.raise_for_status()
        jobs = resp.json()
        if isinstance(jobs, list) and jobs:
            jobs = jobs[1:]  # Skip header row

        kw = keyword.lower()
        results = []
        for job in jobs:
            if not isinstance(job, dict):
                continue
            combined = " ".join([
                job.get("position", "") or "",
                " ".join(job.get("tags", []) or []),
                job.get("description", "") or "",
            ]).lower()
            if any(w in combined for w in kw.split()):
                results.append({
                    "company":     job.get("company", "Unknown") or "Unknown",
                    "role":        job.get("position", "") or "",
                    "url":         job.get("url", "") or "",
                    "location":    "Remote",
                    "description": re.sub(r'<[^>]+>', ' ', job.get("description", "") or "")[:2000],
                    "tags":        job.get("tags", []),
                })
            if len(results) >= limit:
                break
        return results
    except Exception as e:
        log.error(f"RemoteOK API error: {e}")
        return []
