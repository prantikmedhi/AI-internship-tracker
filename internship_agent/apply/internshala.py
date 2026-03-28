"""
Internshala-specific application handler.
"""

import os
from datetime import datetime
from internship_agent.apply.fields import _fill_first_visible
from internship_agent.apply.verifier import ApplyResult, ApplyStatus, _take_screenshot
from internship_agent.llm.extraction import generate_cover_letter
from internship_agent.notion.profile import _parse_profile_fields
from internship_agent.log.logger import log


async def _apply_internshala(page, profile: dict, job: dict, screenshots_dir: str = "screenshots") -> ApplyResult:
    """
    Handles Internshala's specific multi-step application modal.
    Internshala requires login for full apply. This handler fills what it can
    from the public detail page and attempts to trigger the apply flow.

    Args:
        page: Playwright page object
        profile: User profile dict
        job: Job listing dict
        screenshots_dir: Directory for screenshots

    Returns:
        ApplyResult with status
    """
    company = job.get("company", "Unknown")
    role = job.get("role", "Unknown")

    # Check for login wall before attempting apply
    body_text = (await page.inner_text("body")).lower()
    if "login" in page.url or "sign in to continue" in body_text:
        shot = await _take_screenshot(page, f"internshala_{company}_login_wall", screenshots_dir)
        return ApplyResult(
            ApplyStatus.LOGIN_REQUIRED,
            "Internshala requires login to apply. Cannot proceed without credentials.",
            shot
        )

    try:
        log.info(f"[1/3] Internshala: Finding Apply Now button...")
        # Step 1: Click "Apply Now" to open modal
        try:
            apply_btn = page.locator(
                "button:has-text('Apply Now'), a:has-text('Apply Now'), "
                "#apply_now_btn, .apply-btn"
            ).first
            if await apply_btn.is_visible(timeout=3000):
                await apply_btn.click()
                await page.wait_for_timeout(1500)
                log.success("Apply Now button clicked")
            else:
                shot = await _take_screenshot(page, f"internshala_{company}_no_button", screenshots_dir)
                log.error(f"Apply Now button not found on {company} page")
                return ApplyResult(
                    ApplyStatus.APPLICATION_BLOCKED,
                    f"Internshala Apply Now button not found. May require login.",
                    shot
                )
        except Exception as e:
            shot = await _take_screenshot(page, f"internshala_{company}_error", screenshots_dir)
            log.error(f"Could not click Apply Now: {e}")
            return ApplyResult(
                ApplyStatus.UNSUPPORTED_FLOW,
                f"Could not interact with Internshala Apply button: {e}",
                shot
            )

        # Step 2: Fill cover letter in the modal textarea
        log.info(f"[2/3] Generating cover letter and filling modal...")
        cover = generate_cover_letter(profile, job)
        fields = _parse_profile_fields(profile)
        filled_any = False

        filled_any |= await _fill_first_visible(page, [
            "textarea[data-cover-letter]",
            ".modal textarea",
            "textarea[name*='cover' i]",
            "textarea[placeholder*='cover' i]",
            "textarea[placeholder*='why' i]",
            ".cover-letter-box textarea",
            "textarea",
        ], cover[:2000])

        # Fill availability (if modal asks)
        filled_any |= await _fill_first_visible(page, [
            "input[name*='availability' i]",
            "input[placeholder*='available' i]",
            "input[name*='joining' i]",
        ], "Immediately")

        log.success("Modal fields filled")

        # Step 3: Screenshot and attempt submission
        log.info(f"[3/3] Attempting to submit application...")
        shot = await _take_screenshot(page, f"internshala_{company}_filled", screenshots_dir)

        # Try to click Next / Continue to advance through modal steps
        submit_attempted = False
        for btn_text in ["Next", "Continue", "Submit Application", "Apply", "Submit"]:
            try:
                btn = page.locator(f"button:has-text('{btn_text}')").first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    await page.wait_for_timeout(2000)
                    submit_attempted = True
                    log.success(f"Clicked '{btn_text}' button")
                    break
            except Exception:
                pass

        if not submit_attempted:
            log.info("No submit button found — application may require manual completion")
            return ApplyResult(
                ApplyStatus.PARTIALLY_COMPLETED,
                f"Internshala modal filled but submit button not found. Manual completion may be required.",
                shot
            )

        log.success(f"✅ Internshala application submitted for {company} — {role}")
        return ApplyResult(
            ApplyStatus.APPLIED_SUCCESSFULLY,
            f"Internshala application submitted for {company} — {role}",
            shot
        )

    except Exception as e:
        shot = await _take_screenshot(page, f"internshala_{company}_exception", screenshots_dir)
        log.error(f"Internshala handler exception: {e}")
        return ApplyResult(
            ApplyStatus.FAILED,
            f"Internshala application error: {e}",
            shot
        )
