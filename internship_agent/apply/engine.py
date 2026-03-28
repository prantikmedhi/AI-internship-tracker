"""
Application automation engine — form filling and submission.
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright
from internship_agent.apply.fields import _fill_first_visible, _attempt_resume_upload
from internship_agent.apply.verifier import ApplyResult, ApplyStatus, verify_submission, _take_screenshot
from internship_agent.apply.internshala import _apply_internshala
from internship_agent.llm.extraction import generate_cover_letter
from internship_agent.notion.profile import _parse_profile_fields
from internship_agent.log.logger import log
from config import DRY_RUN, SCREENSHOTS_DIR


async def _try_apply(page, profile: dict, job: dict) -> ApplyResult:
    """
    Attempts to fill and submit a generic job application form.
    Uses truthful verification via verify_submission().

    Args:
        page: Playwright page object
        profile: User profile dict
        job: Job listing dict

    Returns:
        ApplyResult with truthful status
    """
    url = job.get("url", "")
    company = job.get("company", "Unknown")
    role = job.get("role", "Unknown Role")

    if not url:
        return ApplyResult(ApplyStatus.FAILED, "No apply URL provided.")

    log.step(1, 5, f"Opening {company} — {role}")

    # Check if Internshala — route to specialised handler
    if "internshala.com" in url:
        return await _apply_internshala(page, profile, job, SCREENSHOTS_DIR)

    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        log.success(f"Page loaded: {url}")
        try:
            await page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass

        # For LinkedIn jobs, click "Easy Apply" button
        if "linkedin.com" in url:
            try:
                easy_apply = page.locator("button:has-text('Easy Apply')").first
                if await easy_apply.is_visible(timeout=3000):
                    log.info("  Clicking Easy Apply button...")
                    await easy_apply.click()
                    await page.wait_for_timeout(1000)
            except Exception as e:
                log.info(f"  Easy Apply button not found: {e}")

        fields = _parse_profile_fields(profile)
        cover = generate_cover_letter(profile, job)
        filled_any = False

        log.step(2, 5, f"Filling form fields...")

        # Name
        if await _fill_first_visible(page, [
            "input[name*='name' i]",
            "input[placeholder*='name' i]",
            "input[id*='name' i]",
            "input[autocomplete='name']",
        ], fields["name"]):
            log.info(f"  ✓ Name: {fields['name']}")
            filled_any = True

        # Email
        if fields["email"]:
            if await _fill_first_visible(page, [
                "input[type='email']",
                "input[name*='email' i]",
                "input[placeholder*='email' i]",
            ], fields["email"]):
                log.info(f"  ✓ Email: {fields['email']}")
                filled_any = True

        # Phone, LinkedIn, GitHub, Portfolio, College, Grad Year
        if fields["phone"]:
            await _fill_first_visible(page, [
                "input[type='tel']",
                "input[name*='phone' i]",
                "input[placeholder*='phone' i]",
            ], fields["phone"]) and log.info(f"  ✓ Phone") or None

        if fields["linkedin"]:
            await _fill_first_visible(page, [
                "input[name*='linkedin' i]",
                "input[placeholder*='linkedin' i]",
            ], fields["linkedin"]) and log.info(f"  ✓ LinkedIn") or None

        if fields["github"]:
            await _fill_first_visible(page, [
                "input[name*='github' i]",
                "input[placeholder*='github' i]"
            ], fields["github"]) and log.info(f"  ✓ GitHub") or None

        if fields["portfolio"]:
            await _fill_first_visible(page, [
                "input[name*='portfolio' i]", "input[name*='website' i]",
            ], fields["portfolio"]) and log.info(f"  ✓ Portfolio") or None

        if fields["college"]:
            await _fill_first_visible(page, [
                "input[name*='college' i]",
                "input[name*='university' i]",
            ], fields["college"]) and log.info(f"  ✓ College") or None

        if fields["grad_year"]:
            await _fill_first_visible(page, [
                "input[name*='grad' i]",
                "input[placeholder*='graduation' i]",
            ], fields["grad_year"]) and log.info(f"  ✓ Grad Year") or None

        # Cover letter
        log.step(3, 5, "Filling cover letter...")
        if await _fill_first_visible(page, [
            "textarea[name*='cover' i]",
            "textarea[name*='message' i]",
            "textarea[name*='letter' i]",
            "textarea",
            "div[contenteditable='true']",
        ], cover[:2000]):
            log.info(f"  ✓ Cover letter ({len(cover)} chars)")
            filled_any = True

        if not filled_any:
            shot = await _take_screenshot(page, f"{company}_no_fields", SCREENSHOTS_DIR)
            current_url = page.url
            log.error(f"No form fields found. Current URL: {current_url}")
            return ApplyResult(
                ApplyStatus.UNSUPPORTED_FLOW,
                f"Could not find any fillable form fields. May require manual interaction or login.",
                shot
            )

        # Resume upload
        log.step(4, 5, "Uploading resume...")
        await _attempt_resume_upload(page, profile, SCREENSHOTS_DIR)

        shot = await _take_screenshot(page, f"{company}_filled", SCREENSHOTS_DIR)

        # Submit
        log.step(5, 5, "Submitting application...")
        if not DRY_RUN:
            try:
                submit = page.locator(
                    "button[type='submit'], input[type='submit'], "
                    "button:has-text('Apply'), button:has-text('Submit')"
                ).first
                if await submit.is_visible(timeout=3000):
                    await submit.click()
                    result = await verify_submission(page)
                    return result
                else:
                    return ApplyResult(
                        ApplyStatus.PARTIALLY_COMPLETED,
                        f"Submit button not visible. May need manual submission.",
                        shot
                    )
            except Exception as e:
                log.error(f"Submit error: {e}")
                return ApplyResult(
                    ApplyStatus.FAILED,
                    f"Form filled but submit failed: {e}",
                    shot
                )
        else:
            log.info("[DRY RUN] Would submit here")
            return ApplyResult(
                ApplyStatus.PARTIALLY_COMPLETED,
                f"[DRY RUN] Form filled but not submitted",
                shot
            )

    except Exception as e:
        log.error(f"Exception: {e}")
        return ApplyResult(
            ApplyStatus.FAILED,
            f"Error applying to {company}: {e}"
        )


async def apply_to_job(profile: dict, job: dict) -> ApplyResult:
    """
    Main entry point — runs Playwright for a single job application.

    Args:
        profile: User profile dict
        job: Job listing dict

    Returns:
        ApplyResult with truthful status
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1366, "height": 768},
            locale="en-US",
        )
        page = await context.new_page()
        try:
            result = await _try_apply(page, profile, job)
        finally:
            await browser.close()
    return result


def apply_sync(profile: dict, job: dict) -> ApplyResult:
    """
    Synchronous wrapper for apply_to_job (for use in thread executor).

    Args:
        profile: User profile dict
        job: Job listing dict

    Returns:
        ApplyResult with truthful status
    """
    return asyncio.run(apply_to_job(profile, job))
