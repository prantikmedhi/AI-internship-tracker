"""
Form field filling helpers for Playwright automation.
"""

import os
import re
from internship_agent.log.logger import log


async def _fill_first_visible(page, selectors: list, value: str) -> bool:
    """
    Tries each selector in order. Fills the first visible one. Returns True if filled.

    Args:
        page: Playwright page object
        selectors: List of CSS selectors to try
        value: Value to fill into the field

    Returns:
        True if a field was filled, False otherwise
    """
    for selector in selectors:
        try:
            el = page.locator(selector).first
            if await el.is_visible(timeout=1500):
                await el.fill(value)
                return True
        except Exception:
            pass
    return False


async def _attempt_resume_upload(page, profile: dict, screenshots_dir: str = "screenshots") -> bool:
    """
    Attempts to upload a resume file if a path is mentioned in the Resume profile section.

    Args:
        page: Playwright page object
        profile: User profile dict with Resume section
        screenshots_dir: Directory for screenshots

    Returns:
        True if upload was attempted and succeeded
    """
    resume_text = profile.get("Resume", "")
    # Look for a file path pattern in the Resume section
    path_match = re.search(
        r'(?:resume|cv)[^\n]*?[:\s]+(/[\w/\-. ]+\.(?:pdf|docx|doc))',
        resume_text,
        re.IGNORECASE
    )
    if not path_match:
        return False

    file_path = path_match.group(1).strip()
    if not os.path.isfile(file_path):
        log.info(f"Resume path found in profile ({file_path}) but file does not exist")
        return False

    try:
        count = await page.locator("input[type='file']").count()
        if count > 0:
            file_input = page.locator("input[type='file']").first
            try:
                await file_input.set_input_files(file_path)
                log.success(f"Resume uploaded: {file_path}")
                return True
            except Exception as e:
                log.error(f"Resume upload error: {e}")
    except Exception as e:
        log.error(f"Failed to locate file input: {e}")

    return False
